# Supabase Setup

This app uses Supabase for three things: **Auth**, **PostgreSQL**, and **private file storage**. No business schema is defined — that is yours to design.

## 1. Create the project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Copy `env.example.txt` to `.env.local`.
3. Fill in the values:

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon/public | Public; only safe because RLS is on |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role | **Secret.** Bypasses RLS |
| `SUPABASE_STORAGE_BUCKET` | You choose | Defaults to `private` |
| `DATABASE_URL` | Settings → Database → Connection string → **Transaction** (port 6543) | Runtime queries |
| `DIRECT_DATABASE_URL` | Same page → **Session** (port 5432) | Migrations only |

The two connection strings are not interchangeable. The transaction pooler cannot run DDL, and the session connection does not survive serverless concurrency.

## 2. Create the users

There is no sign-up screen — this app is built for a small fixed set of users. Create each one in **Authentication → Users → Add user**, with **Auto Confirm User** checked.

Or from the command line:

```bash
node scripts/create-user.mjs someone@example.com 'their-password' admin
```

The third argument is an optional role written to `app_metadata`. The password is read from your shell and is never stored by the script — to keep it out of your shell history, pass it as `NEW_USER_PASSWORD` instead and omit the argument.

**Auto-confirm matters.** Without a sign-up flow there is no confirmation email for anyone to click, so an unconfirmed user can never sign in. The script sets `email_confirm: true` for this reason.

To give someone a role, edit their `app_metadata` (Authentication → Users → ⋯ → Edit):

```json
{ "role": "admin" }
```

Use `app_metadata`, never `user_metadata`. Only the service role key can write `app_metadata`, which is what makes it safe to base authorization on. `user_metadata` is writable by the user's own session and is display-only.

## 3. Create the storage bucket

**Storage → New bucket**, name it to match `SUPABASE_STORAGE_BUCKET`, and leave **Public bucket** switched **off**.

Nothing in the app can make an object public. Reads go exclusively through short-lived signed URLs.

## 4. Run migrations

The schema starts empty. Once you define tables in `src/db/schema/`:

```bash
bun run db:generate
```

```bash
bun run db:migrate
```

`db:push` is available for fast local iteration, but generated migrations are what you want in version control.

> **Every table you create has RLS disabled by default.** Any table the `anon` or `authenticated` roles can reach must have RLS enabled and policies written, or it is readable by anyone holding the anon key.

## How auth is wired

| Piece | File | Role |
| --- | --- | --- |
| Session refresh | `src/proxy.ts` → `src/lib/supabase/middleware.ts` | Rotates the refresh token on every request; redirects unauthenticated traffic away from `/dashboard` |
| Server session | `src/lib/auth/session.ts` | `getCurrentUser()` / `requireUser()` |
| Roles | `src/lib/auth/roles.ts` | Reads `app_metadata` |
| Sign in / out | `src/features/auth/actions/auth-actions.ts` | Server Actions, audited |
| Client session | `src/components/layout/session-provider.tsx` | Server-seeded, no client auth round-trip |

Three rules worth keeping:

1. **Always `getUser()`, never `getSession()`** for an authorization decision. `getSession()` decodes a cookie without verifying it; `getUser()` validates the JWT with Supabase.
2. **The proxy is UX, not security.** Every protected page, Server Action and Route Handler calls `requireUser()` itself. `src/app/dashboard/layout.tsx` does this for all dashboard routes.
3. **Hiding a nav item is not access control.** See [nav-rbac.md](./nav-rbac.md).

## Choosing a client

| Client | Import | RLS | Use for |
| --- | --- | --- | --- |
| Browser | `@/lib/supabase/client` | Enforced | Client Components |
| Server | `@/lib/supabase/server` | Enforced | Server Components, Actions, Route Handlers |
| Admin | `@/lib/supabase/admin` | **Bypassed** | Trusted server work, after your own auth check |
| Drizzle | `@/db` → `getDb()` | **Bypassed** | Typed SQL against your own tables |

`getDb()` and `createAdminClient()` both connect with full privileges. Do your authorization check before you reach for either.

## Deploying to Vercel

Set all six variables in Project Settings → Environment Variables. `DIRECT_DATABASE_URL` is only needed if you run migrations from CI.
