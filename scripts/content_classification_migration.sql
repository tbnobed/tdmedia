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

-- Create index on content_type for better performance with filters
CREATE INDEX IF NOT EXISTS idx_media_content_type ON media(content_type);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Content classification schema updates completed successfully:';
    RAISE NOTICE '- content_type enum created';
    RAISE NOTICE '- content_type column added to media table';
    RAISE NOTICE '- year, season_number, and total_episodes columns added';
    RAISE NOTICE '- content_type index created';
    RAISE NOTICE '- existing media set to default content_type';
END
$$;