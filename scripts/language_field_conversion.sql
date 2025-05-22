-- Safely convert language column from ENUM to VARCHAR without data loss
DO $$
DECLARE
    enum_exists BOOLEAN;
    using_enum BOOLEAN;
    column_type TEXT;
BEGIN
    -- Check if the enum type exists
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'media_language'
    ) INTO enum_exists;

    -- Get current column type
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'media' AND column_name = 'language'
    INTO column_type;
    
    -- Check if we're using an enum for the language column
    SELECT (column_type = 'USER-DEFINED' OR column_type = 'enum') INTO using_enum;
    
    RAISE NOTICE 'Language column status: enum_exists=%, column_type=%, using_enum=%', 
                 enum_exists, column_type, using_enum;
    
    IF enum_exists AND using_enum THEN
        RAISE NOTICE 'Converting language column from ENUM to VARCHAR...';
        
        -- First create a backup of the language values
        CREATE TEMP TABLE media_language_backup AS
        SELECT id, language::text AS language_value
        FROM media;
        
        RAISE NOTICE 'Backed up % language values', (SELECT COUNT(*) FROM media_language_backup);
        
        -- Alter the column to use VARCHAR instead of ENUM
        ALTER TABLE media 
        ALTER COLUMN language TYPE VARCHAR(10) USING language::text;
        
        RAISE NOTICE 'Successfully converted language column to VARCHAR';
        
        -- Now we can safely drop the enum type if needed
        DROP TYPE IF EXISTS media_language;
        RAISE NOTICE 'Dropped enum type media_language';
        
        -- Verify the data was preserved
        UPDATE media m
        SET language = b.language_value
        FROM media_language_backup b
        WHERE m.id = b.id
        AND m.language IS NULL;
        
        -- Set default for any null values
        UPDATE media SET language = 'EN' WHERE language IS NULL;
        
        -- Drop the temporary table
        DROP TABLE media_language_backup;
    ELSIF column_type = 'character varying' THEN
        RAISE NOTICE 'Language column is already VARCHAR, no conversion needed';
    ELSE
        RAISE NOTICE 'Cannot determine current language column type. Manual intervention required.';
    END IF;
END
$$;

-- Make sure we have the right index for language column
DROP INDEX IF EXISTS idx_media_language;
CREATE INDEX IF NOT EXISTS idx_media_language ON media(language);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Language field conversion completed';
END
$$;