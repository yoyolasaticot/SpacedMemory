/*
  # Add difficulty level to flashcards

  1. Modified Tables
    - `flashcards`
      - Add `difficulty` column (integer, 1-5, default: 1)

  2. Details
    - Difficulty level from 1 (easiest) to 5 (hardest)
    - Default difficulty is 1 (blue)
    - 1 = Blue, 2 = Green, 3 = Yellow, 4 = Orange, 5 = Red
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flashcards' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE flashcards ADD COLUMN difficulty integer DEFAULT 1;
  END IF;
END $$;
