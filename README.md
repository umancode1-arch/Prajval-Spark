# Prajval Spark

A level-based government exam practice app built with Next.js and Supabase.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL, anon or publishable key, and server-only service-role key.
3. In the Supabase Dashboard for the **same project URL configured in `.env.local`**, open **SQL Editor → New query**, paste the entire contents of this repository's `supabase-schema.sql`, and click **Run**. This creates the `tests` table used by the dashboard and upgrades the original `tests` and `questions` tables. The catalog table exposes test metadata publicly so visitors can browse both free and premium papers; question rows remain restricted by access policies.
   - If Supabase reports that `public.tests` is missing from the schema cache after the SQL succeeds, run `NOTIFY pgrst, 'reload schema';` in the SQL Editor and reload the app.
4. In Supabase **Authentication → Providers → Email**, enable email/password authentication. Email confirmation can remain enabled; new users will need to follow Supabase's confirmation email before their first password sign-in.
5. Start the app with `npm run dev`.

Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable or commit real environment values.

## Temporary premium-access testing

Razorpay is paused and its API routes return HTTP 410 by default. For local testing, set `NEXT_PUBLIC_PREMIUM_DEMO_ACCESS_ENABLED=true` in `.env.local` and restart the app. A signed-in user can then open any premium bundle and select **I've paid — request access**. This immediately records an approved access row and launches the first test in that bundle; no payment is collected or verified. The PhonePe QR is informational only in this mode. **Never enable this flow in production.** Keep the flag disabled for production deployments and restore payment verification before live sales. Razorpay credentials are not needed for this temporary access flow.

When ready to test Razorpay again, configure its keys and set `RAZORPAY_CHECKOUT_ENABLED=true` in the server environment, then restart the app.

## Provision an administrator

1. Create the administrator's account at `/signup` with their email and password. Complete email confirmation if it is enabled in Supabase.
2. In the Supabase SQL editor, add that account to the protected administrator roster:

   ```sql
   insert into public.exam_admins (user_id)
   select id from auth.users
   where lower(email) = lower('admin@example.com')
   on conflict (user_id) do nothing;
   ```

Only a project owner with SQL editor access can provision administrators. The admin page checks this database role, and row-level security protects question paper changes and expert replies.

Accounts created with the previous email-code flow may not have a password yet. Use **Forgot password?** on the sign-in page to set one.

## Practice and support

The dashboard includes free 10th-pass, 12th-pass, and graduate mock tests. Questions are served without answer keys; the authenticated grading endpoint returns the score, metrics, answer key, and solutions only after submission. Attempts for database-backed papers are stored in Supabase. Local-device mock history is associated with the verified email in that browser.

Community messages are shared with signed-in students. Expert conversations are private to the student who started them and administrators; expert replies require the protected administrator role. The schema script enables realtime updates for chat when the Supabase realtime publication is available.
