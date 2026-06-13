# Setup guide

## 1. Supabase — run this SQL in your project

Go to **supabase.com → your project → SQL Editor** and run:

```sql
create table purchases (
  id          bigserial primary key,
  gift_id     integer not null,
  buyer_name  text not null,
  buyer_email text,
  message     text,
  source      text default 'manual',
  purchased_at timestamptz default now(),
  unique (gift_id)   -- one reservation per gift
);

-- Allow the API to insert (service key is used server-side)
alter table purchases enable row level security;
create policy "service role full access" on purchases
  using (true) with check (true);
```

## 2. Vercel — add environment variables

Go to **vercel.com → your project → Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key (Settings → API → service_role) |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` |
| `NOTIFY_EMAIL` | `anthony.ferreyrolles@gmail.com` |
| `FROM_EMAIL` | A verified sender on Resend (e.g. `registry@yourdomain.com` or use Resend's onboarding domain) |
| `ADMIN_PASSWORD` | A password of your choice for `/admin` |
| `CRON_SECRET` | Any random string (e.g. output of `openssl rand -hex 20`) |

## 3. Resend — verify a sender domain

Go to **resend.com → Domains** and either:
- Add your own domain (best), or
- Use the default `onboarding@resend.dev` for testing (change `FROM_EMAIL` accordingly)

## 4. Redeploy

After adding env vars in Vercel, trigger a redeploy:
```
git commit --allow-empty -m "trigger redeploy" && git push
```

## Notes on Amazon sync

The `/api/amazon-sync` cron runs every hour and tries to detect purchased items on the public wishlist page. Amazon's bot protection means this is **best-effort** — it works when Amazon serves the HTML without a CAPTCHA. When it fails, the site still works perfectly via the manual "Réserver ce cadeau" button.
