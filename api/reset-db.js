// Admin-only endpoint to wipe all purchases (for testing)
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const pwd = req.headers.get('x-admin-password');
  if (!ADMIN_PASSWORD || pwd !== ADMIN_PASSWORD) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/purchases?id=gte.0`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'Delete failed', detail: err }, 500);
  }

  return json({ ok: true, message: 'All purchases deleted' });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  };
}
