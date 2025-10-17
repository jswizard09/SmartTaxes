@echo off
REM Quick Setup Script for SmartTaxes (Windows)
REM Run this script to quickly set up the application for development

echo 🚀 Setting up SmartTaxes...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo Visit: https://docs.docker.com/desktop/windows/install/
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    echo Visit: https://docs.docker.com/compose/install/
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ✅ Created .env file
    echo ⚠️  Please edit .env file to add your API keys (OpenAI, Stripe, etc.)
) else (
    echo ✅ .env file already exists
)

REM Create uploads directory
if not exist uploads mkdir uploads
echo ✅ Created uploads directory

REM Start the application
echo 🐳 Starting Docker containers...
docker-compose up -d

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo 🗄️  Running database migrations...
docker-compose exec app npm run db:push

echo.
echo 🎉 Setup complete!
echo.
echo 📱 Your application is now running at:
echo    Frontend: http://localhost:5000
echo    API: http://localhost:5000/api
echo.
echo 🔧 Useful commands:
echo    View logs: docker-compose logs -f
echo    Stop app: docker-compose down
echo    Restart app: docker-compose restart
echo.
echo 📚 For more information, see DEPLOYMENT.md
pause
