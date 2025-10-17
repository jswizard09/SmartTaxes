@echo off
REM Database Migration Runner for SmartTaxes (Windows)
REM This script helps you run the tax configuration migration

echo 🚀 SmartTaxes Database Migration
echo ================================

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo ❌ DATABASE_URL environment variable is not set
    echo.
    echo Please set your database URL first:
    echo set DATABASE_URL=postgresql://username:password@localhost:5432/database_name
    echo.
    echo Or create a .env file with:
    echo DATABASE_URL=postgresql://username:password@localhost:5432/database_name
    pause
    exit /b 1
)

echo ✅ DATABASE_URL is set
echo 📊 Database: %DATABASE_URL%

REM Check if migration file exists
if not exist "migrations\001_add_tax_configuration_tables.sql" (
    echo ❌ Migration file not found: migrations\001_add_tax_configuration_tables.sql
    pause
    exit /b 1
)

echo ✅ Migration file found

REM Run the migration
echo.
echo 🔄 Running migration...
echo This will create the following tables:
echo   - tax_years
echo   - federal_tax_brackets
echo   - federal_standard_deductions
echo   - state_tax_brackets
echo   - state_standard_deductions
echo   - form_schemas
echo   - form_field_definitions
echo   - app_configurations
echo.

REM Use psql to run the migration
where psql >nul 2>nul
if %errorlevel% equ 0 (
    echo 📝 Running migration with psql...
    psql "%DATABASE_URL%" -f migrations\001_add_tax_configuration_tables.sql
    
    if %errorlevel% equ 0 (
        echo.
        echo 🎉 Migration completed successfully!
        echo.
        echo ✅ Your database now has:
        echo    - 2024 tax brackets and deductions
        echo    - California and New York state tax data
        echo    - Default application configurations
        echo    - Form schema support
        echo.
        echo 🚀 You can now start your application:
        echo    npm run dev
    ) else (
        echo.
        echo ❌ Migration failed. Please check the error messages above.
        pause
        exit /b 1
    )
) else (
    echo ❌ psql command not found
    echo.
    echo Please install PostgreSQL client tools or use an alternative method:
    echo.
    echo 1. Install PostgreSQL client:
    echo    - Download from https://www.postgresql.org/download/windows/
    echo    - Or use Chocolatey: choco install postgresql
    echo.
    echo 2. Or use a database GUI tool like pgAdmin, DBeaver, or TablePlus
    echo    to run the migration file manually
    echo.
    echo 3. Or use Docker:
    echo    docker run --rm -i postgres:15 psql %DATABASE_URL% ^< migrations\001_add_tax_configuration_tables.sql
    pause
    exit /b 1
)

pause
