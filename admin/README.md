This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Scheduled attendance reports (cron)

The app can send daily and monthly attendance CSV reports to all admin emails:

- **Daily report**: Every day at **8 PM IST**, a CSV of that day’s attendance is emailed to every user with `role = 'admin'` and `is_active = true`.
- **Monthly report**: On the **last day of each month** (at 8 PM IST), a cumulative CSV of the full month’s attendance is sent to the same admins.

### Setup

1. **Environment variables** (e.g. in Vercel or `.env.local` for local testing):
   - `CRON_SECRET` – Secret used to authorize cron requests (set in Vercel; Vercel sends it as `Authorization: Bearer <CRON_SECRET>` when invoking the cron).
   - `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (so the cron can read all attendance and profiles).
   - `RESEND_API_KEY` – [Resend](https://resend.com) API key for sending email.
   - `FROM_EMAIL` – Sender address (e.g. `reports@yourdomain.com`). Must be a verified domain in Resend. Defaults to `reports@resend.dev` (Resend sandbox, for testing only).

2. **Vercel**: Deploy the admin app to Vercel. The repo includes `vercel.json` with a cron that hits `/api/cron/reports` at **14:30 UTC** (8 PM IST) every day. Set `CRON_SECRET` in the Vercel project so the cron is authenticated.

3. **Manual trigger** (e.g. for testing):  
   `GET /api/cron/reports` with header `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`. Optional query: `?type=daily` (default), `?type=monthly`, or `?type=all`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
