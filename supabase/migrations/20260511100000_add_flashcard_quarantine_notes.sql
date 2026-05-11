/*
  # Add quarantine notes for flashcards

  Players can flag visible public cards for admin review without receiving broad
  update permissions on public decks.
*/

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS quarantine_note text,
  ADD COLUMN IF NOT EXISTS quarantined_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz;

CREATE OR REPLACE FUNCTION public.quarantine_flashcard_for_review(
  target_flashcard_id uuid,
  note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(BTRIM(note), '') IS NULL THEN
    RAISE EXCEPTION 'A quarantine note is required';
  END IF;

  UPDATE flashcards
  SET
    status = 'quarantine',
    quarantine_note = BTRIM(note),
    quarantined_by = auth.uid(),
    quarantined_at = now()
  WHERE flashcards.id = target_flashcard_id
    AND EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND (
          decks.visibility = 'public'
          OR decks.owner_id = auth.uid()
        )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flashcard is not visible';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quarantine_flashcard_for_review(uuid, text)
TO authenticated;
