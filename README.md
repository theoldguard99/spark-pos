# SPARK POS Dashboard

A web-based Point of Sale dashboard for small and growing businesses.

SPARK includes order management, product inventory, coupons, reports, employee management, and role-based access controls, built with React, TypeScript, Vite, and Supabase.

## Tech Stack

- React 19 + TypeScript
- Vite 5
- Tailwind CSS 4
- TanStack Query
- Supabase (Auth, Database, Storage, Edge Functions)

## Features

- Dashboard with sales and operational insights
- POS order flow (cash, card, GCash support flow)
- Product and inventory management
- Coupon management with usage/expiry rules
- Reports and transaction logs
- Employee management
- Store Access Directory for role- and user-level permissions
- Reusable UI primitives (`Table`, `Button`, `Modal`, `Snackbar`, `SegmentedControl`)

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm 9+
- Supabase project (for full functionality)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Start development server:

```bash
npm run dev
```

4. Open app:

- Default Vite URL: `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start local dev server
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run supabase` - Run Supabase CLI

## Environment Notes

- If Supabase variables are missing, the app runs in limited/demo mode in some screens.
- Ensure redirect URLs are configured in Supabase Auth for email and OAuth flows.

## Deployment

Build the app:

```bash
npm run build
```

Deploy the generated `dist/` folder to your hosting provider (Netlify, Vercel, static hosting, etc.).

## Project Structure (high level)

- `src/pages` - Route screens
- `src/components` - Reusable and feature UI components
- `src/context` - App-level providers (auth, toast/snackbar)
- `src/hooks` - Custom hooks (including access directory logic)
- `src/lib` - Shared clients/config (Supabase)
- `supabase` - SQL migrations and Edge Functions

## License

Choose your preferred license (commonly MIT for open source).
