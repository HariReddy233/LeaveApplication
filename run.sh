#!/bin/bash

# Bash script to run both backend and frontend
# Usage: ./run.sh

echo "Starting Leave Management System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Function to check and install dependencies
check_and_install() {
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
}

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo "Warning: backend/.env file not found!"
    echo "Please create backend/.env with your configuration. See SETUP.md"
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "Warning: frontend/.env.local file not found!"
    echo "Please create frontend/.env.local with your configuration. See SETUP.md"
fi

# Start backend in background
echo "Starting Backend Server..."
cd backend
check_and_install
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend in background
echo "Starting Frontend Server..."
cd frontend
check_and_install
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Both servers are running..."
echo ""
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait






