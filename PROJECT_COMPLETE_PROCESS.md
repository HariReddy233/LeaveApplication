# Leave Management - Complete Project Process

This document explains the full end-to-end process to set up, run, test, and deploy this project.

## 1. Project Overview

This project has two applications:

- `backend` (Node.js + Express + PostgreSQL)
- `frontend` (Next.js 14 + TypeScript + Tailwind)

Main runtime ports:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

## 2. Prerequisites

Install these first:

1. Node.js 18+ and npm
2. PostgreSQL database access
3. Git
4. (Production) PM2 for process management

Optional but useful:

- PowerShell (Windows) or Bash (Linux/macOS)

## 3. Clone and Install

From project root:

```bash
# backend dependencies
cd backend
npm install

# frontend dependencies
cd ../frontend
npm install

# return to project root
cd ..
```

## 4. Database Setup (Important)

Use your PostgreSQL client (psql, pgAdmin, DBeaver, etc.) and run scripts in a controlled order.

### 4.1 Base schema

Run your base schema first (the one used by your environment).

### 4.2 Required upgrade/feature scripts

From project root, run these as needed for your current environment:

1. `RUN_THESE_SQL_SCRIPTS.sql` (authorizations + leave approval columns)
2. `PERMISSIONS_DATABASE_SCHEMA.sql` (dynamic permissions tables)

If permissions schema already exists and you need safe updates, use one of:

- `PERMISSIONS_MIGRATION_SAFE.sql`
- `PERMISSIONS_QUICK_FIX.sql`
- `PERMISSIONS_DATABASE_SCHEMA_FIXED.sql`

### 4.3 Optional/maintenance SQL files

- `ADD_UPDATE_LEAVE_LIST_PERMISSION.sql`
- `DROP_AUTHORIZATIONS_TABLE.sql` (use only if intentionally dropping)

### 4.4 Holidays configuration

Follow `DATABASE_SETUP_HOLIDAYS.md` to:

1. Ensure users have `country_code` (`US`, `IN`, etc.)
2. Insert country-specific records into `holidays`
3. Verify with SELECT queries

Note: Country-specific holiday creation currently relies on SQL inserts.

## 5. Environment Configuration

## 5.1 Backend env file

Create `backend/.env`.

Start from examples in:

- `backend/ENV_TEMPLATE.txt`
- `README.md`
- `EMAIL_SETUP.md`

Typical required values:

```env
# Database
DB_HOST=...
DB_PORT=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...

# JWT/Auth
JWT_SECRET=...

# Supabase (if enabled in your flow)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...

# App
PORT=3001
FRONTEND_URL=http://localhost:3000

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=...
EMAIL_FROM_NAME=Consultare Leave Management
```

## 5.2 Frontend env file

Create `frontend/.env.local`.

Typical values:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 6. Run Locally

You have 2 options.

### Option A: Start both with helper script

Windows PowerShell:

```powershell
./run.ps1
```

Linux/macOS Bash:

```bash
chmod +x run.sh
./run.sh
```

### Option B: Start manually in two terminals

Terminal 1 (backend):

```bash
cd backend
npm run dev
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

## 7. Functional Verification Checklist

After both apps start:

1. Open frontend at `http://localhost:3000`
2. Test login/auth flow
3. Test leave apply flow
4. Test approval flow (HOD/Admin)
5. Verify permissions page and role-based visibility
6. Verify holiday visibility by `country_code`
7. Verify email sending for leave events

Useful reference docs:

- `EMAIL_AND_APPLY_LEAVE_VERIFICATION.md`
- `PERMISSIONS_IMPLEMENTATION_GUIDE.md`

## 8. Build and Production Start (Manual)

### Frontend

```bash
cd frontend
npm run build
npm start
```

### Backend

```bash
cd backend
npm start
```

If Next.js build issues happen, clear build cache first:

```powershell
cd frontend
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
npm run build
```

## 9. Process Manager (PM2)

Install PM2 globally:

```bash
npm install -g pm2
```

Start services:

```bash
# backend
cd backend
pm2 start src/server.js --name leave-management-api

# frontend
cd ../frontend
pm2 start npm --name leave-management-frontend -- start
```

Common PM2 operations:

```bash
pm2 list
pm2 logs leave-management-api
pm2 logs leave-management-frontend
pm2 restart leave-management-api
pm2 restart leave-management-frontend
```

## 10. CI/CD Deployment Flow (GitHub Actions)

Use `CI_CD_SETUP.md` as the primary guide.

High-level flow:

1. Add SSH key pair for GitHub Actions
2. Add public key to server `authorized_keys`
3. Add GitHub secrets:
   - `SERVER_HOST`
   - `SERVER_USER`
   - `SSH_PRIVATE_KEY`
4. Ensure server paths and PM2 process names match workflow
5. Push to `main` to auto-deploy

Typical server paths used in docs:

- `/var/www/hrportal/backend`
- `/var/www/hrportal/frontend`

## 11. Recommended Day-to-Day Workflow

1. Pull latest code
2. Create/checkout your feature branch
3. Update backend/frontend code
4. Apply any needed SQL migration script
5. Run backend + frontend locally
6. Verify critical flows (auth, leave, approval, permissions)
7. Build frontend once before PR
8. Commit and push
9. Merge to `main` to trigger deployment
10. Monitor GitHub Actions and PM2 logs

## 12. Troubleshooting Quick Guide

- Backend not starting:
  - Check `backend/.env`
  - Check DB connectivity
  - Check port conflicts

- Frontend API errors:
  - Verify `NEXT_PUBLIC_API_URL`
  - Confirm backend is running and route prefix matches

- Permissions not working:
  - Confirm permissions SQL ran successfully
  - Validate user has assigned permissions

- Holidays not filtered by country:
  - Confirm `users.country_code` is set
  - Confirm entries exist in `holidays`

- CI/CD SSH failure:
  - Re-check GitHub secrets and server authorized key

## 13. One-Time Setup Order (Summary)

If setting up from scratch, do this exact order:

1. Install Node.js + PostgreSQL access
2. Clone repo
3. `npm install` in backend and frontend
4. Run DB base schema
5. Run SQL upgrades (`RUN_THESE_SQL_SCRIPTS.sql`, permissions schema)
6. Configure `backend/.env` and `frontend/.env.local`
7. Start local apps (`run.ps1` or manual)
8. Verify core business flows
9. Prepare PM2 + production build
10. Configure CI/CD and push to `main`

---

For deeper detail on any section, open:

- `README.md`
- `DEPLOYMENT_GUIDE.md`
- `CI_CD_SETUP.md`
- `PERMISSIONS_IMPLEMENTATION_GUIDE.md`
- `DATABASE_SETUP_HOLIDAYS.md`
