/*
  # Track flashcard creators for quarantine notifications

  `created_by` lets the app notify the original card author when one of their
  cards is put in quarantine.
*/

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE flashcards
SET created_by = decks.owner_id
FROM decks
WHERE flashcards.deck_id = decks.id
  AND flashcards.created_by IS NULL
  AND decks.owner_id IS NOT NULL;
