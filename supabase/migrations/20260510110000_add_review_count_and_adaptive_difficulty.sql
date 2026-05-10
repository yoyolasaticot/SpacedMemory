/*
  # Track early reviews and adapt card difficulty

  - `review_progress.review_count` counts how many times a user has reviewed a card.
  - During a player's first three reviews of a visible card, their rating can adjust the
    shared difficulty: failed/hard answers increase it, easy answers decrease it.
*/

CREATE TABLE IF NOT EXISTS review_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  review_due_at timestamptz,
  review_interval_days integer NOT NULL DEFAULT 0,
  review_streak integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  PRIMARY KEY (user_id, flashcard_id)
);

ALTER TABLE review_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their review progress" ON review_progress;
DROP POLICY IF EXISTS "Users can insert their review progress" ON review_progress;
DROP POLICY IF EXISTS "Users can update their review progress" ON review_progress;
DROP POLICY IF EXISTS "Users can delete their review progress" ON review_progress;

CREATE POLICY "Users can read their review progress"
  ON review_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their review progress"
  ON review_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their review progress"
  ON review_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their review progress"
  ON review_progress FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE review_progress
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.adjust_flashcard_difficulty_from_review(
  target_flashcard_id uuid,
  review_rating text,
  player_review_count integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_difficulty integer;
BEGIN
  SELECT flashcards.difficulty
  INTO next_difficulty
  FROM flashcards
  WHERE flashcards.id = target_flashcard_id
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND (
          decks.visibility = 'public'
          OR decks.owner_id = auth.uid()
        )
    )
  FOR UPDATE;

  IF next_difficulty IS NULL THEN
    RETURN NULL;
  END IF;

  IF player_review_count < 1
    OR player_review_count > 3
    OR review_rating NOT IN ('again', 'hard', 'good', 'easy')
  THEN
    RETURN next_difficulty;
  END IF;

  IF review_rating IN ('again', 'hard') THEN
    next_difficulty := LEAST(5, next_difficulty + 1);
  ELSIF review_rating = 'easy' THEN
    next_difficulty := GREATEST(1, next_difficulty - 1);
  END IF;

  UPDATE flashcards
  SET difficulty = next_difficulty
  WHERE id = target_flashcard_id;

  RETURN next_difficulty;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_flashcard_difficulty_from_review(uuid, text, integer)
TO authenticated;
