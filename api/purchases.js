// Vercel Edge Function — return all purchases (for admin page)
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  // Simple password check via query param or Authorization header
  const url = new URL(req.url);
  const pwd = url.searchParams.get('pwd') || req.headers.get('x-admin-password');
  if (pwd !== ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?select=*&order=purchased_at.desc`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!res.ok) return json({ error: 'Database error' }, 500);
  const rows = await res.json();
  return json(rows);
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  };
}
