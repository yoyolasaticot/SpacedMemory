/*
  # Create Flashcards Application Schema

  1. New Tables
    - `decks`
      - `id` (uuid, primary key)
      - `name` (text, deck name)
      - `created_at` (timestamptz, creation timestamp)
    
    - `flashcards`
      - `id` (uuid, primary key)
      - `deck_id` (uuid, foreign key to decks)
      - `question` (text, flashcard question/front)
      - `answer` (text, flashcard answer/back)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (no auth required for this app)
*/

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to decks"
  ON decks FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to decks"
  ON decks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to decks"
  ON decks FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from decks"
  ON decks FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to flashcards"
  ON flashcards FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to flashcards"
  ON flashcards FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to flashcards"
  ON flashcards FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from flashcards"
  ON flashcards FOR DELETE
  USING (true);