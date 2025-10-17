#!/bin/bash

# Database Migration Runner for SmartTaxes
# This script helps you run the tax configuration migration

echo "🚀 SmartTaxes Database Migration"
echo "================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set your database URL first:"
    echo "export DATABASE_URL='postgresql://username:password@localhost:5432/database_name'"
    echo ""
    echo "Or create a .env file with:"
    echo "DATABASE_URL=postgresql://username:password@localhost:5432/database_name"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo "📊 Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/')"

# Check if migration file exists
if [ ! -f "migrations/001_add_tax_configuration_tables.sql" ]; then
    echo "❌ Migration file not found: migrations/001_add_tax_configuration_tables.sql"
    exit 1
fi

echo "✅ Migration file found"

# Run the migration
echo ""
echo "🔄 Running migration..."
echo "This will create the following tables:"
echo "  - tax_years"
echo "  - federal_tax_brackets"
echo "  - federal_standard_deductions"
echo "  - state_tax_brackets"
echo "  - state_standard_deductions"
echo "  - form_schemas"
echo "  - form_field_definitions"
echo "  - app_configurations"
echo ""

# Use psql to run the migration
if command -v psql &> /dev/null; then
    echo "📝 Running migration with psql..."
    psql "$DATABASE_URL" -f migrations/001_add_tax_configuration_tables.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Migration completed successfully!"
        echo ""
        echo "✅ Your database now has:"
        echo "   - 2024 tax brackets and deductions"
        echo "   - California and New York state tax data"
        echo "   - Default application configurations"
        echo "   - Form schema support"
        echo ""
        echo "🚀 You can now start your application:"
        echo "   npm run dev"
    else
        echo ""
        echo "❌ Migration failed. Please check the error messages above."
        exit 1
    fi
else
    echo "❌ psql command not found"
    echo ""
    echo "Please install PostgreSQL client tools or use an alternative method:"
    echo ""
    echo "1. Install PostgreSQL client:"
    echo "   - Windows: Download from https://www.postgresql.org/download/windows/"
    echo "   - macOS: brew install postgresql"
    echo "   - Linux: sudo apt-get install postgresql-client"
    echo ""
    echo "2. Or use a database GUI tool like pgAdmin, DBeaver, or TablePlus"
    echo "   to run the migration file manually"
    echo ""
    echo "3. Or use Docker:"
    echo "   docker run --rm -i postgres:15 psql \$DATABASE_URL < migrations/001_add_tax_configuration_tables.sql"
    exit 1
fi
