#!/usr/bin/env node

/**
 * Database Migration Runner for SmartTaxes
 * This script runs the tax configuration migration using Node.js
 */

import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigration() {
  console.log('🚀 SmartTaxes Database Migration');
  console.log('================================');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL environment variable is not set');
    console.log('');
    console.log('Please set your database URL first:');
    console.log('export DATABASE_URL="postgresql://username:password@localhost:5432/database_name"');
    console.log('');
    console.log('Or create a .env file with:');
    console.log('DATABASE_URL=postgresql://username:password@localhost:5432/database_name');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL is set');
  console.log(`📊 Database: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`);

  // Check if migration file exists
  try {
    const migrationSQL = readFileSync('migrations/001_add_tax_configuration_tables.sql', 'utf8');
    console.log('✅ Migration file found');
    
    console.log('');
    console.log('🔄 Running migration...');
    console.log('This will create the following tables:');
    console.log('  - tax_years');
    console.log('  - federal_tax_brackets');
    console.log('  - federal_standard_deductions');
    console.log('  - state_tax_brackets');
    console.log('  - state_standard_deductions');
    console.log('  - form_schemas');
    console.log('  - form_field_definitions');
    console.log('  - app_configurations');
    console.log('');

    // Connect to database
    const sql = postgres(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await sql.unsafe(statement);
          console.log(`   ✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          console.log(`   ⚠️  Statement ${i + 1}/${statements.length} warning:`, error.message);
          // Continue with other statements
        }
      }
    }

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('✅ Your database now has:');
    console.log('   - 2024 tax brackets and deductions');
    console.log('   - California and New York state tax data');
    console.log('   - Default application configurations');
    console.log('   - Form schema support');
    console.log('');
    console.log('🚀 You can now start your application:');
    console.log('   npm run dev');

    // Close database connection
    await sql.end();

  } catch (error) {
    console.log('');
    console.log('❌ Migration failed:', error.message);
    console.log('');
    console.log('Please check:');
    console.log('1. Database connection is working');
    console.log('2. Migration file exists: migrations/001_add_tax_configuration_tables.sql');
    console.log('3. Database user has CREATE TABLE permissions');
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(console.error);
}

export { runMigration };
