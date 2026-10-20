-- Cycle review: the prototype offers four ways to continue (stay, new, lead, break).
-- Widens circle_reviews.next_choice. The app falls back gracefully until this is applied.
ALTER TABLE public.circle_reviews DROP CONSTRAINT IF EXISTS circle_reviews_next_choice_check;
ALTER TABLE public.circle_reviews
  ADD CONSTRAINT circle_reviews_next_choice_check
  CHECK (next_choice IS NULL OR next_choice IN ('join','break','stay','new','lead'));
