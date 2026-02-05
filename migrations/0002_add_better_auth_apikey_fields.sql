-- Migration: Add better-auth API key fields
-- Rename hashed_key to key
ALTER TABLE apikey RENAME COLUMN hashed_key TO key;

-- Make start and prefix nullable  
-- (SQLite doesn't support ALTER COLUMN, so we need to recreate if truly needed, 
-- but we can work around by not having NOT NULL initially)

-- Add new columns
ALTER TABLE apikey ADD COLUMN enabled INTEGER DEFAULT 1;
ALTER TABLE apikey ADD COLUMN rate_limit_enabled INTEGER DEFAULT 1;
ALTER TABLE apikey ADD COLUMN rate_limit_time_window INTEGER;
ALTER TABLE apikey ADD COLUMN rate_limit_max INTEGER;
ALTER TABLE apikey ADD COLUMN request_count INTEGER DEFAULT 0;
ALTER TABLE apikey ADD COLUMN remaining INTEGER;
ALTER TABLE apikey ADD COLUMN refill_interval INTEGER;
ALTER TABLE apikey ADD COLUMN refill_amount INTEGER;
ALTER TABLE apikey ADD COLUMN last_refill_at INTEGER;
ALTER TABLE apikey ADD COLUMN last_request INTEGER;
ALTER TABLE apikey ADD COLUMN permissions TEXT;

-- Create new index
CREATE INDEX IF NOT EXISTS apikey_key_idx ON apikey(key);

-- Drop old index (if exists)
DROP INDEX IF EXISTS apikey_prefix_idx;
