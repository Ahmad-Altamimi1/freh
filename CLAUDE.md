# CLAUDE.md

This is a Next.js 16 + shadcn/ui admin dashboard starter kit.

## Key References

- **[AGENTS.md](./AGENTS.md)** — Full project overview, tech stack, structure, conventions, data fetching patterns, deployment
- **[docs/forms.md](./docs/forms.md)** — Form system: TanStack Form + Zod, composable fields, validation, multi-step, sheet/dialog forms
- **[docs/themes.md](./docs/themes.md)** — Theme system: OKLCH colors, adding themes, font config
- **[docs/nav-rbac.md](./docs/nav-rbac.md)** — Navigation RBAC: access control via Supabase `app_metadata`
- **[docs/supabase-setup.md](./docs/supabase-setup.md)** — Supabase Auth, PostgreSQL/Drizzle, storage bucket, environment variables
- **[docs/audit-logging.md](./docs/audit-logging.md)** — Generic audit logging: actions, sinks, connecting to a real table
- **[docs/storage.md](./docs/storage.md)** — Private file storage: upload, signed URLs, replace/delete

## Critical Conventions

- **Auth** — Supabase Auth. `requireUser()` from `@/lib/auth/session` at the top of every protected page/action; always `getUser()`, never `getSession()`, for an authorization decision. The proxy (`src/proxy.ts`) is a UX redirect, not the security boundary
- **Database schema is owned by the user** — `src/db/schema/` is intentionally empty. Do NOT create business tables, migrations, or models unless explicitly asked
- **Supabase clients** — `@/lib/supabase/client` (browser), `@/lib/supabase/server` (RSC/actions, RLS enforced), `@/lib/supabase/admin` (service role, RLS bypassed — auth-check first), `getDb()` from `@/db` (Drizzle, RLS bypassed)
- **Files** — use the generic helpers in `@/lib/storage`; never add entity-specific wrappers like `uploadProductImage()`
- **React Query** for all data fetching — `void prefetchQuery()` on server + `useSuspenseQuery` on client (standard TanStack pattern), `useMutation` for forms, `HydrationBoundary` + `dehydrate` for hydration, `<Suspense fallback>` for streaming
- **API layer** per feature — `api/types.ts` → `api/service.ts` → `api/queries.ts`; queries use key factories (`entityKeys.all/list/detail`); components import from service and queries, never from mock APIs directly
- **nuqs** for URL search params — `searchParamsCache` on server, `useQueryStates` on client, use `getSortingStateParser` for sort (same parser as `useDataTable`)
- **Icons** — only import from `@/components/icons`, never from `@tabler/icons-react` directly
- **Forms** — use `useAppForm` + `useFormFields<T>()` from `@/components/ui/tanstack-form`
- **Page headers** — use `PageContainer` props (`pageTitle`, `pageDescription`, `pageHeaderAction`), never import `<Heading>` manually
- **Formatting** — single quotes, JSX single quotes, no trailing comma, 2-space indent
