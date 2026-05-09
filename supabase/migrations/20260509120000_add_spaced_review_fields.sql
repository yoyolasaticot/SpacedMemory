/*
  # Add spaced review fields to flashcards

  1. Modified Tables
    - `flashcards`
      - `review_due_at` schedules the next review
      - `review_interval_days` stores the current spacing interval
      - `review_streak` stores consecutive successful easy/correct reviews
      - `last_reviewed_at` stores the latest review timestamp
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flashcards' AND column_name = 'review_due_at'
  ) THEN
    ALTER TABLE flashcards ADD COLUMN review_due_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flashcards' AND column_name = 'review_interval_days'
  ) THEN
    ALTER TABLE flashcards ADD COLUMN review_interval_days integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flashcards' AND column_name = 'review_streak'
  ) THEN
    ALTER TABLE flashcards ADD COLUMN review_streak integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flashcards' AND column_name = 'last_reviewed_at'
  ) THEN
    ALTER TABLE flashcards ADD COLUMN last_reviewed_at timestamptz;
  END IF;
END $$;
