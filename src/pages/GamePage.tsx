import { useState, useEffect } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { supabase, Deck, Flashcard } from '../lib/supabase';

const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#ce3636', // Red
  '#10B981', // Green
  '#FBBF24', // Yellow
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
];

const UNSET_COLOR = 'UNSET';

const DIFFICULTY_COLORS = {
  1: '#030082', // Blue
  2: '#17a72a', // Green
  3: '#f6e501', // Yellow
  4: '#fd7c1e', // Orange
  5: '#d22727', // Red
};

interface GamePageProps {
  setIsGameInProgress: (value: boolean) => void;
}

export default function GamePage({ setIsGameInProgress }: GamePageProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDecksWithColor, setSelectedDecksWithColor] = useState<Map<string, string>>(new Map());
  const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([]);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [currentCardDeckId, setCurrentCardDeckId] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [view, setView] = useState<'select' | 'color' | 'play'>('select');
  const [colorSelectionModalOpen, setColorSelectionModalOpen] = useState(false);
  const [selectedDeckForColor, setSelectedDeckForColor] = useState<Deck | null>(null);
  const [usedFlashcards, setUsedFlashcards] = useState<string[]>([]);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [confirmQuarantineOpen, setConfirmQuarantineOpen] = useState(false);
  const [allCardsDoneOpen, setAllCardsDoneOpen] = useState(false);
  const [finishedDeckId, setFinishedDeckId] = useState<string | null>(null);

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setDecks(data);
    }
  };

  const toggleDeckSelection = (deckId: string) => {
    const newSelected = new Map(selectedDecksWithColor);
    if (newSelected.has(deckId)) {
      newSelected.delete(deckId);
    } else {
      newSelected.set(deckId, UNSET_COLOR);
    }
    setSelectedDecksWithColor(newSelected);
  };

  const updateDeckColor = (deckId: string, color: string) => {
    const newSelected = new Map(selectedDecksWithColor);
    newSelected.set(deckId, color);
    setSelectedDecksWithColor(newSelected);
    setColorSelectionModalOpen(false);
  };

  const isColorAlreadyUsedByAnotherDeck = (color: string, deckId: string) => {
    return Array.from(selectedDecksWithColor.entries()).some(
      ([selectedDeckId, selectedColor]) =>
        selectedDeckId !== deckId && selectedColor === color
    );
  };

  const allSelectedDecksHaveColor =
    selectedDecksWithColor.size > 0 &&
    Array.from(selectedDecksWithColor.values()).every(color => color !== UNSET_COLOR);

  const startGame = async () => {
    if (!allSelectedDecksHaveColor) return;

    setIsGameInProgress(true);

    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .in('deck_id', Array.from(selectedDecksWithColor.keys()))
      .eq('status', 'active');

    if (!error && data && data.length > 0) {
      setAllFlashcards(data);
      setCurrentCard(null);
      setCurrentCardDeckId(null);
      setIsFlipped(false);
      setUsedFlashcards([]);
      setAllCardsDoneOpen(false);
      setFinishedDeckId(null);
      setView('play');
    }
  };

  const showRandomCard = (cards: Flashcard[]) => {
    if (cards.length === 0) return;

    const availableCards = cards.filter(
      card => !usedFlashcards.includes(card.id)
    );

    if (availableCards.length === 0) {
      const deckId = cards[0].deck_id;
      setFinishedDeckId(deckId);
      setAllCardsDoneOpen(true);
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const card = availableCards[randomIndex];

    setCurrentCard(card);
    setCurrentCardDeckId(card.deck_id);
    setIsFlipped(false);

    setUsedFlashcards(prev => [...prev, card.id]);
  };

  const handleDeckClick = (deckId: string) => {
    const deckCards = allFlashcards.filter(card => card.deck_id === deckId);
    if (deckCards.length > 0) {
      showRandomCard(deckCards);
    }
  };

  const quarantineCurrentCard = async () => {
    if (!currentCard) return;

    const { error } = await supabase
      .from('flashcards')
      .update({ status: 'quarantine' })
      .eq('id', currentCard.id);

    if (!error) {
      setAllFlashcards((prev) =>
        prev.filter((card) => card.id !== currentCard.id)
      );

      setUsedFlashcards((prev) =>
        prev.filter((id) => id !== currentCard.id)
      );

      setCurrentCard(null);
      setCurrentCardDeckId(null);
      setIsFlipped(false);
      setConfirmQuarantineOpen(false);
    }
  };

  const resetFinishedDeck = () => {
    if (!finishedDeckId) return;

    const finishedDeckCardIds = allFlashcards
      .filter(card => card.deck_id === finishedDeckId)
      .map(card => card.id);

    setUsedFlashcards(prev =>
      prev.filter(id => !finishedDeckCardIds.includes(id))
    );

    setCurrentCard(null);
    setCurrentCardDeckId(null);
    setIsFlipped(false);
    setFinishedDeckId(null);
    setAllCardsDoneOpen(false);
  };

  const resetGame = () => {
    setCurrentCard(null);
    setCurrentCardDeckId(null);
    setIsFlipped(false);
    setSelectedDecksWithColor(new Map());
    setAllFlashcards([]);
    setUsedFlashcards([]);
    setView('select');
    setIsGameInProgress(false);
    setConfirmExitOpen(false);
    setConfirmQuarantineOpen(false);
    setAllCardsDoneOpen(false);
    setFinishedDeckId(null);
  };

  if (view === 'play') {
    const selectedDecks = decks.filter(deck => selectedDecksWithColor.has(deck.id));
    const currentDeck = decks.find(d => d.id === currentCardDeckId);
    const currentDeckColor = currentDeck
      ? selectedDecksWithColor.get(currentDeck.id) || '#3B82F6'
      : '#3B82F6';
    const finishedDeck = decks.find(d => d.id === finishedDeckId);

    return (
      <div className="min-h-screen bg-gray-50 pt-4 pb-24">
        <div className="px-4">
          <button
            onClick={() => setConfirmExitOpen(true)}
            className="flex items-center text-blue-600 mb-4 font-medium"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span>Retour</span>
          </button>

          <h1 className="text-2xl font-bold text-gray-800 mb-6">Mode Jeu</h1>

          {currentCard ? (
            <div className="flex flex-col gap-6">
              <div
                onClick={() => {
                  if (!isFlipped) {
                    setIsFlipped(true);
                  } else {
                    setCurrentCard(null);
                    setCurrentCardDeckId(null);
                    setIsFlipped(false);
                  }
                }}
                className="cursor-pointer rounded-2xl overflow-hidden shadow-xl"
                style={{
                  borderWidth: '20px',
                  borderColor:
                    DIFFICULTY_COLORS[currentCard.difficulty as keyof typeof DIFFICULTY_COLORS] || '#3B82F6',
                }}
              >
                <div
                  className="p-8 min-h-80 flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: isFlipped
                      ? adjustBrightness(currentDeckColor, -20)
                      : currentDeckColor,
                  }}
                >
                  <div className="text-center">
                    <div className="text-xs font-semibold text-white mb-3 opacity-75">
                      {isFlipped ? 'RÉPONSE' : 'QUESTION'}
                    </div>
                    <p className="text-2xl font-bold text-white leading-relaxed break-words">
                      {isFlipped ? currentCard.answer : currentCard.question}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-gray-600 text-center text-sm">
                  Appuyez une fois pour voir la réponse, puis une seconde fois pour revenir aux paquets
                </p>

                <button
                  onClick={() => setConfirmQuarantineOpen(true)}
                  className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                  Mettre cette carte en quarantaine
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-500 text-center">Cliquez sur un paquet pour commencer</p>

              <div className="grid grid-cols-2 gap-2">
                {selectedDecks.map((deck) => {
                  const deckCardCount = allFlashcards.filter(
                    card => card.deck_id === deck.id
                  ).length;
                  const selectedColor = selectedDecksWithColor.get(deck.id);
                  const deckColor =
                    selectedColor && selectedColor !== UNSET_COLOR ? selectedColor : '#9CA3AF';

                  return (
                    <button
                      key={deck.id}
                      onClick={() => handleDeckClick(deck.id)}
                      className="relative text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-gray-300 opacity-40" />
                      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-2xl bg-gray-200 opacity-60" />

                      <div
                        className="relative p-5 rounded-2xl shadow-xl text-white min-h-[300px] flex flex-col justify-center items-center border border-white/20"
                        style={{ backgroundColor: deckColor }}
                      >
                        <div className="font-bold text-4xl text-center leading-snug break-words">
                          {deck.name}
                        </div>

                        <div className="absolute bottom-3 text-sm opacity-90">
                          {deckCardCount} carte{deckCardCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {confirmExitOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Quitter la partie ?
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                La partie en cours sera interrompue.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={resetGame}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                  Quitter
                </button>

                <button
                  onClick={() => setConfirmExitOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmQuarantineOpen && currentCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Mettre la carte en quarantaine ?
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                Cette carte sera retirée du mode jeu jusqu’à sa relecture et sa réactivation.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={quarantineCurrentCard}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg"
                >
                  Confirmer
                </button>

                <button
                  onClick={() => setConfirmQuarantineOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {allCardsDoneOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Fin du paquet
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                Toutes les cartes du paquet
                {finishedDeck ? ` "${finishedDeck.name}"` : ''} ont déjà été tirées.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={resetFinishedDeck}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Recommencer
                </button>

                <button
                  onClick={() => {
                    setFinishedDeckId(null);
                    setAllCardsDoneOpen(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'color' || view === 'select') {
    const selectedDecks = Array.from(selectedDecksWithColor.keys()).map(id =>
      decks.find(d => d.id === id)
    ).filter(Boolean) as Deck[];

    return (
      <div className="min-h-screen bg-gray-50 pt-4 pb-24">
        <div className="px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Sélectionner les paquets</h1>

          {decks.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Aucun paquet disponible. Créez-en un !
            </p>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => toggleDeckSelection(deck.id)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedDecksWithColor.has(deck.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{deck.name}</span>
                      {selectedDecksWithColor.has(deck.id) && (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selectedDecks.length > 0 && (
                <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 font-medium mb-3">Choisir les couleurs</p>
                  <div className="space-y-2">
                    {selectedDecks.map((deck) => {
                      const selectedColor = selectedDecksWithColor.get(deck.id);
                      const deckColor = selectedColor && selectedColor !== UNSET_COLOR ? selectedColor : '#9CA3AF';
                      return (
                        <button
                          key={deck.id}
                          onClick={() => {
                            setSelectedDeckForColor(deck);
                            setColorSelectionModalOpen(true);
                          }}
                          className="w-full p-3 rounded-lg flex items-center justify-between text-white font-medium hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: deckColor }}
                        >
                          <div className="flex flex-col items-start">
                            <span>{deck.name}</span>
                            {selectedColor === UNSET_COLOR && (
                              <span className="text-xs opacity-90">Couleur à choisir</span>
                            )}
                          </div>
                          <div className="w-4 h-4 rounded border-2 border-white" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={startGame}
                disabled={!allSelectedDecksHaveColor}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                  !allSelectedDecksHaveColor
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white active:bg-green-700'
                }`}
              >
                {selectedDecksWithColor.size === 0
                  ? 'Sélectionnez au moins un paquet'
                  : !allSelectedDecksHaveColor
                    ? 'Choisissez une couleur pour chaque paquet'
                    : `Commencer (${selectedDecksWithColor.size})`}
              </button>
            </>
          )}
        </div>

        {colorSelectionModalOpen && selectedDeckForColor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50 p-4">
            <div className="bg-white rounded-t-2xl p-6 w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Couleur pour {selectedDeckForColor.name}</h3>
                <button
                  onClick={() => setColorSelectionModalOpen(false)}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {COLOR_OPTIONS.map((color) => {
                  const isSelectedForCurrentDeck =
                    selectedDecksWithColor.get(selectedDeckForColor.id) === color;
                  const isUsedByAnotherDeck = isColorAlreadyUsedByAnotherDeck(
                    color,
                    selectedDeckForColor.id
                  );

                  return (
                    <button
                      key={color}
                      onClick={() => updateDeckColor(selectedDeckForColor.id, color)}
                      disabled={isUsedByAnotherDeck}
                      className={`w-full aspect-square rounded-lg border-4 transition-all ${
                        isUsedByAnotherDeck
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: color,
                        borderColor: isSelectedForCurrentDeck ? '#000' : 'transparent',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function adjustBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255))
    .toString(16).slice(1);
}