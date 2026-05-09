import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, RotateCcw } from 'lucide-react';
import { supabase, Deck, Flashcard } from '../lib/supabase';

type ReviewView = 'select' | 'review' | 'done';
type Rating = 'again' | 'hard' | 'good' | 'easy';

const REVIEW_OPTIONS: Array<{
  rating: Rating;
  label: string;
  detail: string;
  className: string;
}> = [
  {
    rating: 'again',
    label: 'Rate',
    detail: 'Prochaine session',
    className: 'bg-red-600 hover:bg-red-700',
  },
  {
    rating: 'hard',
    label: 'Difficile',
    detail: 'Dans 6 heures',
    className: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    rating: 'good',
    label: 'Correct',
    detail: 'Demain',
    className: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    rating: 'easy',
    label: 'Facile',
    detail: 'Dans 2 jours',
    className: 'bg-green-600 hover:bg-green-700',
  },
];

export default function ReviewPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [view, setView] = useState<ReviewView>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDecks();
  }, []);

  const currentCard = cards[currentIndex] ?? null;
  const selectedCount = selectedDeckIds.length;
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

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .in('deck_id', selectedDeckIds)
      .eq('status', 'active')
      .or(`review_due_at.is.null,review_due_at.lte.${now}`)
      .order('review_due_at', { ascending: true, nullsFirst: true });

    setIsLoading(false);

    if (error) {
      setMessage("Impossible de charger les cartes a reviser.");
      return;
    }

    if (!data || data.length === 0) {
      setCards([]);
      setMessage('Aucune carte due pour ces paquets.');
      return;
    }

    setCards(shuffle(data));
    setCurrentIndex(0);
    setShowAnswer(false);
    setView('review');
  };

  const rateCurrentCard = async (rating: Rating) => {
    if (!currentCard) return;

    const schedule = getNextSchedule(currentCard, rating);

    const { error } = await supabase
      .from('flashcards')
      .update(schedule)
      .eq('id', currentCard.id);

    if (error) {
      setMessage("La note n'a pas pu etre enregistree.");
      return;
    }

    if (currentIndex + 1 >= cards.length) {
      setView('done');
      setShowAnswer(false);
      return;
    }

    setCurrentIndex(prev => prev + 1);
    setShowAnswer(false);
    setMessage('');
  };

  const resetReview = () => {
    setCards([]);
    setCurrentIndex(0);
    setShowAnswer(false);
    setView('select');
    setMessage('');
  };

  if (view === 'review' && currentCard) {
    return (
      <div className="min-h-screen bg-gray-50 pt-4 pb-24 px-4">
        <button
          onClick={resetReview}
          className="flex items-center text-blue-600 mb-4 font-medium"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          <span>Retour</span>
        </button>

        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Revision</h1>
            <p className="text-sm text-gray-500">{currentDeckName}</p>
          </div>
          <div className="text-sm font-semibold text-gray-600">
            {currentIndex + 1}/{cards.length}
          </div>
        </div>

        <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={() => setShowAnswer(true)}
          className="w-full min-h-[320px] bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col justify-center text-center"
        >
          <div className="text-xs font-semibold text-gray-400 mb-4">
            {showAnswer ? 'REPONSE' : 'QUESTION'}
          </div>
          <p className="text-2xl font-bold text-gray-900 leading-relaxed break-words">
            {showAnswer ? currentCard.answer : currentCard.question}
          </p>
        </button>

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="mt-4 w-full py-3 bg-blue-600 text-white rounded-lg font-semibold"
          >
            Afficher la reponse
          </button>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {REVIEW_OPTIONS.map(option => (
              <button
                key={option.rating}
                onClick={() => rateCurrentCard(option.rating)}
                className={`p-3 rounded-lg text-white text-left transition-colors ${option.className}`}
              >
                <div className="font-bold">{option.label}</div>
                <div className="text-xs opacity-90">{option.detail}</div>
              </button>
            ))}
          </div>
        )}

        {message && (
          <p className="mt-4 text-sm text-red-600 text-center">{message}</p>
        )}
      </div>
    );
  }

  if (view === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 pt-10 pb-24 px-4 flex items-center">
        <div className="w-full bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Session terminee</h1>
          <p className="text-gray-600 mb-6">
            Les cartes ont ete replanifiees selon tes reponses.
          </p>
          <button
            onClick={resetReview}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Nouvelle session</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4 pb-24 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Revision</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choisis un ou plusieurs paquets. Les cartes dues seront melangees.
      </p>

      {decks.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          Aucun paquet disponible.
        </p>
      ) : (
        <div className="space-y-2 mb-6">
          {decks.map(deck => {
            const isSelected = selectedDeckIds.includes(deck.id);

            return (
              <button
                key={deck.id}
                onClick={() => toggleDeck(deck.id)}
                className={`w-full p-4 rounded-lg border-2 bg-white text-left transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{deck.name}</span>
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
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
            : 'bg-green-600 text-white active:bg-green-700'
        }`}
      >
        {isLoading
          ? 'Chargement...'
          : selectedCount === 0
            ? 'Selectionne au moins un paquet'
            : `Reviser ${selectedCount} paquet${selectedCount > 1 ? 's' : ''}`}
      </button>

      {message && (
        <p className="mt-4 text-sm text-gray-600 text-center">{message}</p>
      )}
    </div>
  );
}

function getNextSchedule(card: Flashcard, rating: Rating) {
  const previousInterval = card.review_interval_days ?? 0;
  const previousStreak = card.review_streak ?? 0;
  const reviewedAt = new Date();
  const nextDueAt = new Date(reviewedAt);

  let nextIntervalDays = 1;
  let nextStreak = 0;

  if (rating === 'again') {
    nextIntervalDays = 0;
    nextStreak = 0;
    nextDueAt.setTime(reviewedAt.getTime());
  }

  if (rating === 'hard') {
    nextIntervalDays = 0;
    nextStreak = 0;
    nextDueAt.setHours(nextDueAt.getHours() + 6);
  }

  if (rating === 'good') {
    nextStreak = Math.max(1, previousStreak);
    nextIntervalDays = previousInterval <= 1
      ? 1
      : Math.min(90, Math.ceil(previousInterval * 1.7));
    nextDueAt.setDate(nextDueAt.getDate() + nextIntervalDays);
  }

  if (rating === 'easy') {
    nextStreak = previousStreak + 1;
    nextIntervalDays = previousInterval <= 1
      ? 2
      : Math.min(180, Math.ceil(previousInterval * (1.9 + nextStreak * 0.2)));
    nextDueAt.setDate(nextDueAt.getDate() + nextIntervalDays);
  }

  return {
    last_reviewed_at: reviewedAt.toISOString(),
    review_due_at: nextDueAt.toISOString(),
    review_interval_days: nextIntervalDays,
    review_streak: nextStreak,
  };
}

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}
