import { useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Check, ChevronLeft, RotateCcw } from 'lucide-react';
import { supabase, Deck, Flashcard, ReviewProgress } from '../lib/supabase';

type ReviewView = 'select' | 'review' | 'done';
type Rating = 'again' | 'hard' | 'good' | 'easy';
type ReviewState = 'new' | 'learning' | 'review' | 'relearning';
type FlashcardSummary = Pick<Flashcard, 'id' | 'deck_id'>;

const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const LEARNING_STEPS_MINUTES = [1, 10];
const RELEARNING_STEPS_MINUTES = [10];
const GRADUATING_INTERVAL_DAYS = 1;
const EASY_INTERVAL_DAYS = 4;
const HARD_INTERVAL_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const MAX_INTERVAL_DAYS = 36500;
const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

const REVIEW_OPTIONS: Array<{
  rating: Rating;
  label: string;
  detail: string;
  className: string;
}> = [
  {
    rating: 'again',
    label: 'Rate',
    detail: 'Dans 1 min',
    className: 'bg-rose-600 hover:bg-rose-700',
  },
  {
    rating: 'hard',
    label: 'Difficile',
    detail: 'Intervalle court',
    className: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    rating: 'good',
    label: 'Correct',
    detail: 'Valider',
    className: 'bg-violet-600 hover:bg-violet-700',
  },
  {
    rating: 'easy',
    label: 'Facile',
    detail: 'Avancer',
    className: 'bg-teal-600 hover:bg-teal-700',
  },
];

interface ReviewPageProps {
  user: User;
}

export default function ReviewPage({ user }: ReviewPageProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [dueCountsByDeck, setDueCountsByDeck] = useState<Record<string, number>>({});
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [view, setView] = useState<ReviewView>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [message, setMessage] = useState('');
  const [quarantineModalOpen, setQuarantineModalOpen] = useState(false);
  const [quarantineNote, setQuarantineNote] = useState('');
  const [quarantineError, setQuarantineError] = useState('');

  useEffect(() => {
    loadDecks();
  }, [user.id]);

  const currentCard = cards[currentIndex] ?? null;
  const selectedCount = selectedDeckIds.length;
  const selectedDueCount = selectedDeckIds.reduce(
    (total, deckId) => total + (dueCountsByDeck[deckId] ?? 0),
    0
  );
  const progress = cards.length > 0 ? Math.round((currentIndex / cards.length) * 100) : 0;

  const currentDeckName = useMemo(() => {
    if (!currentCard) return '';
    return decks.find(deck => deck.id === currentCard.deck_id)?.name ?? 'Paquet';
  }, [currentCard, decks]);

  const loadDecks = async () => {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setDecks(data);
    }

    await loadReviewCounts();
  };

  const loadReviewCounts = async () => {
    const data = await fetchActiveFlashcardSummaries();

    if (!data) {
      return;
    }

    const progressByCard = await loadProgressByCard(data.map(card => card.id));
    const now = new Date();

    const nextCounts = data.filter(card => {
      return isCardDue(progressByCard[card.id], now);
    }).reduce<Record<string, number>>((counts, card) => {
      counts[card.deck_id] = (counts[card.deck_id] ?? 0) + 1;
      return counts;
    }, {});

    setDueCountsByDeck(nextCounts);
  };

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds(prev =>
      prev.includes(deckId)
        ? prev.filter(id => id !== deckId)
        : [...prev, deckId]
    );
  };

  const startReview = async () => {
    if (selectedDeckIds.length === 0) return;

    setIsLoading(true);
    setMessage('');

    const data = await fetchActiveFlashcardsByDeck(selectedDeckIds);

    if (!data) {
      setMessage("Impossible de charger les cartes a reviser.");
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setCards([]);
      setMessage('Aucune carte due pour ces paquets.');
      setIsLoading(false);
      return;
    }

    const progressByCard = await loadProgressByCard(data.map(card => card.id));
    const now = new Date();
    const dueCards = data.filter(card => isCardDue(progressByCard[card.id], now));

    if (dueCards.length === 0) {
      setCards([]);
      setMessage('Aucune carte due pour ces paquets.');
      setIsLoading(false);
      return;
    }

    setCards(shuffle(dueCards));
    setCurrentIndex(0);
    setShowAnswer(false);
    setView('review');
    setIsLoading(false);
  };

  const rateCurrentCard = async (rating: Rating) => {
    if (!currentCard || isRating) return;

    setIsRating(true);
    setMessage('');

    try {
      const { data: existingProgress, error: progressError } = await supabase
        .from('review_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('flashcard_id', currentCard.id)
        .maybeSingle();

      if (progressError) {
        setMessage("Impossible de charger la progression de cette carte.");
        return;
      }

      const schedule = getNextSchedule(existingProgress, rating);

      const { error } = await supabase
        .from('review_progress')
        .upsert({
          user_id: user.id,
          flashcard_id: currentCard.id,
          ...schedule,
        });

      if (error) {
        setMessage(getReviewProgressErrorMessage(error.message));
        return;
      }

      await updateEarlyDifficulty(currentCard, rating, schedule.review_count);

      if (currentIndex + 1 >= cards.length) {
        setView('done');
        setShowAnswer(false);
        return;
      }

      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } finally {
      setIsRating(false);
    }
  };

  const quarantineCurrentCard = async () => {
    if (!currentCard) return;

    const note = quarantineNote.trim();
    if (!note) {
      setQuarantineError('Ajoute une note pour expliquer le signalement.');
      return;
    }

    const { error } = await supabase.rpc('quarantine_flashcard_for_review', {
      target_flashcard_id: currentCard.id,
      note,
    });

    if (error) {
      console.error('Quarantine failed', error);
      setQuarantineError(getQuarantineErrorMessage(error.message));
      return;
    }

    const nextCards = cards.filter(card => card.id !== currentCard.id);
    const nextIndex = Math.min(currentIndex, Math.max(0, nextCards.length - 1));

    setCards(nextCards);
    setCurrentIndex(nextIndex);
    setShowAnswer(false);
    setQuarantineModalOpen(false);
    setQuarantineNote('');
    setQuarantineError('');
    setMessage('');
    loadReviewCounts();

    if (nextCards.length === 0) {
      setView('done');
    }
  };

  const updateEarlyDifficulty = async (
    flashcard: Flashcard,
    rating: Rating,
    reviewCount: number
  ) => {
    if (reviewCount > 3) return;

    const { data, error } = await supabase.rpc(
      'adjust_flashcard_difficulty_from_review',
      {
        target_flashcard_id: flashcard.id,
        review_rating: rating,
        player_review_count: reviewCount,
      }
    );

    if (error || typeof data !== 'number') {
      return;
    }

    setCards(prevCards =>
      prevCards.map(card =>
        card.id === flashcard.id
          ? { ...card, difficulty: data }
          : card
      )
    );
  };

  const loadProgressByCard = async (flashcardIds: string[]) => {
    if (flashcardIds.length === 0) {
      return {};
    }

    const progressRows: ReviewProgress[] = [];

    for (const flashcardIdChunk of chunkArray(flashcardIds, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('review_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('flashcard_id', flashcardIdChunk);

      if (error || !data) {
        return {};
      }

      progressRows.push(...data);
    }

    return progressRows.reduce<Record<string, ReviewProgress>>((progressByCard, progress) => {
      progressByCard[progress.flashcard_id] = progress;
      return progressByCard;
    }, {});
  };

  const resetReview = () => {
    setCards([]);
    setCurrentIndex(0);
    setShowAnswer(false);
    setView('select');
    setMessage('');
    setQuarantineModalOpen(false);
    setQuarantineNote('');
    setQuarantineError('');
    loadReviewCounts();
  };

  if (view === 'review' && currentCard) {
    return (
      <div className="min-h-screen app-shell pt-4 pb-24 px-4">
        <button
          onClick={resetReview}
          className="flex items-center text-violet-700 mb-4 font-medium"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          <span>Retour</span>
        </button>

        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-black brand-title">Revision</h1>
            <p className="text-sm text-gray-500">{currentDeckName}</p>
          </div>
          <div className="text-sm font-semibold text-gray-600">
            {currentIndex + 1}/{cards.length}
          </div>
        </div>

        <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--space-teal), var(--space-violet))' }}
          />
        </div>

        <button
          onClick={() => setShowAnswer(true)}
          className="w-full min-h-[320px] app-panel rounded-2xl p-6 flex flex-col justify-center text-center"
        >
          <div className="text-xs font-black text-violet-500 mb-4 tracking-[0.22em]">
            {showAnswer ? 'REPONSE' : 'QUESTION'}
          </div>
          <p className="text-2xl font-bold text-gray-900 leading-relaxed break-words">
            {showAnswer ? currentCard.answer : currentCard.question}
          </p>
        </button>

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="mt-4 w-full py-3 app-primary rounded-lg font-semibold"
          >
            Afficher la reponse
          </button>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {REVIEW_OPTIONS.map(option => (
                <button
                  key={option.rating}
                  onClick={() => rateCurrentCard(option.rating)}
                  disabled={isRating}
                  className={`p-3 rounded-lg text-white text-left transition-colors disabled:opacity-60 disabled:cursor-wait ${option.className}`}
                >
                  <div className="font-bold">{option.label}</div>
                  <div className="text-xs opacity-90">{option.detail}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setQuarantineNote('');
                setQuarantineError('');
                setQuarantineModalOpen(true);
              }}
              className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold"
            >
              Mettre en quarantaine
            </button>
          </div>
        )}

        {message && (
          <p className="mt-4 text-sm text-red-600 text-center">{message}</p>
        )}

        {quarantineModalOpen && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
            <div className="app-panel rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Mettre la carte en quarantaine ?
              </h3>

              <p className="text-sm text-gray-600 mb-4">
                Elle sera retirée des révisions jusqu'à sa relecture par un admin.
              </p>

              <textarea
                value={quarantineNote}
                onChange={(event) => {
                  setQuarantineNote(event.target.value);
                  setQuarantineError('');
                }}
                placeholder="Pourquoi cette carte doit-elle etre relue ?"
                maxLength={400}
                className="w-full min-h-28 px-3 py-2 border rounded-lg outline-none text-sm app-input mb-2"
              />

              {quarantineError && (
                <p className="text-xs text-red-600 mb-3">{quarantineError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={quarantineCurrentCard}
                  disabled={!quarantineNote.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg ${
                    quarantineNote.trim()
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Confirmer
                </button>

                <button
                  onClick={() => {
                    setQuarantineModalOpen(false);
                    setQuarantineNote('');
                    setQuarantineError('');
                  }}
                  className="flex-1 px-4 py-2 app-muted-button rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'done') {
    return (
      <div className="min-h-screen app-shell pt-10 pb-24 px-4 flex items-center">
        <div className="w-full app-panel rounded-2xl p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black brand-title mb-2">Session terminee</h1>
          <p className="text-gray-600 mb-6">
            Les cartes ont ete replanifiees selon tes reponses.
          </p>
          <button
            onClick={resetReview}
            className="w-full py-3 app-primary rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Nouvelle session</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell pt-4 pb-24 px-4">
      <div className="mission-strip p-5 mb-6">
        <div className="relative z-10">
          <h1 className="text-3xl font-black leading-tight">Révision</h1>
          <p className="text-sm text-white/78 mt-2">
            Choisis un ou plusieurs paquets.
          </p>
        </div>
      </div>

      {decks.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          Aucun paquet disponible.
        </p>
      ) : (
        <div className="space-y-2 mb-6">
          {decks.map(deck => {
            const isSelected = selectedDeckIds.includes(deck.id);
            const dueCount = dueCountsByDeck[deck.id] ?? 0;

            return (
              <button
                key={deck.id}
                onClick={() => toggleDeck(deck.id)}
                className={`w-full p-4 rounded-2xl text-left transition-all launch-card ${
                  isSelected ? 'ring-2 ring-violet-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800">{deck.name}</span>
                    <div className="text-xs text-gray-500 mt-1">
                      {dueCount} carte{dueCount > 1 ? 's' : ''} a reviser
                    </div>
                  </div>
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'bg-violet-600 border-violet-600' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={startReview}
        disabled={selectedCount === 0 || isLoading}
        className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
          selectedCount === 0 || isLoading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'app-primary active:brightness-95'
        }`}
      >
        {isLoading
          ? 'Chargement...'
          : selectedCount === 0
            ? 'Selectionne au moins un paquet'
            : `Reviser ${selectedDueCount} carte${selectedDueCount > 1 ? 's' : ''}`}
      </button>

      {message && (
        <p className="mt-4 text-sm text-gray-600 text-center">{message}</p>
      )}
    </div>
  );
}

function getNextSchedule(progress: ReviewProgress | null, rating: Rating) {
  const previousInterval = Math.max(0, progress?.review_interval_days ?? 0);
  const previousStreak = progress?.review_streak ?? 0;
  const reviewCount = (progress?.review_count ?? 0) + 1;
  const previousState: ReviewState = progress?.review_state ?? 'new';
  const previousStep = progress?.learning_step ?? 0;
  const previousEase = Number(progress?.ease_factor ?? INITIAL_EASE_FACTOR);
  const previousLapses = progress?.lapse_count ?? 0;
  const reviewedAt = new Date();
  const schedule = scheduleAnkiStyle({
    rating,
    reviewedAt,
    previousState,
    previousStep,
    previousInterval,
    previousStreak,
    previousEase,
    previousLapses,
  });

  return {
    last_reviewed_at: reviewedAt.toISOString(),
    review_due_at: schedule.nextDueAt.toISOString(),
    review_interval_days: schedule.intervalDays,
    review_streak: schedule.streak,
    review_count: reviewCount,
    review_state: schedule.state,
    learning_step: schedule.learningStep,
    ease_factor: schedule.easeFactor,
    lapse_count: schedule.lapseCount,
  };
}

async function fetchActiveFlashcardSummaries() {
  const cards: FlashcardSummary[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('flashcards')
      .select('id, deck_id')
      .eq('status', 'active')
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error || !data) {
      return null;
    }

    cards.push(...data);

    if (data.length < SUPABASE_PAGE_SIZE) {
      return cards;
    }

    from += SUPABASE_PAGE_SIZE;
  }
}

async function fetchActiveFlashcardsByDeck(deckIds: string[]) {
  const cards: Flashcard[] = [];

  for (const deckIdChunk of chunkArray(deckIds, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .in('deck_id', deckIdChunk)
        .eq('status', 'active')
        .range(from, from + SUPABASE_PAGE_SIZE - 1);

      if (error || !data) {
        return null;
      }

      cards.push(...data);

      if (data.length < SUPABASE_PAGE_SIZE) {
        break;
      }

      from += SUPABASE_PAGE_SIZE;
    }
  }

  return cards;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function scheduleAnkiStyle({
  rating,
  reviewedAt,
  previousState,
  previousStep,
  previousInterval,
  previousStreak,
  previousEase,
  previousLapses,
}: {
  rating: Rating;
  reviewedAt: Date;
  previousState: ReviewState;
  previousStep: number;
  previousInterval: number;
  previousStreak: number;
  previousEase: number;
  previousLapses: number;
}) {
  if (previousState === 'new' || previousState === 'learning') {
    return scheduleLearningCard({
      rating,
      reviewedAt,
      previousStep,
      easeFactor: previousEase,
      lapseCount: previousLapses,
    });
  }

  if (previousState === 'relearning') {
    return scheduleRelearningCard({
      rating,
      reviewedAt,
      previousInterval,
      previousStreak,
      easeFactor: previousEase,
      lapseCount: previousLapses,
    });
  }

  return scheduleReviewCard({
    rating,
    reviewedAt,
    previousInterval,
    previousStreak,
    easeFactor: previousEase,
    lapseCount: previousLapses,
  });
}

function scheduleLearningCard({
  rating,
  reviewedAt,
  previousStep,
  easeFactor,
  lapseCount,
}: {
  rating: Rating;
  reviewedAt: Date;
  previousStep: number;
  easeFactor: number;
  lapseCount: number;
}) {
  if (rating === 'again') {
    return buildSchedule({
      reviewedAt,
      delayMinutes: LEARNING_STEPS_MINUTES[0],
      state: 'learning',
      learningStep: 0,
      intervalDays: 0,
      streak: 0,
      easeFactor,
      lapseCount,
    });
  }

  if (rating === 'hard') {
    return buildSchedule({
      reviewedAt,
      delayMinutes: 6,
      state: 'learning',
      learningStep: Math.max(0, previousStep),
      intervalDays: 0,
      streak: 0,
      easeFactor: clampEase(easeFactor - 0.15),
      lapseCount,
    });
  }

  if (rating === 'good' && previousStep < LEARNING_STEPS_MINUTES.length - 1) {
    const nextStep = previousStep + 1;
    return buildSchedule({
      reviewedAt,
      delayMinutes: LEARNING_STEPS_MINUTES[nextStep],
      state: 'learning',
      learningStep: nextStep,
      intervalDays: 0,
      streak: 0,
      easeFactor,
      lapseCount,
    });
  }

  if (rating === 'easy') {
    return buildSchedule({
      reviewedAt,
      delayDays: EASY_INTERVAL_DAYS,
      state: 'review',
      learningStep: 0,
      intervalDays: EASY_INTERVAL_DAYS,
      streak: 1,
      easeFactor: clampEase(easeFactor + 0.15),
      lapseCount,
    });
  }

  return buildSchedule({
    reviewedAt,
    delayDays: GRADUATING_INTERVAL_DAYS,
    state: 'review',
    learningStep: 0,
    intervalDays: GRADUATING_INTERVAL_DAYS,
    streak: 1,
    easeFactor,
    lapseCount,
  });
}

function scheduleReviewCard({
  rating,
  reviewedAt,
  previousInterval,
  previousStreak,
  easeFactor,
  lapseCount,
}: {
  rating: Rating;
  reviewedAt: Date;
  previousInterval: number;
  previousStreak: number;
  easeFactor: number;
  lapseCount: number;
}) {
  const baseInterval = Math.max(1, previousInterval);

  if (rating === 'again') {
    return buildSchedule({
      reviewedAt,
      delayMinutes: RELEARNING_STEPS_MINUTES[0],
      state: 'relearning',
      learningStep: 0,
      intervalDays: Math.max(1, Math.floor(baseInterval * 0.5)),
      streak: 0,
      easeFactor: clampEase(easeFactor - 0.2),
      lapseCount: lapseCount + 1,
    });
  }

  if (rating === 'hard') {
    const intervalDays = clampInterval(Math.ceil(baseInterval * HARD_INTERVAL_FACTOR));
    return buildSchedule({
      reviewedAt,
      delayDays: intervalDays,
      state: 'review',
      learningStep: 0,
      intervalDays,
      streak: previousStreak + 1,
      easeFactor: clampEase(easeFactor - 0.15),
      lapseCount,
    });
  }

  if (rating === 'easy') {
    const intervalDays = clampInterval(Math.ceil(baseInterval * easeFactor * EASY_BONUS));
    return buildSchedule({
      reviewedAt,
      delayDays: intervalDays,
      state: 'review',
      learningStep: 0,
      intervalDays,
      streak: previousStreak + 1,
      easeFactor: clampEase(easeFactor + 0.15),
      lapseCount,
    });
  }

  const intervalDays = clampInterval(Math.ceil(baseInterval * easeFactor));
  return buildSchedule({
    reviewedAt,
    delayDays: intervalDays,
    state: 'review',
    learningStep: 0,
    intervalDays,
    streak: previousStreak + 1,
    easeFactor,
    lapseCount,
  });
}

function scheduleRelearningCard({
  rating,
  reviewedAt,
  previousInterval,
  previousStreak,
  easeFactor,
  lapseCount,
}: {
  rating: Rating;
  reviewedAt: Date;
  previousInterval: number;
  previousStreak: number;
  easeFactor: number;
  lapseCount: number;
}) {
  if (rating === 'again' || rating === 'hard') {
    return buildSchedule({
      reviewedAt,
      delayMinutes: RELEARNING_STEPS_MINUTES[0],
      state: 'relearning',
      learningStep: 0,
      intervalDays: Math.max(1, previousInterval),
      streak: 0,
      easeFactor: rating === 'hard' ? clampEase(easeFactor - 0.15) : easeFactor,
      lapseCount,
    });
  }

  const intervalDays = rating === 'easy'
    ? clampInterval(Math.max(EASY_INTERVAL_DAYS, Math.ceil(Math.max(1, previousInterval) * easeFactor)))
    : Math.max(GRADUATING_INTERVAL_DAYS, previousInterval);

  return buildSchedule({
    reviewedAt,
    delayDays: intervalDays,
    state: 'review',
    learningStep: 0,
    intervalDays,
    streak: previousStreak + 1,
    easeFactor: rating === 'easy' ? clampEase(easeFactor + 0.15) : easeFactor,
    lapseCount,
  });
}

function buildSchedule({
  reviewedAt,
  delayMinutes,
  delayDays,
  state,
  learningStep,
  intervalDays,
  streak,
  easeFactor,
  lapseCount,
}: {
  reviewedAt: Date;
  delayMinutes?: number;
  delayDays?: number;
  state: Exclude<ReviewState, 'new'>;
  learningStep: number;
  intervalDays: number;
  streak: number;
  easeFactor: number;
  lapseCount: number;
}) {
  const nextDueAt = new Date(reviewedAt);

  if (delayMinutes !== undefined) {
    nextDueAt.setMinutes(nextDueAt.getMinutes() + delayMinutes);
  } else {
    nextDueAt.setDate(nextDueAt.getDate() + (delayDays ?? intervalDays));
  }

  return {
    nextDueAt,
    state,
    learningStep,
    intervalDays: clampInterval(intervalDays),
    streak,
    easeFactor: clampEase(easeFactor),
    lapseCount,
  };
}

function clampEase(easeFactor: number) {
  return Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
}

function clampInterval(intervalDays: number) {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(0, intervalDays));
}

function isCardDue(progress: ReviewProgress | undefined, now: Date) {
  if (!progress?.review_due_at) {
    return true;
  }

  return new Date(progress.review_due_at) <= now;
}

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

function getQuarantineErrorMessage(message: string) {
  if (message.includes('quarantine_flashcard_for_review')) {
    return "La migration de quarantaine n'a pas encore ete appliquee dans Supabase.";
  }

  if (message.includes('quarantine_note') || message.includes('quarantined_')) {
    return "Les champs de quarantaine manquent dans Supabase. Applique la derniere migration.";
  }

  if (message.includes('Authentication required')) {
    return 'Reconnecte-toi avant de signaler une carte.';
  }

  if (message.includes('A quarantine note is required')) {
    return 'Ajoute une note pour expliquer le signalement.';
  }

  if (message.includes('Flashcard is not visible')) {
    return "Cette carte n'est pas accessible avec ce compte.";
  }

  return "La carte n'a pas pu etre mise en quarantaine.";
}

function getReviewProgressErrorMessage(message: string) {
  if (
    message.includes('learning_step')
    || message.includes('ease_factor')
    || message.includes('lapse_count')
    || message.includes('review_state')
  ) {
    return "La migration de revision Anki n'a pas encore ete appliquee dans Supabase.";
  }

  if (message.includes('review_progress')) {
    return "La table de progression de revision n'est pas disponible dans Supabase.";
  }

  return "La note n'a pas pu etre enregistree.";
}
