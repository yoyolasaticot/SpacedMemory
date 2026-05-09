/*
  # Add color support to decks

  1. Modified Tables
    - `decks`
      - Add `color` column (text, stores hex color code, default: '#3B82F6')

  2. Details
    - Each deck can now have an associated color
    - Colors are stored as hex codes
    - Default color is blue (#3B82F6)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decks' AND column_name = 'color'
  ) THEN
    ALTER TABLE decks ADD COLUMN color text DEFAULT '#3B82F6';
  END IF;
END $$;
