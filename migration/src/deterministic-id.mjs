import { createHash } from 'node:crypto';

const ID_NAMESPACE = 'f00c0000-0000-5000-8000-000000000001';

export function deterministicId(entityType, zohoId) {
  if (!entityType || !zohoId) {
    throw new Error(`deterministicId needs both an entity type and a Zoho id, got ${entityType}/${zohoId}`);
  }
  const ns = Buffer.from(ID_NAMESPACE.replace(/-/g, ''), 'hex');
  const name = Buffer.from(`${entityType}:${zohoId}`, 'utf8');
  const hash = createHash('sha1').update(Buffer.concat([ns, name])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isDuplicateKey(error) {
  return error?.code === '23505' || /duplicate key value/i.test(error?.message ?? '');
}
