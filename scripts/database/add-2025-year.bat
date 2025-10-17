@echo off
REM Add 2025 tax year migration script for Windows
REM This script adds 2025 tax year data to demonstrate year switching functionality

echo 🚀 Adding 2025 tax year data...

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo ❌ DATABASE_URL environment variable is not set
    echo Please set DATABASE_URL before running this script
    echo Example: set DATABASE_URL=postgresql://user:password@localhost:5432/database
    pause
    exit /b 1
)

REM Run the migration
echo 📊 Running migration: 002_add_2025_tax_year.sql
psql "%DATABASE_URL%" -f migrations/002_add_2025_tax_year.sql

if %errorlevel% equ 0 (
    echo ✅ 2025 tax year data added successfully!
    echo.
    echo 🎯 You can now:
    echo    - Switch between 2024 and 2025 tax years in the UI
    echo    - Create tax returns for different years
    echo    - Upload documents for specific tax years
    echo.
    echo 💡 To test:
    echo    1. Start the application
    echo    2. Use the year selector in the header
    echo    3. Switch between 2024 and 2025
) else (
    echo ❌ Migration failed
    pause
    exit /b 1
)

pause
