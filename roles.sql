--
-- PostgreSQL database initialization script
-- This script creates the readonly user for AI access
--

SET default_transaction_read_only = off;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Create readonly user for AI access
-- Note: Main helix user is created by Docker environment variables
--

-- Create readonly user (will skip if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'helix_readonly') THEN
        CREATE ROLE helix_readonly;
    END IF;
END
$$;

-- Set readonly user properties and password
ALTER ROLE helix_readonly WITH 
    NOSUPERUSER 
    INHERIT 
    NOCREATEROLE 
    NOCREATEDB 
    LOGIN 
    NOREPLICATION 
    NOBYPASSRLS 
    PASSWORD 'a_very_secure_password_for_ai';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE helix_dev TO helix_readonly;
GRANT USAGE ON SCHEMA public TO helix_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO helix_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO helix_readonly;

-- Ensure future tables are also readable
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO helix_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO helix_readonly;






--
-- PostgreSQL database cluster dump complete
--

