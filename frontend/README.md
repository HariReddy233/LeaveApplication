# Leave Management Frontend

Next.js frontend application for the Leave Management System with Supabase authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and configure:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3001/api)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Modern, user-friendly UI with Tailwind CSS
- Supabase authentication (login/register/logout)
- Protected routes with middleware
- Dashboard with statistics
- Leave application management
- Calendar view with filters
- Multi-level approval workflow
- Responsive design

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/              # Utilities and configurations
└── middleware.ts     # Next.js middleware for auth
```

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Supabase Auth (SSR)
- Axios for API calls






