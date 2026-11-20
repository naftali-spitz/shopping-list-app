import pg from 'pg';
import { authenticate, validateOperation } from './protocol.mjs';
import { authenticateCommand } from '../../integration/stage3/protocol.mjs';
export class Store {
  constructor(config) { this.config=config; this.pool=new pg.Pool({ ...config.db,max:2,connectionTimeoutMillis:5000,statement_timeout:5000,idle_in_transaction_session_timeout:10000,application_name:'shopping-stage2-dev' }); }
  async close() { await this.pool.end(); }
  async execute(envelope, hooks = {}) {
    const authStarted=performance.now();
    const { command:c,hash } = this.config.protocolVersion === 2
      ? await authenticateCommand(envelope,this.config)
      : authenticate(envelope,this.config);
    validateOperation(c);
    const dbStarted=performance.now();
    const db=await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SELECT set_config('shopping.user_id',$1,true),set_config('shopping.household_id',$2,true)",[c.user_id,c.household_id]);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[c.household_id]);
      const principal=await db.query('SELECT id FROM shopping.principals WHERE id=$1::uuid AND issuer=$2 AND subject=$1::text AND active FOR SHARE',[c.user_id,this.config.identity.issuer]);
      const membership=await db.query('SELECT role FROM shopping.household_members WHERE household_id=$1 AND user_id=$2 AND active FOR SHARE',[c.household_id,c.user_id]);
      if (!principal.rowCount || !membership.rowCount) { await db.query('ROLLBACK'); return this.result(c,'forbidden'); }
      const persist = async result => {
        await db.query('INSERT INTO shopping.operations(id,household_id,user_id,canonical_hash,operation_type,correlation_id,result) VALUES($1,$2,$3,$4,$5,$6,$7)',[c.id,c.household_id,c.user_id,hash,c.type,c.correlation_id,result]);
        await db.query('INSERT INTO shopping.result_outbox(operation_id,household_id,user_id,result) VALUES($1,$2,$3,$4)',[c.id,c.household_id,c.user_id,result]);
        return result;
      };
      if(this.config.protocolVersion===2) {
        const previous=(await db.query('SELECT canonical_hash,user_id,result FROM shopping.operations WHERE id=$1',[c.id])).rows[0];
        if(previous){await db.query('COMMIT');return previous.canonical_hash===hash && previous.user_id===c.user_id?{...previous.result,replayed:true}:this.result(c,'operation_id_conflict');}
      }
      if (['snapshot','operation.status'].includes(c.type) && c.expires_ms<=Date.now()) { await db.query('ROLLBACK'); return this.result(c,'expired'); }
      if (c.type==='operation.status') {
        const old=await db.query('SELECT result FROM shopping.operations WHERE id=$1 AND household_id=$2 AND user_id=$3',[c.payload.operation_id,c.household_id,c.user_id]);
        const result=this.result(c,old.rowCount?'found':'not_found',old.rows[0]?.result??null);
        if(this.config.protocolVersion===2)await persist(result);
        await db.query('COMMIT'); return result;
      }
      if (c.type==='snapshot') {
        const snapshot={};
        for (const table of ['categories','products','shopping_history']) snapshot[table]=(await db.query(`SELECT * FROM shopping.${table} WHERE household_id=$1 AND deleted_at IS NULL ORDER BY id`,[c.household_id])).rows;
        snapshot.household=(await db.query('SELECT id,name,version FROM shopping.households WHERE id=$1 AND deleted_at IS NULL',[c.household_id])).rows[0];
        const result=this.result(c,'snapshot',snapshot);
        if(this.config.protocolVersion===2)await persist(result);
        await db.query('COMMIT'); return result;
      }
      // Check prior durable outcome before command deadline: retries may retrieve
      // already committed results, but never create effects after expiration.
      const old=await db.query('SELECT canonical_hash,user_id,result FROM shopping.operations WHERE id=$1',[c.id]);
      if (old.rowCount) {
        await db.query('COMMIT');
        return old.rows[0].canonical_hash===hash && old.rows[0].user_id===c.user_id ? { ...old.rows[0].result,replayed:true } : this.result(c,'operation_id_conflict');
      }
      const now=Date.now();
      let result;
      if (c.expires_ms<=now) result=this.result(c,'expired');
      else {
        await db.query('SAVEPOINT business_operation');
        try { result=await this.mutate(db,c); }
        catch(e) {
          if(e.code!=='23505')throw e;
          await db.query('ROLLBACK TO SAVEPOINT business_operation');
          result=this.result(c,'record_id_conflict');
        }
        await db.query('RELEASE SAVEPOINT business_operation');
      }
      // Transaction result and outbox are atomic with every business effect.
      await db.query('INSERT INTO shopping.operations(id,household_id,user_id,canonical_hash,operation_type,correlation_id,result) VALUES($1,$2,$3,$4,$5,$6,$7)',[c.id,c.household_id,c.user_id,hash,c.type,c.correlation_id,result]);
      await db.query('INSERT INTO shopping.result_outbox(operation_id,household_id,user_id,result) VALUES($1,$2,$3,$4)',[c.id,c.household_id,c.user_id,result]);
      await hooks.beforeCommit?.(db);
      await db.query('COMMIT'); return result;
    } catch(e) {
      await db.query('ROLLBACK');
      if (e.code==='23505') return this.result(c,'operation_id_conflict');
      throw e;
    } finally {
      db.release();
      if(this.config.protocolVersion===2)console.log(JSON.stringify({event:'stage3_database_trace',operation_id:c.id,correlation_id:c.correlation_id,authentication_ms:Math.round(dbStarted-authStarted),database_ms:Math.round(performance.now()-dbStarted)}));
    }
  }
  result(c,status,data=null) { return { operation_id:c.id,household_id:c.household_id,user_id:c.user_id,correlation_id:c.correlation_id,audience:this.config.audience,status,data }; }
  async mutate(db,c) {
    const p=c.payload, h=c.household_id;
    const household=(await db.query('SELECT version FROM shopping.households WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[h])).rows[0];
    if (!household) return this.result(c,'not_found');
    let data;
    if (c.type.startsWith('list.')) {
      if (Number(household.version)!==c.expected_version) return this.result(c,'version_conflict',{ current_version:Number(household.version) });
      if (c.type==='list.export') {
        data=(await db.query('UPDATE shopping.products SET checked=false,usage_count=usage_count+1,version=version+1 WHERE household_id=$1 AND checked AND deleted_at IS NULL RETURNING id,name,category_id,quantity',[h])).rows;
        await db.query('INSERT INTO shopping.shopping_history(id,household_id,items) VALUES($1,$2,$3)',[p.history_id,h,JSON.stringify(data)]);
      } else {
        const ids=await db.query('SELECT id FROM shopping.products WHERE household_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL',[h,p.product_ids]);
        if(ids.rowCount!==p.product_ids.length) return this.result(c,'not_found');
        data=(await db.query('UPDATE shopping.products SET checked=true,version=version+1 WHERE household_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL RETURNING *',[h,p.product_ids])).rows;
      }
    } else {
      const [entity,verb]=c.type.split('.');
      const table={category:'categories',product:'products',history:'shopping_history'}[entity];
      if (entity==='product' && p.category_id) {
        if (!(await db.query('SELECT 1 FROM shopping.categories WHERE id=$1 AND household_id=$2 AND deleted_at IS NULL',[p.category_id,h])).rowCount) return this.result(c,'not_found');
      }
      if (verb==='create') {
        const columns=entity==='category' ? ['name','icon'] : ['name','category_id','checked','quantity','display_order'];
        const values=entity==='category' ? [p.name,p.icon??'general'] : [p.name,p.category_id,p.checked??false,p.quantity??1,p.display_order??null];
        data=(await db.query(`INSERT INTO shopping.${table}(id,household_id,${columns.join(',')}) VALUES($1,$2,${values.map((_,i)=>`$${i+3}`).join(',')}) RETURNING *`,[p.id,h,...values])).rows[0];
      } else {
        const current=(await db.query(`SELECT * FROM shopping.${table} WHERE id=$1 AND household_id=$2 AND deleted_at IS NULL FOR UPDATE`,[p.id,h])).rows[0];
        if (!current) return this.result(c,'not_found');
        if (Number(current.version)!==c.expected_version) return this.result(c,'version_conflict',{ current_version:Number(current.version) });
        if (verb==='delete') {
          data=(await db.query(`UPDATE shopping.${table} SET deleted_at=now(),version=version+1 WHERE id=$1 AND household_id=$2 RETURNING id,version`,[p.id,h])).rows[0];
          if(entity==='category') await db.query('UPDATE shopping.products SET deleted_at=now(),version=version+1 WHERE category_id=$1 AND household_id=$2 AND deleted_at IS NULL',[p.id,h]);
          if(entity==='history') await db.query("UPDATE shopping.products SET usage_count=greatest(usage_count-1,0),version=version+1 WHERE household_id=$1 AND id IN(SELECT (item->>'id')::uuid FROM jsonb_array_elements($2::jsonb) item) AND deleted_at IS NULL",[h,JSON.stringify(current.items)]);
        } else {
          // Column names originate only from the validated allowlist above.
          const columns=Object.keys(p).filter(k=>k!=='id');
          data=(await db.query(`UPDATE shopping.${table} SET ${columns.map((k,i)=>`${k}=$${i+3}`).join(',')},version=version+1 WHERE id=$1 AND household_id=$2 RETURNING *`,[p.id,h,...columns.map(k=>p[k])])).rows[0];
        }
      }
    }
    const version=(await db.query('UPDATE shopping.households SET version=version+1 WHERE id=$1 RETURNING version',[h])).rows[0].version;
    return this.result(c,'committed',{ record:data,household_version:Number(version) });
  }
}
