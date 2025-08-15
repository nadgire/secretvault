@echo off
echo 🚀 Starting SecretVault Backend Server...
echo.

cd server

echo 📦 Installing dependencies...
call npm install

echo.
echo 🔧 Testing database connection...
node test-connection.js

echo.
echo 🌐 Starting server on http://localhost:3000...
echo 📝 Press Ctrl+C to stop the server
echo.

call npm run dev