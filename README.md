# Leave Management System

A comprehensive leave management system built with Next.js, Node.js, PostgreSQL, and Supabase for authentication and authorization.

## Features

### Leave Management
- Apply for leave with multiple leave types
- Multi-level approval workflow
- Leave balance tracking
- Email notifications on leave application
- Approval page for Admin/HOD
- Leave balance viewing

### Dashboard
- Calendar view of leave days (filterable by employee, location, team, manager)
- Grid view of leave applications
- Statistics and overview
- Ability to block calendar dates for employees (grey out dates)

### Settings
- Calendar creation
- Assign calendars to employees/multiple employees
- Pre-defined calendars can be assigned
- Calendar by geography
- Leave balance and count settings
- Shift management settings

## Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** - Modern, responsive UI
- **Supabase Auth** (SSR)
- **Axios** - API client

### Backend
- **Node.js** with Express
- **PostgreSQL** - Database
- **Supabase** - Authentication and authorization
- **pg** - PostgreSQL client

## Project Structure

```
Leave_Management/
├── frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── app/      # Next.js pages and routes
│   │   ├── components/
│   │   └── lib/      # Utilities and configurations
│   └── package.json
├── backend/           # Node.js backend API
│   ├── src/
│   │   ├── routes/   # API routes
│   │   ├── middleware/
│   │   ├── config/    # Database and Supabase config
│   │   └── server.js
│   ├── database/      # Database schema and migrations
│   └── package.json
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (hosted at 50.116.57.115:5434)
- Supabase account and project

## Setup Instructions

### 1. Database Setup

Run the database schema to create all necessary tables:

```bash
# Connect to your PostgreSQL database
psql -h 50.116.57.115 -p 5434 -U admin -d leave_management

# Run the schema
\i backend/database/schema.sql
```

Or manually execute the SQL in `backend/database/schema.sql`.

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials:
# - Database: 50.116.57.115:5434 (user: admin, password: Consultare@#890)
# - Supabase URL and keys
# - JWT secret

# Start development server
npm run dev
```

The backend will run on `http://localhost:3001`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Edit .env.local with:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_API_URL (http://localhost:3001/api)

# Start development server
npm run dev
```

The frontend will run on `http://localhost:3000`.

## Environment Variables

### Backend (.env)
```env
DB_HOST=50.116.57.115
DB_PORT=5434
DB_NAME=leave_management
DB_USER=admin
DB_PASSWORD=Consultare@#890

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

JWT_SECRET=your_jwt_secret
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Leave Management
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave/my-leaves` - Get user's leave applications
- `GET /api/leave/all` - Get all leave applications (admin/HOD)
- `PATCH /api/leave/:id/approve` - Approve/reject leave
- `GET /api/leave/balance` - Get leave balance

### Dashboard & Calendar
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/calendar/view` - Calendar view with filters
- `POST /api/calendar/block` - Block calendar dates
- `GET /api/calendar/blocked` - Get blocked dates

### Users
- `GET /api/user/employees` - Get all employees
- `GET /api/user/profile` - Get user profile

## Authentication & Authorization

The system uses Supabase for authentication:
- Users authenticate via Supabase Auth
- JWT tokens are used for API authorization
- Role-based access control (admin, hod, manager, employee)
- Protected routes with Next.js middleware

## Database Schema

Key tables:
- `employees` - User information
- `leave_applications` - Leave requests
- `leave_balance` - Leave balances per employee
- `blocked_calendar_dates` - Blocked dates for employees
- `approval_stages` - Multi-level approval configuration
- `calendar_templates` - Calendar templates
- `user_roles` - User role assignments

## Development

### Running Both Services

In separate terminals:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## UI Features

- Modern, responsive design with Tailwind CSS
- Mobile-friendly navigation
- User-friendly forms with validation
- Calendar visualization
- Real-time updates
- Accessible components

## Next Steps

1. Set up Supabase project and get API keys
2. Configure environment variables
3. Run database migrations
4. Start both frontend and backend servers
5. Create your first user account
6. Configure approval workflows

## License

Private - Consultare Projects






