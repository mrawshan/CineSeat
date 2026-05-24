# CineSeat

A movie theatre seat booking app. Browse showtimes, pick seats (with smart group allocation), and manage movies, screens, and bookings from an admin dashboard.

Built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

## Features

- Browse showtimes and book seats on an interactive seat map
- Seat locking, availability updates, and group seat allocation
- Sign in with email/password or Google (via Supabase Auth)
- Admin area for movies, screens, showtimes, and bookings

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project with the app schema and auth configured

## Local setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` (see below), then:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Environment variables

| Variable                 | Required | Description                               |
| ------------------------ | -------- | ----------------------------------------- |
| `VITE_SUPABASE_URL`      | Yes      | Supabase project URL                      |
| `VITE_SUPABASE_ANON_KEY` | Yes      | Supabase anon (public) key                |
| `VITE_ADMIN_EMAIL`       | No       | Pre-fills login email (local dev only)    |
| `VITE_ADMIN_PASSWORD`    | No       | Pre-fills login password (local dev only) |

Do not set admin email/password on Vercel for production.

In Supabase, add your site URL under **Authentication → URL configuration** (e.g. `http://localhost:5173` for local dev and your Vercel URL after deploy). Google sign-in uses `window.location.origin` as the redirect target.

## Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start dev server                 |
| `npm run build`   | Production build                 |
| `npm run preview` | Preview production build locally |
| `npm run test`    | Run tests                        |
| `npm run lint`    | Run ESLint                       |

## Deploy on Vercel

1. Push the repo to GitHub (or connect your Git provider in Vercel).
2. Import the project in [Vercel](https://vercel.com/new).
3. Vercel should detect **Vite** automatically. If not, use:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Add environment variables in the project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

For client-side routes (`/booking/...`, `/admin`, etc.) to work on refresh, add a `vercel.json` in the project root:

```json
{
	"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

After the first deploy, add your Vercel URL (e.g. `https://your-app.vercel.app`) to Supabase **Authentication → URL configuration** so sign-in redirects work.
