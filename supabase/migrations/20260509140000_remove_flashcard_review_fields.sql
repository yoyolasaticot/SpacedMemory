/*
  # Remove shared review fields from flashcards

  Review scheduling is personal per user and now lives in `review_progress`.
  The flashcards table should only store the shared card content.
*/

ALTER TABLE flashcards
  DROP COLUMN IF EXISTS review_due_at,
  DROP COLUMN IF EXISTS review_interval_days,
  DROP COLUMN IF EXISTS review_streak,
  DROP COLUMN IF EXISTS last_reviewed_at;
