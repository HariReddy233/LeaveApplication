# Leave Management Backend

Backend API server for the Leave Management System built with Node.js and Express.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Update `.env` with your Supabase credentials and database settings.

4. Run database migrations (create tables).

5. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `SUPABASE_ANON_KEY`: Supabase anon key
- `JWT_SECRET`: JWT secret for token signing
- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: Frontend URL for CORS

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Leave Management
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave/my-leaves` - Get my leave applications
- `GET /api/leave/all` - Get all leave applications (admin/HOD)
- `PATCH /api/leave/:id/approve` - Approve/Reject leave
- `GET /api/leave/balance` - Get leave balance

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Calendar
- `GET /api/calendar/view` - Get calendar view with filters
- `POST /api/calendar/block` - Block calendar dates
- `GET /api/calendar/blocked` - Get blocked dates


