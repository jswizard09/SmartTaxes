-- Add 2023 tax year migration script
-- This migration adds 2023 tax year data

-- Insert 2023 tax year
INSERT INTO tax_years (year, is_active, federal_deadline, state_deadlines) VALUES
(2023, FALSE, '2023-04-18', '{"CA": "2023-04-18", "NY": "2023-04-18", "TX": null}')
ON CONFLICT (year) DO NOTHING;

-- Get the tax year ID for 2023
DO $$
DECLARE
    tax_year_2023_id VARCHAR;
BEGIN
    SELECT id INTO tax_year_2023_id FROM tax_years WHERE year = 2023;
    
    IF tax_year_2023_id IS NOT NULL THEN
        -- Insert federal tax brackets for 2023 (actual 2023 values)
        INSERT INTO federal_tax_brackets (tax_year_id, filing_status, min_income, max_income, tax_rate) VALUES
        (tax_year_2023_id, 'single', 0, 11000, 0.10),
        (tax_year_2023_id, 'single', 11000, 44725, 0.12),
        (tax_year_2023_id, 'single', 44725, 95375, 0.22),
        (tax_year_2023_id, 'single', 95375, 182050, 0.24),
        (tax_year_2023_id, 'single', 182050, 231250, 0.32),
        (tax_year_2023_id, 'single', 231250, 578125, 0.35),
        (tax_year_2023_id, 'single', 578125, NULL, 0.37),
        
        (tax_year_2023_id, 'married_joint', 0, 22000, 0.10),
        (tax_year_2023_id, 'married_joint', 22000, 89450, 0.12),
        (tax_year_2023_id, 'married_joint', 89450, 190750, 0.22),
        (tax_year_2023_id, 'married_joint', 190750, 364200, 0.24),
        (tax_year_2023_id, 'married_joint', 364200, 462500, 0.32),
        (tax_year_2023_id, 'married_joint', 462500, 693750, 0.35),
        (tax_year_2023_id, 'married_joint', 693750, NULL, 0.37),
        
        (tax_year_2023_id, 'married_separate', 0, 11000, 0.10),
        (tax_year_2023_id, 'married_separate', 11000, 44725, 0.12),
        (tax_year_2023_id, 'married_separate', 44725, 95375, 0.22),
        (tax_year_2023_id, 'married_separate', 95375, 182050, 0.24),
        (tax_year_2023_id, 'married_separate', 182050, 231250, 0.32),
        (tax_year_2023_id, 'married_separate', 231250, 346875, 0.35),
        (tax_year_2023_id, 'married_separate', 346875, NULL, 0.37),
        
        (tax_year_2023_id, 'head_of_household', 0, 15700, 0.10),
        (tax_year_2023_id, 'head_of_household', 15700, 59850, 0.12),
        (tax_year_2023_id, 'head_of_household', 59850, 95350, 0.22),
        (tax_year_2023_id, 'head_of_household', 95350, 182050, 0.24),
        (tax_year_2023_id, 'head_of_household', 182050, 231250, 0.32),
        (tax_year_2023_id, 'head_of_household', 231250, 578100, 0.35),
        (tax_year_2023_id, 'head_of_household', 578100, NULL, 0.37)
        ON CONFLICT DO NOTHING;

        -- Insert federal standard deductions for 2023 (actual 2023 values)
        INSERT INTO federal_standard_deductions (tax_year_id, filing_status, amount, additional_blind_amount, additional_disabled_amount) VALUES
        (tax_year_2023_id, 'single', 13850, 1800, 1800),
        (tax_year_2023_id, 'married_joint', 27700, 1800, 1800),
        (tax_year_2023_id, 'married_separate', 13850, 1800, 1800),
        (tax_year_2023_id, 'head_of_household', 20800, 1800, 1800)
        ON CONFLICT DO NOTHING;

        -- Insert state tax brackets for CA and NY (2023 values)
        INSERT INTO state_tax_brackets (tax_year_id, state_code, filing_status, min_income, max_income, tax_rate) VALUES
        -- California 2023 brackets
        (tax_year_2023_id, 'CA', 'single', 0, 10099, 0.01),
        (tax_year_2023_id, 'CA', 'single', 10099, 23942, 0.02),
        (tax_year_2023_id, 'CA', 'single', 23942, 37788, 0.04),
        (tax_year_2023_id, 'CA', 'single', 37788, 52455, 0.06),
        (tax_year_2023_id, 'CA', 'single', 52455, 66295, 0.08),
        (tax_year_2023_id, 'CA', 'single', 66295, 338639, 0.093),
        (tax_year_2023_id, 'CA', 'single', 338639, 406364, 0.103),
        (tax_year_2023_id, 'CA', 'single', 406364, 677275, 0.113),
        (tax_year_2023_id, 'CA', 'single', 677275, NULL, 0.123),
        
        -- New York 2023 brackets
        (tax_year_2023_id, 'NY', 'single', 0, 8500, 0.04),
        (tax_year_2023_id, 'NY', 'single', 8500, 11700, 0.045),
        (tax_year_2023_id, 'NY', 'single', 11700, 13900, 0.0525),
        (tax_year_2023_id, 'NY', 'single', 13900, 21400, 0.059),
        (tax_year_2023_id, 'NY', 'single', 21400, 80650, 0.0621),
        (tax_year_2023_id, 'NY', 'single', 80650, 215400, 0.0649),
        (tax_year_2023_id, 'NY', 'single', 215400, 1077550, 0.0685),
        (tax_year_2023_id, 'NY', 'single', 1077550, NULL, 0.0882)
        ON CONFLICT DO NOTHING;

        -- Insert state standard deductions for 2023
        INSERT INTO state_standard_deductions (tax_year_id, state_code, filing_status, amount) VALUES
        (tax_year_2023_id, 'CA', 'single', 5202),
        (tax_year_2023_id, 'CA', 'married_joint', 10404),
        (tax_year_2023_id, 'CA', 'married_separate', 5202),
        (tax_year_2023_id, 'CA', 'head_of_household', 10404),
        (tax_year_2023_id, 'NY', 'single', 8000),
        (tax_year_2023_id, 'NY', 'married_joint', 16000),
        (tax_year_2023_id, 'NY', 'married_separate', 8000),
        (tax_year_2023_id, 'NY', 'head_of_household', 11000)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE '2023 tax data added successfully';
    ELSE
        RAISE NOTICE '2023 tax year not found, skipping data insertion';
    END IF;
END $$;
