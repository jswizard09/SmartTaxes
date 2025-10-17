-- Add additional tax years for testing year switching functionality
-- This migration adds 2025 tax year data

-- Insert 2025 tax year
INSERT INTO tax_years (year, is_active, federal_deadline, state_deadlines) VALUES
(2025, FALSE, '2025-04-15', '{"CA": "2025-04-15", "NY": "2025-04-15", "TX": null}')
ON CONFLICT (year) DO NOTHING;

-- Get the tax year ID for 2025
DO $$
DECLARE
    tax_year_2025_id VARCHAR;
BEGIN
    SELECT id INTO tax_year_2025_id FROM tax_years WHERE year = 2025;
    
    IF tax_year_2025_id IS NOT NULL THEN
        -- Insert federal tax brackets for 2025 (using 2024 values as placeholder)
        INSERT INTO federal_tax_brackets (tax_year_id, filing_status, min_income, max_income, tax_rate) VALUES
        (tax_year_2025_id, 'single', 0, 11600, 0.10),
        (tax_year_2025_id, 'single', 11600, 47150, 0.12),
        (tax_year_2025_id, 'single', 47150, 100525, 0.22),
        (tax_year_2025_id, 'single', 100525, 191950, 0.24),
        (tax_year_2025_id, 'single', 191950, 243725, 0.32),
        (tax_year_2025_id, 'single', 243725, 609350, 0.35),
        (tax_year_2025_id, 'single', 609350, NULL, 0.37),
        
        (tax_year_2025_id, 'married_joint', 0, 23200, 0.10),
        (tax_year_2025_id, 'married_joint', 23200, 94300, 0.12),
        (tax_year_2025_id, 'married_joint', 94300, 201050, 0.22),
        (tax_year_2025_id, 'married_joint', 201050, 383900, 0.24),
        (tax_year_2025_id, 'married_joint', 383900, 487450, 0.32),
        (tax_year_2025_id, 'married_joint', 487450, 731200, 0.35),
        (tax_year_2025_id, 'married_joint', 731200, NULL, 0.37),
        
        (tax_year_2025_id, 'married_separate', 0, 11600, 0.10),
        (tax_year_2025_id, 'married_separate', 11600, 47150, 0.12),
        (tax_year_2025_id, 'married_separate', 47150, 100525, 0.22),
        (tax_year_2025_id, 'married_separate', 100525, 191950, 0.24),
        (tax_year_2025_id, 'married_separate', 191950, 243725, 0.32),
        (tax_year_2025_id, 'married_separate', 243725, 365600, 0.35),
        (tax_year_2025_id, 'married_separate', 365600, NULL, 0.37),
        
        (tax_year_2025_id, 'head_of_household', 0, 16550, 0.10),
        (tax_year_2025_id, 'head_of_household', 16550, 63100, 0.12),
        (tax_year_2025_id, 'head_of_household', 63100, 100500, 0.22),
        (tax_year_2025_id, 'head_of_household', 100500, 191950, 0.24),
        (tax_year_2025_id, 'head_of_household', 191950, 243700, 0.32),
        (tax_year_2025_id, 'head_of_household', 243700, 609350, 0.35),
        (tax_year_2025_id, 'head_of_household', 609350, NULL, 0.37)
        ON CONFLICT DO NOTHING;

        -- Insert federal standard deductions for 2025
        INSERT INTO federal_standard_deductions (tax_year_id, filing_status, amount, additional_blind_amount, additional_disabled_amount) VALUES
        (tax_year_2025_id, 'single', 14600, 1850, 1850),
        (tax_year_2025_id, 'married_joint', 29200, 1850, 1850),
        (tax_year_2025_id, 'married_separate', 14600, 1850, 1850),
        (tax_year_2025_id, 'head_of_household', 21900, 1850, 1850)
        ON CONFLICT DO NOTHING;

        -- Insert state tax brackets for CA and NY (2025)
        INSERT INTO state_tax_brackets (tax_year_id, state_code, filing_status, min_income, max_income, tax_rate) VALUES
        -- California 2025 brackets (using 2024 values as placeholder)
        (tax_year_2025_id, 'CA', 'single', 0, 10099, 0.01),
        (tax_year_2025_id, 'CA', 'single', 10099, 23942, 0.02),
        (tax_year_2025_id, 'CA', 'single', 23942, 37788, 0.04),
        (tax_year_2025_id, 'CA', 'single', 37788, 52455, 0.06),
        (tax_year_2025_id, 'CA', 'single', 52455, 66295, 0.08),
        (tax_year_2025_id, 'CA', 'single', 66295, 338639, 0.093),
        (tax_year_2025_id, 'CA', 'single', 338639, 406364, 0.103),
        (tax_year_2025_id, 'CA', 'single', 406364, 677275, 0.113),
        (tax_year_2025_id, 'CA', 'single', 677275, NULL, 0.123),
        
        -- New York 2025 brackets (using 2024 values as placeholder)
        (tax_year_2025_id, 'NY', 'single', 0, 8500, 0.04),
        (tax_year_2025_id, 'NY', 'single', 8500, 11700, 0.045),
        (tax_year_2025_id, 'NY', 'single', 11700, 13900, 0.0525),
        (tax_year_2025_id, 'NY', 'single', 13900, 21400, 0.059),
        (tax_year_2025_id, 'NY', 'single', 21400, 80650, 0.0621),
        (tax_year_2025_id, 'NY', 'single', 80650, 215400, 0.0649),
        (tax_year_2025_id, 'NY', 'single', 215400, 1077550, 0.0685),
        (tax_year_2025_id, 'NY', 'single', 1077550, NULL, 0.0882)
        ON CONFLICT DO NOTHING;

        -- Insert state standard deductions for 2025
        INSERT INTO state_standard_deductions (tax_year_id, state_code, filing_status, amount) VALUES
        (tax_year_2025_id, 'CA', 'single', 5202),
        (tax_year_2025_id, 'CA', 'married_joint', 10404),
        (tax_year_2025_id, 'CA', 'married_separate', 5202),
        (tax_year_2025_id, 'CA', 'head_of_household', 10404),
        (tax_year_2025_id, 'NY', 'single', 8000),
        (tax_year_2025_id, 'NY', 'married_joint', 16000),
        (tax_year_2025_id, 'NY', 'married_separate', 8000),
        (tax_year_2025_id, 'NY', 'head_of_household', 11000)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE '2025 tax data added successfully';
    ELSE
        RAISE NOTICE '2025 tax year not found, skipping data insertion';
    END IF;
END $$;
