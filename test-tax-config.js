#!/usr/bin/env node

/**
 * Test script for Tax Configuration API endpoints
 * Run this after starting the server to verify the new endpoints work
 */

const API_BASE = 'http://localhost:5000/api';

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   GET ${endpoint}`);
    
    const response = await fetch(`${API_BASE}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`   ✅ Success:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return null;
  }
}

async function testTaxCalculation() {
  try {
    console.log(`\n🧪 Testing: Tax Calculation`);
    console.log(`   GET /api/tax-config/calculate/2024/single?income=50000`);
    
    const response = await fetch(`${API_BASE}/tax-config/calculate/2024/single?income=50000`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`   ✅ Tax Calculation Result:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return null;
  }
}

async function testStateTaxCalculation() {
  try {
    console.log(`\n🧪 Testing: State Tax Calculation`);
    console.log(`   GET /api/tax-config/state-calculate/2024/single/CA?income=50000`);
    
    const response = await fetch(`${API_BASE}/tax-config/state-calculate/2024/single/CA?income=50000`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`   ✅ State Tax Calculation Result:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return null;
  }
}

async function testAppConfiguration() {
  try {
    console.log(`\n🧪 Testing: Application Configuration`);
    console.log(`   GET /api/config/tax_year_default`);
    
    const response = await fetch(`${API_BASE}/config/tax_year_default`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`   ✅ App Configuration Result:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Tax Configuration API Tests');
  console.log('=====================================');
  
  // Test basic endpoints
  await testEndpoint('/tax-config/years', 'Get All Tax Years');
  await testEndpoint('/tax-config/active-year', 'Get Active Tax Year');
  
  // Test tax calculations
  await testTaxCalculation();
  await testStateTaxCalculation();
  
  // Test configuration
  await testAppConfiguration();
  
  console.log('\n🎉 Tests completed!');
  console.log('\n📝 Next Steps:');
  console.log('   1. Run the migration: psql -d your_database -f migrations/001_add_tax_configuration_tables.sql');
  console.log('   2. Start your server: npm run dev');
  console.log('   3. Run this test: node test-tax-config.js');
  console.log('   4. Check the browser - the header should show the current tax year dynamically');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, testTaxCalculation, testStateTaxCalculation, testAppConfiguration };
