# AGENTS.md — WorkFlow (Staff Tracking & Attendance App)

## Build & Run
- **Mobile (Expo):** `npx expo start` (root). Lint: `npm run lint`. Android: `npm run android`.
- **Admin dashboard (Next.js):** `cd admin && npm run dev`. Lint: `cd admin && npm run lint`. Build: `cd admin && npm run build`.
- **No test suite configured** in either subproject.

## Architecture
- **Root (`/`):** Expo (React Native) mobile app using Expo Router (`app/` dir), NativeWind (Tailwind), and Supabase (auth + Postgres + RLS). Path alias `@/*` maps to repo root.
- **`admin/`:** Separate Next.js 16 web dashboard (shadcn/ui via Radix, Tailwind v4, Recharts, Google Maps). Has its own `package.json` and `node_modules`.
- **`lib/`:** Shared mobile utilities — `supabase.ts` (client), `auth-context.tsx` (React context), `location-service.ts`, `device.ts`, `date-utils.ts`.
- **`supabase/migrations/`:** Numbered SQL migrations. Key tables: `profiles`, `attendance`, `location_logs`, `user_devices`, `teams`, `team_members`.
- **`supabase/functions/`:** Supabase Edge Functions.
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile); `.env.local` (admin).

## Code Style
- TypeScript (`strict: true`). Functional React components with hooks. NativeWind `className` for mobile styling.
- Imports: use `@/` alias (e.g., `@/lib/supabase`). Expo Router for navigation (`useRouter`, `useSegments`).
- Components: PascalCase files (`ActionCard.tsx`); utilities: kebab-case (`date-utils.ts`). Admin uses shadcn/ui conventions (`components/ui/`).
- Roles: `staff`, `manager`, `admin`. Route groups: `auth/`, `(manager)/`, `admin/`. RBAC enforced via Supabase RLS + app-level routing.
