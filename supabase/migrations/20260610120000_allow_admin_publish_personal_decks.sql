/*
  # Allow admins to publish personal decks

  Admins can read and manage any deck so they can promote a personal deck to a
  public deck from the app. Owners keep control of their own personal decks.
*/

DROP POLICY IF EXISTS "Visible decks are readable" ON decks;
DROP POLICY IF EXISTS "Owners and admins can update decks" ON decks;
DROP POLICY IF EXISTS "Owners and admins can delete decks" ON decks;
DROP POLICY IF EXISTS "Visible flashcards are readable" ON flashcards;
DROP POLICY IF EXISTS "Owners and admins can insert flashcards" ON flashcards;
DROP POLICY IF EXISTS "Owners and admins can update flashcards" ON flashcards;
DROP POLICY IF EXISTS "Owners and admins can delete flashcards" ON flashcards;

CREATE POLICY "Visible decks are readable"
  ON decks FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      visibility = 'public'
      OR owner_id = auth.uid()
      OR public.is_admin()
    )
  );

CREATE POLICY "Owners and admins can update decks"
  ON decks FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR (visibility = 'personal' AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR (visibility = 'personal' AND owner_id = auth.uid())
    )
  );

CREATE POLICY "Owners and admins can delete decks"
  ON decks FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR (visibility = 'personal' AND owner_id = auth.uid())
    )
  );

CREATE POLICY "Visible flashcards are readable"
  ON flashcards FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND auth.uid() IS NOT NULL
        AND (
          public.is_admin()
          OR decks.visibility = 'public'
          OR decks.owner_id = auth.uid()
        )
    )
  );

CREATE POLICY "Owners and admins can insert flashcards"
  ON flashcards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND auth.uid() IS NOT NULL
        AND (
          public.is_admin()
          OR (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
        )
    )
  );

CREATE POLICY "Owners and admins can update flashcards"
  ON flashcards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND auth.uid() IS NOT NULL
        AND (
          public.is_admin()
          OR (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND auth.uid() IS NOT NULL
        AND (
          public.is_admin()
          OR (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
        )
    )
  );

CREATE POLICY "Owners and admins can delete flashcards"
  ON flashcards FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM decks
      WHERE decks.id = flashcards.deck_id
        AND auth.uid() IS NOT NULL
        AND (
          public.is_admin()
          OR (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
        )
    )
  );
