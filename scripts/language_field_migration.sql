-- Create language enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_language') THEN
        CREATE TYPE media_language AS ENUM ('EN', 'ES', 'EN/ES', 'OTHER');
    END IF;
END
$$;

-- Add language column to media table if it doesn't exist
ALTER TABLE media
ADD COLUMN IF NOT EXISTS language media_language DEFAULT 'EN';

-- Set all existing media to 'EN' language if null
UPDATE media SET language = 'EN' WHERE language IS NULL;

-- Create index on language for better performance with filters
CREATE INDEX IF NOT EXISTS idx_media_language ON media(language);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Language field schema updates completed successfully:';
    RAISE NOTICE '- media_language enum created';
    RAISE NOTICE '- language column added to media table';
    RAISE NOTICE '- existing media set to default language (EN)';
    RAISE NOTICE '- language index created for improved query performance';
END
$$;