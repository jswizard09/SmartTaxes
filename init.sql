-- Initialize the SmartTaxes database
-- This file is automatically executed when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE smarttaxes TO smarttaxes_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smarttaxes_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smarttaxes_user;
