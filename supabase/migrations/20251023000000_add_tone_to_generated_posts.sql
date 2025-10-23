/*
  # Add tone field to generated_posts table

  1. Changes
    - Add `tone` column to `generated_posts` table to store the tone used for generation
    - Set default value to 'professional'
    - Add constraint to ensure only valid tone values

  2. Purpose
    - Track which tone was used to generate each post
    - Enable better analytics and filtering of generated content
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_posts' AND column_name = 'tone'
  ) THEN
    ALTER TABLE generated_posts ADD COLUMN tone text DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'thought_leader', 'educational', 'promotional'));
  END IF;
END $$;
