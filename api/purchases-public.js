// Public read-only endpoint — returns purchased gift_ids + buyer_name for display
// No sensitive data (no emails, no messages)
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?select=gift_id,buyer_name,purchased_at&order=purchased_at.asc`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!res.ok) return json([], 200); // fail silently — frontend uses localStorage cache
  const rows = await res.json();
  // Only expose gift_id and first name (privacy)
  const safe = rows.map(r => ({
    gift_id: r.gift_id,
    buyer_name: r.buyer_name ? r.buyer_name.split(' ')[0] : null,
  }));
  return json(safe);
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
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
