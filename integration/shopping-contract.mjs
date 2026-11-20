export const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export function canonical(value) {
  if (value instanceof Date) return canonical(value.toJSON());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  if (value === undefined || typeof value === 'number' && !Number.isFinite(value)) throw new Error('invalid_payload');
  return JSON.stringify(value);
}
export function validateOperation(c) {
  const p = c.payload;
  if (!p || Array.isArray(p) || typeof p !== 'object') throw new Error('invalid_payload');
  const exact = allowed => { if (Object.keys(p).some(k => !allowed.includes(k))) throw new Error('invalid_payload'); };
  const name = v => typeof v === 'string' && v === v.trim() && v.length > 0 && v.length <= 120;
  const version = n => Number.isSafeInteger(n) && n > 0;
  if (c.type === 'snapshot') { exact([]); if (c.expected_version !== null) throw new Error('invalid_version'); return; }
  if (c.type === 'operation.status') { exact(['operation_id']); if (!uuid(p.operation_id)) throw new Error('invalid_payload'); return; }
  if (c.type === 'list.export') { exact(['history_id']); if (!uuid(p.history_id) || !version(c.expected_version)) throw new Error('invalid_payload'); return; }
  if (c.type === 'list.restore') { exact(['product_ids']); if (!Array.isArray(p.product_ids) || p.product_ids.length > 100 || !p.product_ids.every(uuid) || new Set(p.product_ids).size !== p.product_ids.length || !version(c.expected_version)) throw new Error('invalid_payload'); return; }
  if (!['category.create','category.update','category.delete','product.create','product.update','product.delete','history.delete'].includes(c.type) || !uuid(p.id)) throw new Error('invalid_operation');
  const [entity, verb] = c.type.split('.');
  exact(verb === 'delete' ? ['id'] : entity === 'category' ? ['id','name','icon'] : ['id','category_id','name','checked','quantity','display_order']);
  if (verb === 'create' ? c.expected_version !== 0 : !version(c.expected_version)) throw new Error('invalid_version');
  if (verb === 'create' && (!name(p.name) || entity === 'product' && !uuid(p.category_id))) throw new Error('invalid_payload');
  if (verb === 'update' && Object.keys(p).length < 2) throw new Error('invalid_payload');
  if (p.name !== undefined && !name(p.name) || p.icon !== undefined && (typeof p.icon !== 'string' || !/^[a-z0-9-]{1,40}$/.test(p.icon)) ||
      p.category_id !== undefined && !uuid(p.category_id) || p.checked !== undefined && typeof p.checked !== 'boolean' ||
      p.quantity !== undefined && (!Number.isFinite(p.quantity) || p.quantity < 1 || p.quantity > 9999 || Math.round(p.quantity * 100) / 100 !== p.quantity) ||
      p.display_order !== undefined && p.display_order !== null && (!Number.isInteger(p.display_order) || p.display_order < 0 || p.display_order > 1000000)) throw new Error('invalid_payload');
}
