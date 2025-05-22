-- Create language enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_language') THEN
        CREATE TYPE media_language AS ENUM ('EN', 'ES', 'EN/ES', 'OTHER');
    END IF;
END
$$;

-- Proper migration strategy for language column
DO $$
BEGIN
    -- Check if language column needs migration
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'language' 
        AND data_type = 'character varying'
    ) THEN
        -- Create a temporary column with the enum type
        ALTER TABLE media ADD COLUMN language_new media_language;
        
        -- Update the new column based on existing values
        UPDATE media SET language_new = 
            CASE 
                WHEN language = 'EN' THEN 'EN'::media_language
                WHEN language = 'ES' THEN 'ES'::media_language
                WHEN language = 'EN/ES' THEN 'EN/ES'::media_language
                WHEN language = 'OTHER' THEN 'OTHER'::media_language
                ELSE 'EN'::media_language 
            END;
        
        -- Drop the old column
        ALTER TABLE media DROP COLUMN language;
        
        -- Rename the new column to the original name
        ALTER TABLE media RENAME COLUMN language_new TO language;
        
        -- Set the default value
        ALTER TABLE media ALTER COLUMN language SET DEFAULT 'EN'::media_language;
        
        RAISE NOTICE 'Successfully migrated language column from VARCHAR to ENUM';
    ELSE
        -- If column doesn't exist, add it
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'media' 
            AND column_name = 'language'
        ) THEN
            ALTER TABLE media ADD COLUMN language media_language DEFAULT 'EN';
            RAISE NOTICE 'Added new language column with enum type';
        END IF;
    END IF;
END
$$;

-- Set all null values to 'EN'
UPDATE media SET language = 'EN'::media_language WHERE language IS NULL;

-- Create index on language for better performance with filters
CREATE INDEX IF NOT EXISTS idx_media_language ON media(language);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Language field schema updates completed successfully:';
    RAISE NOTICE '- media_language enum created';
    RAISE NOTICE '- language column properly migrated to enum type';
    RAISE NOTICE '- existing media values converted to appropriate enum values';
    RAISE NOTICE '- language index created for improved query performance';
END
$$;