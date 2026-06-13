// Vercel Edge Function — record a purchase in Supabase + send Resend notification
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'anthony.ferreyrolles@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'contact@aethrion.io';
const SITE_URL = 'https://wedding-registry-victoria-anthony.aethrion.io';

const GIFT_NAMES = {
  1:'Aspirateur balai Shark',2:'Gants de cuisine KitchenAid',3:'Nettoyeur taches BISSELL',
  4:'Chauffe-plat électrique iTRUSOU',5:'Étagères métalliques CEYIRO (x2)',6:'Rangement chaussures SONGMICS',
  7:'Distributeur canettes réfrigérateur',8:'Boîte charcuterie Mepal Modula',9:'Cuiseur à riz vintage',
  10:'Imprimante étiquettes Phomemo',11:'Friteuse nomade Ninja CRISPi',12:'Store brise-vue rétractable',
  13:'Colonne de rangement 5five',14:'Colonne salle de bain HOMCOM',15:'Colonne bambou Vicco Liora',
  16:'Cuillères doseuses 9 pièces',17:'Ustensiles de cuisine en teck — 10 pièces',18:'Aspirateur balai Dreame R10',
  19:'Blender SMEG',20:'Machine à expresso SMEG',21:'Robot pâtissier SMEG',22:'Bloc à couteaux SMEG'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { gift_id, buyer_name, buyer_email, message, source = 'manual' } = body;
  if (!gift_id || !buyer_name?.trim()) {
    return json({ error: 'gift_id and buyer_name are required' }, 400);
  }

  const giftName = GIFT_NAMES[gift_id] || `Cadeau #${gift_id}`;

  // 1. Upsert into Supabase
  const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      gift_id: Number(gift_id),
      buyer_name: buyer_name.trim(),
      buyer_email: buyer_email?.trim() || null,
      message: message?.trim() || null,
      source,
    }),
  });

  if (!sbRes.ok) {
    const err = await sbRes.text();
    console.error('Supabase error:', err);
    return json({ error: 'Database error' }, 500);
  }

  // 2. Send email via Resend
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAIL,
        subject: `🎁 ${buyer_name.trim()} a réservé : ${giftName}`,
        html: `
          <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#3A332E;">
            <h2 style="color:#B79155;font-weight:400;">Nouvelle réservation 💌</h2>
            <table style="border-collapse:collapse;width:100%;">
              <tr><td style="padding:8px 0;color:#8C8077;width:130px;">Cadeau</td><td style="padding:8px 0;font-weight:600;">${giftName}</td></tr>
              <tr><td style="padding:8px 0;color:#8C8077;">Offert par</td><td style="padding:8px 0;">${buyer_name.trim()}</td></tr>
              ${buyer_email ? `<tr><td style="padding:8px 0;color:#8C8077;">Email</td><td style="padding:8px 0;">${buyer_email}</td></tr>` : ''}
              ${message ? `<tr><td style="padding:8px 0;color:#8C8077;">Message</td><td style="padding:8px 0;font-style:italic;">"${message}"</td></tr>` : ''}
              <tr><td style="padding:8px 0;color:#8C8077;">Source</td><td style="padding:8px 0;">${source === 'amazon' ? 'Amazon (sync auto)' : 'Site registry'}</td></tr>
            </table>
            <p style="margin-top:24px;color:#8C8077;font-size:14px;">— <a href="${SITE_URL}" style="color:#B79155;">Liste de mariage Anthony &amp; Victoria</a></p>
          </div>`,
      }),
    });
  } catch (e) {
    console.warn('Resend error (non-fatal):', e);
  }

  return json({ ok: true, gift_id, buyer_name: buyer_name.trim() });
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
