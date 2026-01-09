DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_accounts' AND column_name = 'photo') THEN 
        ALTER TABLE social_accounts ADD COLUMN photo TEXT; 
    END IF; 
END $$;
