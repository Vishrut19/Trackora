# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

WorkFlow is a workforce management & live GPS tracking platform with two main services:

| Service | Path | Dev command | Port |
|---------|------|-------------|------|
| Expo Mobile App (Android-first) | `/workspace` | `npm start` / `npm run web` | 8081 |
| Next.js Admin Dashboard | `/workspace/admin` | `npm run dev` | 3000 |

Both connect to a shared cloud-hosted Supabase backend. See `eas.json` for Supabase credentials.

### Environment variables

No `.env` files are committed. For local dev, create:
- `/workspace/.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `/workspace/admin/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Credential values are in `eas.json` under `build.development.env`.

### Lint / Test / Build

- **Root (Expo):** `npm run lint` (uses `expo lint` which runs ESLint)
- **Admin (Next.js):** `npm run lint` from `admin/` (runs ESLint)
- **Admin build:** `npm run build` from `admin/` (Next.js production build)
- No automated test suites exist in either project.

### Known caveats

- **Expo web mode has a pre-existing bundling error**: `react-native-maps` imports native-only modules (`codegenNativeCommands`) that break Metro's web bundler. The Expo app is designed for Android; use the Next.js admin dashboard for web-based development/testing.
- **Next.js admin uses `--webpack` flag** in `npm run dev` because the project also configures Turbopack in `next.config.ts`. The `dev` script in `package.json` already includes this flag.
- Both projects use `package-lock.json` (npm). Run `npm install` in both `/workspace` and `/workspace/admin`.
