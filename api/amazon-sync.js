// Vercel Cron — scrapes the public Amazon wishlist every hour,
// marks newly-purchased items in Supabase and fires a Resend notification.
// Configure in vercel.json: { "crons": [{ "path": "/api/amazon-sync", "schedule": "0 * * * *" }] }
export const config = { runtime: 'nodejs' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // set in Vercel env vars
const WISHLIST_URL = 'https://www.amazon.fr/hz/wishlist/ls/3RQXZQXRAVR0N?ref_=wl_share';

// Map wishlist ASINs → gift IDs on our registry
const ASIN_TO_GIFT_ID = {
  'B0F2227R1Y': 1,  // Shark vacuum
  'B08J8GZXKZ': 2,  // KitchenAid gloves
  'B0D5DJFDBQ': 3,  // BISSELL
  'B0D1Y42SPM': 4,  // iTRUSOU warmer
  'B0FLY4GN28': 5,  // CEYIRO shelves
  'B0DSZQLQQD': 6,  // SONGMICS shoes
  'B0FRMCY863': 7,  // Aurinovellia fridge
  'B000MWTI0O': 8,  // Mepal box
  'B08JTRT11D': 9,  // Rice cooker
  'B0C49J18BH': 10, // Phomemo
  'B0FF525C1H': 11, // Ninja CRISPi
  'B0DV5HVP1Q': 12, // Blind
  'B0D2WRV187': 13, // 5five column
  'B0FXRGWR6T': 14, // HOMCOM
  'B0DWPVK1SD': 15, // Vicco bamboo
  'B07BQTLPQP': 16, // Measuring cups
  'B0BBGQ2GLZ': 17, // Wood utensils
  'B0C5M8MVGM': 18, // Dreame R10
  'B0BYMQTBMB': 19, // SMEG blender
  'B0BYMSXD2L': 20, // SMEG espresso
  'B07L8CQVQP': 21, // SMEG mixer
  'B0DG9TMNKG': 22, // SMEG knife block
};

export default async function handler(req) {
  // Protect from unauthorized calls (Vercel sends Authorization: Bearer <CRON_SECRET>)
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // Fetch the public wishlist page
  let html;
  try {
    const res = await fetch(WISHLIST_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    html = await res.text();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'fetch failed', detail: e.message }), { status: 500 });
  }

  // Find items marked as purchased (Amazon uses data-id + "Purchased" text near the item)
  const purchasedAsins = [];
  const asinMatches = html.matchAll(/data-asin="([A-Z0-9]{10})"/g);
  for (const m of asinMatches) {
    const asin = m[1];
    // Find a window around this match and check for purchase indicator
    const idx = m.index;
    const chunk = html.slice(Math.max(0, idx - 200), idx + 600);
    if (/purchased|acheté|gekocht/i.test(chunk)) {
      purchasedAsins.push(asin);
    }
  }

  if (purchasedAsins.length === 0) {
    return new Response(JSON.stringify({ ok: true, synced: 0, note: 'No purchased items detected' }));
  }

  // Fetch already-known purchases from Supabase to avoid duplicates
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?source=eq.amazon&select=gift_id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  ).then(r => r.json()).catch(() => []);
  const existingIds = new Set((existing || []).map(r => r.gift_id));

  let synced = 0;
  for (const asin of purchasedAsins) {
    const giftId = ASIN_TO_GIFT_ID[asin];
    if (!giftId || existingIds.has(giftId)) continue;

    // Record in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ gift_id: giftId, buyer_name: 'Acheté via Amazon', source: 'amazon' }),
    });

    // Notify via purchase endpoint (reuses Resend logic)
    await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gift_id: giftId, buyer_name: 'Acheté via Amazon', source: 'amazon' }),
    }).catch(() => {});

    synced++;
  }

  return new Response(JSON.stringify({ ok: true, synced, purchasedAsins }));
}
