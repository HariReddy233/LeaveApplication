# Deployment Guide - Leave Management System

## Pre-Deployment Checklist

### 1. Clean Build Cache
```powershell
cd frontend
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
```

### 2. Install Dependencies
```powershell
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 3. Environment Variables

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://your-server-ip:3001/api/v1
```

#### Backend (.env)
```env
DB_HOST=your-database-host
DB_PORT=5434
DB_NAME=VacationManagement
DB_USER=admin
DB_PASSWORD=your-password
JWT_SECRET=your-jwt-secret
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

### 4. Build Frontend
```powershell
cd frontend
npm run build
```

### 5. Test Production Build Locally
```powershell
cd frontend
npm start
```

### 6. Start Backend
```powershell
cd backend
npm start
```

## Server Deployment Steps

### Option 1: PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd backend
pm2 start src/server.js --name "leave-management-api"

# Start frontend (if running Node.js server)
cd frontend
pm2 start npm --name "leave-management-frontend" -- start
```

### Option 2: Systemd (Linux)
Create service files for both frontend and backend.

### Option 3: Docker
Create Dockerfiles for both frontend and backend.

## Common Issues & Fixes

### Issue: `Cannot find module '_document.js'`
**Solution:** Clear build cache and rebuild
```powershell
cd frontend
Remove-Item -Recurse -Force .next
npm run build
```

### Issue: Build fails with syntax errors
**Solution:** Check all TypeScript/JSX files for syntax errors
```powershell
npm run lint
```

### Issue: Database connection timeout
**Solution:** Check database credentials and network connectivity

## Production Checklist
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Frontend build successful
- [ ] Backend starts without errors
- [ ] API endpoints accessible
- [ ] Authentication working
- [ ] Email notifications configured
- [ ] SSL certificate installed (for HTTPS)

