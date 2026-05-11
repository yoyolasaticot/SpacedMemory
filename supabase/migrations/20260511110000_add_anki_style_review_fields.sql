/*
  # Add Anki-style scheduling fields

  These fields let each user's review progress track a learning/review/relearning
  state, a learning step, an ease factor, and lapse count.
*/

ALTER TABLE review_progress
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS learning_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ease_factor numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS lapse_count integer NOT NULL DEFAULT 0;

ALTER TABLE review_progress
  DROP CONSTRAINT IF EXISTS review_progress_review_state_check,
  ADD CONSTRAINT review_progress_review_state_check
  CHECK (review_state IN ('learning', 'review', 'relearning'));
