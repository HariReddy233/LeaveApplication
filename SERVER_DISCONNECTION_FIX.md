# Server Disconnection Fix

## Problem
Server was disconnecting within 30 seconds due to database connection timeout settings.

## Solutions Implemented

### 1. Database Connection Timeout Fix
**File**: `backend/src/config/database.js`

**Changes**:
- Increased `idleTimeoutMillis` from 30 seconds to 10 minutes (600000ms)
- Increased `connectionTimeoutMillis` from 30 seconds to 60 seconds
- Disabled `statement_timeout` and `query_timeout` (set to 0)
- Added immediate keep-alive (`keepAliveInitialDelayMillis: 0`)
- Added minimum pool size (`min: 2`)
- Added periodic health checks every 30 seconds

### 2. PM2 Ecosystem Configuration
**Files**: 
- `backend/ecosystem.config.js`
- `frontend/ecosystem.config.js`

**Features**:
- Auto-restart on crashes
- Memory limit protection (500MB backend, 1GB frontend)
- Logging to files
- Graceful shutdown handling
- Process monitoring

### 3. Enhanced Server Error Handling
**File**: `backend/src/server.js`

**Improvements**:
- Graceful shutdown handling (SIGTERM, SIGINT)
- Uncaught exception handling (doesn't crash the process)
- Unhandled promise rejection handling
- Enhanced health check endpoint with database status
- PM2 ready signal

### 4. Updated CI/CD Pipeline
**File**: `.github/workflows/deploy.yml`

**Updates**:
- Uses PM2 ecosystem config files
- Saves PM2 configuration for auto-start on reboot
- Shows recent logs after deployment

## How to Apply the Fix

### On Your Server

1. **SSH into your server**:
   ```bash
   ssh root@50.116.57.115
   ```

2. **Navigate to backend directory**:
   ```bash
   cd /var/www/hrportal/backend
   ```

3. **Pull the latest changes**:
   ```bash
   git pull origin main
   ```

4. **Install dependencies** (if needed):
   ```bash
   npm install --production
   ```

5. **Create logs directory**:
   ```bash
   mkdir -p logs
   ```

6. **Restart with PM2 using ecosystem config**:
   ```bash
   pm2 restart ecosystem.config.js
   # Or if not running:
   pm2 start ecosystem.config.js
   ```

7. **Save PM2 configuration**:
   ```bash
   pm2 save
   ```

8. **Check status**:
   ```bash
   pm2 list
   pm2 logs hrportal-backend --lines 50
   ```

### For Frontend

1. **Navigate to frontend directory**:
   ```bash
   cd /var/www/hrportal/frontend
   ```

2. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

3. **Install and build**:
   ```bash
   npm install
   npm run build
   ```

4. **Create logs directory**:
   ```bash
   mkdir -p logs
   ```

5. **Restart with PM2**:
   ```bash
   pm2 restart ecosystem.config.js
   # Or if not running:
   pm2 start ecosystem.config.js
   ```

6. **Save PM2 configuration**:
   ```bash
   pm2 save
   ```

## Verification

### Check Server Health
```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Should return:
# {"status":"ok","message":"Server is running","database":"connected","timestamp":"..."}
```

### Monitor PM2 Processes
```bash
# List all processes
pm2 list

# View logs
pm2 logs hrportal-backend
pm2 logs hrportal-frontend

# Monitor in real-time
pm2 monit
```

### Check Database Connection
The server now performs health checks every 30 seconds. Check logs:
```bash
pm2 logs hrportal-backend | grep "health check"
```

## What Changed

### Before
- Database connections timed out after 30 seconds of inactivity
- No automatic reconnection
- No process monitoring
- Server could crash on errors

### After
- Database connections stay alive for 10 minutes
- Automatic health checks every 30 seconds
- PM2 auto-restarts on crashes
- Better error handling (doesn't crash on errors)
- Graceful shutdown support
- Process monitoring and logging

## Troubleshooting

### If server still disconnects:

1. **Check PM2 logs**:
   ```bash
   pm2 logs hrportal-backend --err
   ```

2. **Check database connectivity**:
   ```bash
   # From server
   psql -h 50.116.57.115 -p 5434 -U admin -d VacationManagement -c "SELECT 1;"
   ```

3. **Check PM2 process status**:
   ```bash
   pm2 status
   pm2 info hrportal-backend
   ```

4. **Restart PM2 processes**:
   ```bash
   pm2 restart all
   ```

5. **Check system resources**:
   ```bash
   free -h
   df -h
   top
   ```

## Next Steps

After applying these fixes, the server should:
- ✅ Stay connected without 30-second disconnections
- ✅ Auto-restart if it crashes
- ✅ Handle errors gracefully
- ✅ Maintain database connections
- ✅ Provide health monitoring

The CI/CD pipeline will automatically apply these fixes on the next deployment!

