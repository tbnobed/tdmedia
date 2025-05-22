-- Check if the language column exists already
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'language'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        -- Add language column as VARCHAR instead of enum
        ALTER TABLE media ADD COLUMN language VARCHAR(10) DEFAULT 'EN' NOT NULL;
        RAISE NOTICE 'Added language column as VARCHAR to media table';
    ELSE
        RAISE NOTICE 'Language column already exists in media table';
    END IF;
END
$$;

-- Set all existing media to 'EN' language if null
UPDATE media SET language = 'EN' WHERE language IS NULL;

-- Create index on language for better performance with filters
CREATE INDEX IF NOT EXISTS idx_media_language ON media(language);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Language field schema updates completed successfully:';
    RAISE NOTICE '- language column verified/added to media table';
    RAISE NOTICE '- existing media set to default language (EN)';
    RAISE NOTICE '- language index created for improved query performance';
END
$$;