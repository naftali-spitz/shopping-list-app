'use client';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Product = {id:string;category_id:string;name:string;quantity:number;version:number};
type Snapshot = {household:{version:number};categories:{id:string;name:string}[];products:Product[]};
type Intent = {id:string;household_id:string;type:string;payload:Record<string,unknown>;expected_version:number|null;correlation_id:string;issued_ms:number;expires_ms:number};
type Result = {status:string;data:Snapshot|{record:Product;household_version:number}|Result|null};
type Pending = {intent:Intent;state:'Saving'|'Saved'|'Offline/pending'|'Failed'|'Conflict requiring reconciliation';result?:Result;confirmed_ms?:number};
type ApiStatus = {result?:Result;state?:string;error?:string};
const newIntent=(h:string,type:string,payload:Record<string,unknown>,version:number|null):Intent=>{const now=Date.now();return {id:crypto.randomUUID(),household_id:h,type,payload,expected_version:version,correlation_id:crypto.randomUUID(),issued_ms:now,expires_ms:now+300000};};
const terminal=(r:Result):Pending['state']=>r.status==='committed'?'Saved':r.status==='version_conflict'?'Conflict requiring reconciliation':'Failed';

export default function Stage3Client() {
  const [session,setSession]=useState<Session|null>(null),[households,setHouseholds]=useState<{household_id:string;household_name:string}[]>([]);
  const [household,setHousehold]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('');
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[operations,setOperations]=useState<Pending[]>([]),[name,setName]=useState('');
  const queue=useRef<Pending[]>([]),sessionRef=useRef<Session|null>(null);
  const userId=session?.user.id;
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{sessionRef.current=data.session;setSession(data.session);});
    const {data}=supabase.auth.onAuthStateChange((_event,s)=>{sessionRef.current=s;setSession(s);});
    return ()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!userId)return;
    let cancelled=false;
    supabase.rpc('list_my_households').then(({data,error})=>{
      if(cancelled)return;
      if(error){setMessage('Sign in again to load households.');return;}
      setHouseholds(data||[]);setHousehold(data?.[0]?.household_id||'');
    });
    return ()=>{cancelled=true;};
  },[userId]);
  const storageKey=userId&&household?`shopping-stage3-v2:${userId}:${household}`:'';
  function saveQueue(items:Pending[]) {
    // Retain every unresolved operation; keep a bounded recent terminal history.
    const unresolved=items.filter(p=>!p.result),finished=items.filter(p=>p.result).slice(-30);
    queue.current=[...finished,...unresolved];
    localStorage.setItem(storageKey,JSON.stringify(queue.current));
    setOperations([...queue.current]);
  }
  async function api(body:unknown):Promise<ApiStatus> {
    const current=sessionRef.current;
    if(!current)throw new Error('Sign in again.');
    const response=await fetch('/api/stage3',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current.access_token},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
    const status=await response.json();
    if(!response.ok)throw new Error(status.error||'Request failed.');
    return status;
  }
  useEffect(()=>{
    if(!storageKey)return;
    let cancelled=false,busy=false,snapshotIntent:Intent|null=null;
    try {
      const stored=JSON.parse(localStorage.getItem(storageKey)||'[]');
      queue.current=Array.isArray(stored)?stored.filter(p=>p?.intent?.household_id===household):[];
      setOperations([...queue.current]);setSnapshot(null);
    } catch {setMessage('Pending storage could not be read. Preserve this browser data before retrying.');return;}
    const persist=()=>{if(cancelled)return;localStorage.setItem(storageKey,JSON.stringify(queue.current));setOperations([...queue.current]);};
    async function tick() {
      if(busy||cancelled)return;busy=true;
      try {
        if(!navigator.onLine){for(const p of queue.current)if(!p.result)p.state='Offline/pending';persist();return;}
        for(const p of queue.current.filter(p=>!p.result)) {
          let status:ApiStatus;
          try {status=await api({action:'status',household_id:household,id:p.intent.id});}
          catch {
            if(p.intent.expires_ms>Date.now())status=await api({action:'command',intent:p.intent});
            else {p.state='Conflict requiring reconciliation';persist();continue;}
          }
          if(cancelled)return;
          if(status.result) {
            p.result=status.result;p.state=terminal(status.result);p.confirmed_ms=Date.now();
          } else p.state=status.state==='reconciliation_required'?'Conflict requiring reconciliation':status.state==='failed_retryable'?'Offline/pending':'Saving';
          persist();
        }
        if(!snapshotIntent) {
          snapshotIntent=newIntent(household,'snapshot',{},null);
          await api({action:'command',intent:snapshotIntent});
        }
        const status=await api({action:'status',household_id:household,id:snapshotIntent.id});
        if(cancelled)return;
        if(status.result?.status==='snapshot') {
          const next=status.result.data as Snapshot;
          setSnapshot(old=>!old||Number(next.household.version)>=Number(old.household.version)?next:old);
          snapshotIntent=null;setMessage('Connected to the development backend.');
        } else if(status.result || snapshotIntent.expires_ms<Date.now())snapshotIntent=null;
      } catch {
        for(const p of queue.current)if(!p.result)p.state='Offline/pending';
        persist();if(!cancelled)setMessage('Offline/pending, or session expired. Pending IDs are preserved; sign in again if needed.');
      } finally {busy=false;}
    }
    void tick();const timer=setInterval(()=>void tick(),2500);
    const reconnect=()=>void tick();window.addEventListener('online',reconnect);
    return ()=>{cancelled=true;clearInterval(timer);window.removeEventListener('online',reconnect);};
    // The scoped queue is restarted only when the trusted user/household changes;
    // access-token refresh is read from sessionRef on each request.
  },[storageKey,household]);
  async function login(event:React.FormEvent) {
    event.preventDefault();setMessage('Signing in…');
    const {error}=await supabase.auth.signInWithPassword({email,password});
    setPassword('');setMessage(error?'Sign-in failed.':'Signed in.');
  }
  function enqueue(type:string,payload:Record<string,unknown>,version:number|null) {
    if(!storageKey)return;
    try {saveQueue([...queue.current,{intent:newIntent(household,type,payload,version),state:navigator.onLine?'Saving':'Offline/pending'}]);}
    catch {setMessage('Cannot persist pending operation. Free browser storage before making changes.');}
  }
  async function reconcile(p:Pending) {
    try {
      const check=newIntent(household,'operation.status',{operation_id:p.intent.id},null);
      await api({action:'command',intent:check});
      let result:Result|undefined;
      for(let i=0;i<20;i++) {
        await new Promise(resolve=>setTimeout(resolve,1000));
        const s=await api({action:'status',household_id:household,id:check.id});
        if(s.result){result=s.result;break;}
      }
      if(result?.status==='found') {p.result=result.data as Result;p.state=terminal(p.result);}
      else if(result?.status==='not_found' && p.intent.expires_ms<=check.issued_ms) {p.result={status:'expired',data:null};p.state='Failed';}
      else setMessage('Reconciliation is pending. Keep this operation ID.');
      saveQueue([...queue.current]);
    } catch {setMessage('Reconciliation unavailable. The operation ID is preserved.');}
  }
  const products=new Map((snapshot?.products||[]).map(p=>[p.id,{...p,quantity:Number(p.quantity)}]));
  for(const op of operations) {
    if(op.state==='Saved' && op.result?.data && 'record' in op.result.data) {
      const r=op.result.data.record;
      if(r?.category_id && (!products.has(r.id)||Number(r.version)>=Number(products.get(r.id)!.version)))products.set(r.id,{...r,quantity:Number(r.quantity)});
    }
    if(!op.result && ['product.create','product.update'].includes(op.intent.type)) {
      const p=op.intent.payload as Partial<Product>&{id:string};
      const base=products.get(p.id);
      if(base)products.set(p.id,{...base,...p});
      else if(p.name&&p.category_id)products.set(p.id,{id:p.id,name:p.name,category_id:p.category_id,quantity:p.quantity||1,version:0});
    }
  }
  return <main className="mx-auto max-w-3xl space-y-6 p-6" dir="ltr">
    <h1 className="text-2xl font-bold">Shopping List · Development integration</h1>
    <p role="status">{message}</p>
    {!session?<form onSubmit={login} className="flex flex-col gap-3">
      <label>Email <input className="border p-2" aria-label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label>
      <label>Password <input className="border p-2" aria-label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
      <button className="rounded bg-cyan-600 p-2" type="submit">Sign in</button>
    </form>:<>
      <div className="flex gap-4"><label>Household <select aria-label="Household" className="border p-2" value={household} onChange={e=>setHousehold(e.target.value)}>{households.map(h=><option key={h.household_id} value={h.household_id}>{h.household_name}</option>)}</select></label>
        <button onClick={async()=>{await supabase.auth.signOut({scope:'local'});setSnapshot(null);setOperations([]);}}>Sign out</button></div>
      <p>Authoritative household revision: <span data-testid="revision">{snapshot?.household.version||'Loading'}</span></p>
      {snapshot&&!snapshot.categories.length?<button className="border p-2" onClick={()=>enqueue('category.create',{id:crypto.randomUUID(),name:'Groceries',icon:'general'},0)}>Create groceries category</button>:null}
      {snapshot?.categories.length?<form className="flex gap-3" onSubmit={e=>{e.preventDefault();enqueue('product.create',{id:crypto.randomUUID(),category_id:snapshot.categories[0].id,name:name.trim(),quantity:1},0);setName('');}}>
        <label>Product name <input aria-label="Product name" className="border p-2" maxLength={120} value={name} onChange={e=>setName(e.target.value)} required/></label><button className="border p-2" type="submit">Add product</button>
      </form>:null}
      <ul className="space-y-3">{Array.from(products.values()).map(p=><li className="flex items-center justify-between border p-3" key={p.id} data-product-id={p.id}>
        <span>{p.name}</span><span>Quantity: <span data-testid="quantity">{p.quantity}</span></span>
        <button aria-label={`Increase ${p.name}`} disabled={operations.some(o=>!o.result&&o.intent.payload.id===p.id)} className="border p-2 disabled:opacity-50" onClick={()=>enqueue('product.update',{id:p.id,quantity:p.quantity+1},Number(p.version))}>+1</button>
      </li>)}</ul>
      <h2 className="text-xl">Operation status</h2>
      <ul className="space-y-2" aria-live="polite">{operations.map(p=><li key={p.intent.id} data-operation-id={p.intent.id} data-state={p.state} className="border p-2"><strong>{p.state}</strong> · {p.intent.type} · <code>{p.intent.id}</code>{p.state==='Conflict requiring reconciliation'?<button className="ml-3 underline" onClick={()=>void reconcile(p)}>Reconcile</button>:null}</li>)}</ul>
      <Link className="underline" href="/">Original development app</Link>
    </>}
  </main>;
}
