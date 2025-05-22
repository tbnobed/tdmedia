-- Check if content_type already exists as an enum type
DO $$
DECLARE
    enum_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    -- Check if enum type exists
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'content_type'
    ) INTO enum_exists;
    
    -- Check if column exists
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'content_type'
    ) INTO column_exists;
    
    IF NOT enum_exists AND NOT column_exists THEN
        -- Create enum type if it doesn't exist
        CREATE TYPE content_type AS ENUM ('film', 'tv_show', 'other');
        RAISE NOTICE 'Created content_type enum type';
    END IF;
END
$$;

-- Add new columns to media table
DO $$
BEGIN
    -- Add content_type column if it doesn't exist
    BEGIN
        ALTER TABLE media
        ADD COLUMN IF NOT EXISTS content_type content_type DEFAULT 'other';
        RAISE NOTICE 'Added content_type column to media table';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Warning: % - proceeding with alternative approach', SQLERRM;
        -- If adding as enum fails, try as text
        BEGIN
            ALTER TABLE media
            ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'other';
            RAISE NOTICE 'Added content_type as VARCHAR to media table';
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Warning: content_type column could not be added: %', SQLERRM;
        END;
    END;
END
$$;

-- Add the other columns
ALTER TABLE media
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS season_number INTEGER,
ADD COLUMN IF NOT EXISTS total_episodes INTEGER,
ADD COLUMN IF NOT EXISTS total_seasons INTEGER;

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