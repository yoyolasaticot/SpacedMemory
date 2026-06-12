/*
  # Add community boards

  Community boards are shared game boards created by signed-in users.
  Everyone can read them, and each creator can maintain their own boards.
*/

CREATE TABLE IF NOT EXISTS community_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  tiles jsonb NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE community_boards
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE community_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community boards are readable" ON community_boards;
DROP POLICY IF EXISTS "Users can create community boards" ON community_boards;
DROP POLICY IF EXISTS "Creators and admins can update community boards" ON community_boards;
DROP POLICY IF EXISTS "Creators and admins can delete community boards" ON community_boards;
DROP POLICY IF EXISTS "Creators can update community boards" ON community_boards;
DROP POLICY IF EXISTS "Creators can delete community boards" ON community_boards;

CREATE POLICY "Community boards are readable"
  ON community_boards FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create community boards"
  ON community_boards FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

CREATE POLICY "Creators can update community boards"
  ON community_boards FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

CREATE POLICY "Creators can delete community boards"
  ON community_boards FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );
