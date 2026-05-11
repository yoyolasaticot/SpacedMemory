import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string | null;
  role: 'admin' | 'player';
  created_at: string;
}

export interface Deck {
  id: string;
  name: string;
  color: string;
  owner_id: string | null;
  visibility: 'public' | 'personal';
  created_at: string;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  question: string;
  answer: string;
  difficulty: number;
  status: 'active' | 'quarantine';
  quarantine_note: string | null;
  quarantined_by: string | null;
  quarantined_at: string | null;
  created_at: string;
}

export interface ReviewProgress {
  user_id: string;
  flashcard_id: string;
  review_due_at: string | null;
  review_interval_days: number;
  review_streak: number;
  review_count: number;
  last_reviewed_at: string | null;
}
