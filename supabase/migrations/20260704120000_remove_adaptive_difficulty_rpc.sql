/*
  # Remove adaptive difficulty from review ratings

  Review ratings should only update personal review progress. Card difficulty remains
  the manually selected value on the flashcard.
*/

DROP FUNCTION IF EXISTS public.adjust_flashcard_difficulty_from_review(uuid, text, integer);
