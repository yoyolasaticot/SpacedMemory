/*
  # Add accounts, roles, deck visibility, and secure RLS

  - `profiles` stores the application role for each Supabase auth user.
  - Public decks are readable/playable by signed-in users and editable only by admins.
  - Personal decks are readable/playable/editable only by their owner.
  - Existing decks become public decks after this migration.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'player')
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'player'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decks' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE decks ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decks' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE decks ADD COLUMN visibility text NOT NULL DEFAULT 'public';
  END IF;
END $$;

ALTER TABLE decks
  DROP CONSTRAINT IF EXISTS decks_visibility_check;

ALTER TABLE decks
  ADD CONSTRAINT decks_visibility_check
  CHECK (visibility IN ('public', 'personal'));

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

DROP POLICY IF EXISTS "Allow public read access to decks" ON decks;
DROP POLICY IF EXISTS "Allow public insert to decks" ON decks;
DROP POLICY IF EXISTS "Allow public update to decks" ON decks;
DROP POLICY IF EXISTS "Allow public delete from decks" ON decks;
DROP POLICY IF EXISTS "Allow public read access to flashcards" ON flashcards;
DROP POLICY IF EXISTS "Allow public insert to flashcards" ON flashcards;
DROP POLICY IF EXISTS "Allow public update to flashcards" ON flashcards;
DROP POLICY IF EXISTS "Allow public delete from flashcards" ON flashcards;

DROP POLICY IF EXISTS "Profiles are readable by owner or admin" ON profiles;
DROP POLICY IF EXISTS "Profiles are updatable by owner or admin" ON profiles;
DROP POLICY IF EXISTS "Profiles are updatable by admins" ON profiles;
DROP POLICY IF EXISTS "Visible decks are readable" ON decks;
DROP POLICY IF EXISTS "Users can create allowed decks" ON decks;
DROP POLICY IF EXISTS "Owners and admins can update decks" ON decks;
DROP POLICY IF EXISTS "Owners and admins can delete decks" ON decks;
DROP POLICY IF EXISTS "Visible flashcards are readable" ON flashcards;
DROP POLICY IF EXISTS "Owners and admins can insert flashcards" ON flashcards;
DROP POLICY IF EXISTS "Owners and admins can update flashcards" ON flashcards;
DROP POLICY IF EXISTS "Owners and admins can delete flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can read their review progress" ON review_progress;
DROP POLICY IF EXISTS "Users can insert their review progress" ON review_progress;
DROP POLICY IF EXISTS "Users can update their review progress" ON review_progress;
DROP POLICY IF EXISTS "Users can delete their review progress" ON review_progress;

CREATE POLICY "Profiles are readable by owner or admin"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles are updatable by admins"
  ON profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Visible decks are readable"
  ON decks FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      visibility = 'public'
      OR owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create allowed decks"
  ON decks FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
    AND (
      visibility = 'personal'
      OR (visibility = 'public' AND public.is_admin())
    )
  );

CREATE POLICY "Owners and admins can update decks"
  ON decks FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      (visibility = 'public' AND public.is_admin())
      OR (visibility = 'personal' AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      (visibility = 'public' AND public.is_admin())
      OR (visibility = 'personal' AND owner_id = auth.uid())
    )
  );

CREATE POLICY "Owners and admins can delete decks"
  ON decks FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      (visibility = 'public' AND public.is_admin())
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
          decks.visibility = 'public'
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
          (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
          OR (decks.visibility = 'public' AND public.is_admin())
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
          (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
          OR (decks.visibility = 'public' AND public.is_admin())
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
          (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
          OR (decks.visibility = 'public' AND public.is_admin())
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
          (decks.visibility = 'personal' AND decks.owner_id = auth.uid())
          OR (decks.visibility = 'public' AND public.is_admin())
        )
    )
  );

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
