-- Migration: Add Tax Configuration Tables
-- This migration adds tables for dynamic tax configuration, form schemas, and application settings

-- Tax Years table
CREATE TABLE IF NOT EXISTS tax_years (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT FALSE,
    federal_deadline TEXT,
    state_deadlines JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Federal Tax Brackets table
CREATE TABLE IF NOT EXISTS federal_tax_brackets (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_year_id VARCHAR NOT NULL REFERENCES tax_years(id),
    filing_status TEXT NOT NULL,
    min_income DECIMAL(12,2) NOT NULL,
    max_income DECIMAL(12,2),
    tax_rate DECIMAL(5,4) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Federal Standard Deductions table
CREATE TABLE IF NOT EXISTS federal_standard_deductions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_year_id VARCHAR NOT NULL REFERENCES tax_years(id),
    filing_status TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    additional_blind_amount DECIMAL(12,2) DEFAULT 0,
    additional_disabled_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- State Tax Brackets table
CREATE TABLE IF NOT EXISTS state_tax_brackets (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_year_id VARCHAR NOT NULL REFERENCES tax_years(id),
    state_code TEXT NOT NULL,
    filing_status TEXT NOT NULL,
    min_income DECIMAL(12,2) NOT NULL,
    max_income DECIMAL(12,2),
    tax_rate DECIMAL(5,4) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- State Standard Deductions table
CREATE TABLE IF NOT EXISTS state_standard_deductions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_year_id VARCHAR NOT NULL REFERENCES tax_years(id),
    state_code TEXT NOT NULL,
    filing_status TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Form Schemas table
CREATE TABLE IF NOT EXISTS form_schemas (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type TEXT NOT NULL,
    tax_year_id VARCHAR NOT NULL REFERENCES tax_years(id),
    schema_version TEXT NOT NULL DEFAULT '1.0',
    fields JSONB NOT NULL,
    validation_rules JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Form Field Definitions table
CREATE TABLE IF NOT EXISTS form_field_definitions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    form_schema_id VARCHAR NOT NULL REFERENCES form_schemas(id),
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    validation_pattern TEXT,
    min_length INTEGER,
    max_length INTEGER,
    min_value DECIMAL(12,2),
    max_value DECIMAL(12,2),
    default_value TEXT,
    options JSONB,
    "order" INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Application Configurations table
CREATE TABLE IF NOT EXISTS app_configurations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    config_type TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_federal_tax_brackets_tax_year_filing_status ON federal_tax_brackets(tax_year_id, filing_status);
CREATE INDEX IF NOT EXISTS idx_federal_standard_deductions_tax_year_filing_status ON federal_standard_deductions(tax_year_id, filing_status);
CREATE INDEX IF NOT EXISTS idx_state_tax_brackets_tax_year_state_filing_status ON state_tax_brackets(tax_year_id, state_code, filing_status);
CREATE INDEX IF NOT EXISTS idx_state_standard_deductions_tax_year_state_filing_status ON state_standard_deductions(tax_year_id, state_code, filing_status);
CREATE INDEX IF NOT EXISTS idx_form_schemas_form_type_tax_year ON form_schemas(form_type, tax_year_id);
CREATE INDEX IF NOT EXISTS idx_form_field_definitions_form_schema_id ON form_field_definitions(form_schema_id);
CREATE INDEX IF NOT EXISTS idx_app_configurations_config_key ON app_configurations(config_key);

-- Insert default application configurations
INSERT INTO app_configurations (config_key, config_value, config_type, description) VALUES
('file_upload_max_size', '10485760', 'number', 'Maximum file upload size in bytes (10MB)'),
('file_upload_allowed_types', '["pdf", "jpg", "jpeg", "png", "csv", "xlsx"]', 'array', 'Allowed file types for upload'),
('llm_default_model', '"gpt-4"', 'string', 'Default LLM model for document parsing'),
('llm_max_tokens', '2000', 'number', 'Maximum tokens for LLM requests'),
('llm_temperature', '0.1', 'number', 'LLM temperature setting'),
('parsing_confidence_threshold', '0.7', 'number', 'Minimum confidence threshold for parsing'),
('tax_year_default', '2024', 'number', 'Default tax year'),
('supported_states', '["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI"]', 'array', 'States with tax support')
ON CONFLICT (config_key) DO NOTHING;

-- Insert 2024 tax year
INSERT INTO tax_years (year, is_active, federal_deadline, state_deadlines) VALUES
(2024, TRUE, '2024-04-15', '{"CA": "2024-04-15", "NY": "2024-04-15", "TX": null}')
ON CONFLICT (year) DO NOTHING;

-- Get the tax year ID for 2024
DO $$
DECLARE
    tax_year_2024_id VARCHAR;
BEGIN
    SELECT id INTO tax_year_2024_id FROM tax_years WHERE year = 2024;
    
    IF tax_year_2024_id IS NOT NULL THEN
        -- Insert federal tax brackets for 2024
        INSERT INTO federal_tax_brackets (tax_year_id, filing_status, min_income, max_income, tax_rate) VALUES
        -- Single
        (tax_year_2024_id, 'single', 0, 11600, 0.10),
        (tax_year_2024_id, 'single', 11600, 47150, 0.12),
        (tax_year_2024_id, 'single', 47150, 100525, 0.22),
        (tax_year_2024_id, 'single', 100525, 191950, 0.24),
        (tax_year_2024_id, 'single', 191950, 243725, 0.32),
        (tax_year_2024_id, 'single', 243725, 609350, 0.35),
        (tax_year_2024_id, 'single', 609350, NULL, 0.37),
        
        -- Married Joint
        (tax_year_2024_id, 'married_joint', 0, 23200, 0.10),
        (tax_year_2024_id, 'married_joint', 23200, 94300, 0.12),
        (tax_year_2024_id, 'married_joint', 94300, 201050, 0.22),
        (tax_year_2024_id, 'married_joint', 201050, 383900, 0.24),
        (tax_year_2024_id, 'married_joint', 383900, 487450, 0.32),
        (tax_year_2024_id, 'married_joint', 487450, 731200, 0.35),
        (tax_year_2024_id, 'married_joint', 731200, NULL, 0.37),
        
        -- Married Separate
        (tax_year_2024_id, 'married_separate', 0, 11600, 0.10),
        (tax_year_2024_id, 'married_separate', 11600, 47150, 0.12),
        (tax_year_2024_id, 'married_separate', 47150, 100525, 0.22),
        (tax_year_2024_id, 'married_separate', 100525, 191950, 0.24),
        (tax_year_2024_id, 'married_separate', 191950, 243725, 0.32),
        (tax_year_2024_id, 'married_separate', 243725, 365600, 0.35),
        (tax_year_2024_id, 'married_separate', 365600, NULL, 0.37),
        
        -- Head of Household
        (tax_year_2024_id, 'head_of_household', 0, 16550, 0.10),
        (tax_year_2024_id, 'head_of_household', 16550, 63100, 0.12),
        (tax_year_2024_id, 'head_of_household', 63100, 100500, 0.22),
        (tax_year_2024_id, 'head_of_household', 100500, 191950, 0.24),
        (tax_year_2024_id, 'head_of_household', 191950, 243700, 0.32),
        (tax_year_2024_id, 'head_of_household', 243700, 609350, 0.35),
        (tax_year_2024_id, 'head_of_household', 609350, NULL, 0.37)
        ON CONFLICT DO NOTHING;
        
        -- Insert federal standard deductions for 2024
        INSERT INTO federal_standard_deductions (tax_year_id, filing_status, amount) VALUES
        (tax_year_2024_id, 'single', 14600),
        (tax_year_2024_id, 'married_joint', 29200),
        (tax_year_2024_id, 'married_separate', 14600),
        (tax_year_2024_id, 'head_of_household', 21900)
        ON CONFLICT DO NOTHING;
        
        -- Insert state tax brackets for CA and NY (2024)
        INSERT INTO state_tax_brackets (tax_year_id, state_code, filing_status, min_income, max_income, tax_rate) VALUES
        -- California Single
        (tax_year_2024_id, 'CA', 'single', 0, 10099, 0.01),
        (tax_year_2024_id, 'CA', 'single', 10099, 23942, 0.02),
        (tax_year_2024_id, 'CA', 'single', 23942, 37788, 0.04),
        (tax_year_2024_id, 'CA', 'single', 37788, 52455, 0.06),
        (tax_year_2024_id, 'CA', 'single', 52455, 66295, 0.08),
        (tax_year_2024_id, 'CA', 'single', 66295, 338639, 0.093),
        (tax_year_2024_id, 'CA', 'single', 338639, 406364, 0.103),
        (tax_year_2024_id, 'CA', 'single', 406364, 677275, 0.113),
        (tax_year_2024_id, 'CA', 'single', 677275, NULL, 0.123),
        
        -- New York Single
        (tax_year_2024_id, 'NY', 'single', 0, 8500, 0.04),
        (tax_year_2024_id, 'NY', 'single', 8500, 11700, 0.045),
        (tax_year_2024_id, 'NY', 'single', 11700, 13900, 0.0525),
        (tax_year_2024_id, 'NY', 'single', 13900, 21400, 0.059),
        (tax_year_2024_id, 'NY', 'single', 21400, 80650, 0.0621),
        (tax_year_2024_id, 'NY', 'single', 80650, 215400, 0.0649),
        (tax_year_2024_id, 'NY', 'single', 215400, 1077550, 0.0685),
        (tax_year_2024_id, 'NY', 'single', 1077550, NULL, 0.0882)
        ON CONFLICT DO NOTHING;
        
        -- Insert state standard deductions for CA and NY
        INSERT INTO state_standard_deductions (tax_year_id, state_code, filing_status, amount) VALUES
        (tax_year_2024_id, 'CA', 'single', 5202),
        (tax_year_2024_id, 'CA', 'married_joint', 10404),
        (tax_year_2024_id, 'CA', 'married_separate', 5202),
        (tax_year_2024_id, 'CA', 'head_of_household', 10404),
        (tax_year_2024_id, 'NY', 'single', 8000),
        (tax_year_2024_id, 'NY', 'married_joint', 16000),
        (tax_year_2024_id, 'NY', 'married_separate', 8000),
        (tax_year_2024_id, 'NY', 'head_of_household', 11000)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

COMMENT ON TABLE tax_years IS 'Tax years configuration with deadlines';
COMMENT ON TABLE federal_tax_brackets IS 'Federal tax brackets by year and filing status';
COMMENT ON TABLE federal_standard_deductions IS 'Federal standard deductions by year and filing status';
COMMENT ON TABLE state_tax_brackets IS 'State tax brackets by year, state, and filing status';
COMMENT ON TABLE state_standard_deductions IS 'State standard deductions by year, state, and filing status';
COMMENT ON TABLE form_schemas IS 'Dynamic form schemas for different tax forms';
COMMENT ON TABLE form_field_definitions IS 'Field definitions for form schemas';
COMMENT ON TABLE app_configurations IS 'Application-wide configuration settings';
