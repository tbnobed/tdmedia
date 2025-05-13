-- Create content_type enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
        CREATE TYPE content_type AS ENUM ('film', 'tv_show', 'other');
    END IF;
END
$$;

-- Add new columns to media table
ALTER TABLE media
ADD COLUMN IF NOT EXISTS content_type content_type DEFAULT 'other',
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS season_number INTEGER,
ADD COLUMN IF NOT EXISTS total_episodes INTEGER;

-- Set all existing media to 'other' content type
UPDATE media SET content_type = 'other' WHERE content_type IS NULL;