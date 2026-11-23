// Shared server-only provider adapter. No browser identity comes from decoded JWT
// claims: the pinned Auth service and PostgREST validate the access token online.
export const DEV_ISSUER = 'https://njomxqthjglqesxchlbm.supabase.co/auth/v1';
export const DEV_SUPABASE = 'https://njomxqthjglqesxchlbm.supabase.co';
export const isUuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);

export async function verifyDevelopmentIdentity(token, householdId, { publishableKey, fetcher = fetch, sessionOnly = false } = {}) {
  if (!isUuid(householdId) || typeof token !== 'string' || token.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ||
      typeof publishableKey !== 'string' || !publishableKey.startsWith('sb_publishable_')) throw new Error('unauthorized');
  const headers = { apikey: publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function request(path, options = {}) {
    const response = await fetcher(`${DEV_SUPABASE}${path}`, {
      ...options, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('unauthorized');
    return response.json();
  }
  // getUser alone cannot prove logout: a signed access token may outlive the
  // refresh session. Both independent provider checks must succeed for this
  // request; run them concurrently, then bind their verified identities.
  const [user, context] = await Promise.all([
    request('/auth/v1/user'),
    request('/rest/v1/rpc/'+(sessionOnly?'stage4_dev_session_context':'stage3_dev_session_context'), {
      method: 'POST', body: JSON.stringify(sessionOnly?{}:{ p_household_id: householdId }),
    }),
  ]);
  if (!isUuid(user.id) || user.is_anonymous !== false || !user.email_confirmed_at && !user.phone_confirmed_at) throw new Error('unauthorized');
  if (context.user_id !== user.id || !isUuid(context.session_id) || context.issuer !== DEV_ISSUER ||
      !sessionOnly && (context.household_id !== householdId || !['owner', 'member'].includes(context.role))) throw new Error('unauthorized');
  // Stage4 selects PostgreSQL as the business authority. This is identity only,
  // never a membership admission claim; Debian must authorize transactionally.
  return Object.freeze(sessionOnly?{...context,household_id:householdId}:context);
}
