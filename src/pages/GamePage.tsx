import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, X } from 'lucide-react';
import { supabase, Deck, Flashcard, Profile } from '../lib/supabase';

const COLOR_OPTIONS = [
  '#2F7BFF',
  '#7C3CFF',
  '#14D4BF',
  '#FFBD3D',
  '#FF4F7B',
  '#F97316',
  '#22C55E',
  '#06B6D4',
  '#A855F7',
  '#0F766E',
  '#E11D48',
];

const UNSET_COLOR = 'UNSET';

const DIFFICULTY_COLORS = {
  1: '#4F46E5', // Violet
  2: '#14B8A6', // Teal
  3: '#F59E0B', // Amber
  4: '#F97316', // Orange
  5: '#E11D48', // Rose
};

interface GamePageProps {
  user: User;
  profile: Profile;
  setIsGameInProgress: (value: boolean) => void;
}

export default function GamePage({ user, setIsGameInProgress }: GamePageProps) {
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
  const [quarantineNote, setQuarantineNote] = useState('');
  const [quarantineError, setQuarantineError] = useState('');
  const [allCardsDoneOpen, setAllCardsDoneOpen] = useState(false);
  const [finishedPileColor, setFinishedPileColor] = useState<string | null>(null);

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

  const allSelectedDecksHaveColor =
    selectedDecksWithColor.size > 0 &&
    Array.from(selectedDecksWithColor.values()).every(color => color !== UNSET_COLOR);

  const canQuarantineDeck = (deckId: string | null) => {
    const deck = decks.find(item => item.id === deckId);
    if (!deck) return false;

    return deck.visibility === 'public' || deck.owner_id === user.id;
  };

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
      setFinishedPileColor(null);
      setView('play');
    }
  };

  const showRandomCard = (cards: Flashcard[], pileColor: string) => {
    if (cards.length === 0) return;

    const availableCards = cards.filter(
      card => !usedFlashcards.includes(card.id)
    );

    if (availableCards.length === 0) {
      setFinishedPileColor(pileColor);
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

  const getDeckIdsForColor = (color: string) => {
    return Array.from(selectedDecksWithColor.entries())
      .filter(([, selectedColor]) => selectedColor === color)
      .map(([deckId]) => deckId);
  };

  const handlePileClick = (color: string) => {
    const deckIds = getDeckIdsForColor(color);
    const pileCards = allFlashcards.filter(card => deckIds.includes(card.deck_id));
    if (pileCards.length > 0) {
      showRandomCard(pileCards, color);
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
      setQuarantineNote('');
      setQuarantineError('');
      return;
    }

    console.error('Quarantine failed', error);
    setQuarantineError(getQuarantineErrorMessage(error.message));
  };

  const resetFinishedDeck = () => {
    if (!finishedPileColor) return;

    const finishedDeckIds = getDeckIdsForColor(finishedPileColor);
    const finishedDeckCardIds = allFlashcards
      .filter(card => finishedDeckIds.includes(card.deck_id))
      .map(card => card.id);

    setUsedFlashcards(prev =>
      prev.filter(id => !finishedDeckCardIds.includes(id))
    );

    setCurrentCard(null);
    setCurrentCardDeckId(null);
    setIsFlipped(false);
    setFinishedPileColor(null);
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
    setQuarantineNote('');
    setQuarantineError('');
    setAllCardsDoneOpen(false);
    setFinishedPileColor(null);
  };

  if (view === 'play') {
    const selectedDecks = decks.filter(deck => selectedDecksWithColor.has(deck.id));
    const selectedPiles = Array.from(
      selectedDecks.reduce<Map<string, Deck[]>>((piles, deck) => {
        const color = selectedDecksWithColor.get(deck.id);
        if (!color || color === UNSET_COLOR) return piles;

        const pileDecks = piles.get(color) ?? [];
        piles.set(color, [...pileDecks, deck]);
        return piles;
      }, new Map())
    ).map(([color, pileDecks]) => ({ color, decks: pileDecks }));
    const currentDeck = decks.find(d => d.id === currentCardDeckId);
    const currentDeckColor = currentDeck
      ? selectedDecksWithColor.get(currentDeck.id) || '#3B82F6'
      : '#3B82F6';
    const currentPileDeckIds = getDeckIdsForColor(currentDeckColor);
    const currentPileRemainingCount = allFlashcards.filter(
      card => currentPileDeckIds.includes(card.deck_id) && !usedFlashcards.includes(card.id)
    ).length;
    const finishedPile = selectedPiles.find(pile => pile.color === finishedPileColor);
    const finishedPileName = finishedPile?.decks.map(deck => deck.name).join(', ');

    return (
      <div className="min-h-screen app-shell pt-4 pb-24">
        <div className="px-4">
          <button
            onClick={() => setConfirmExitOpen(true)}
            className="flex items-center text-violet-700 mb-4 font-medium"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span>Retour</span>
          </button>

          <div className="mission-strip p-5 mb-6">
            <div className="relative z-10">
              <h1 className="text-3xl font-black leading-tight">Mode jeu</h1>
            </div>
          </div>

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
                className="cursor-pointer rounded-[1.5rem] overflow-hidden memory-card"
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
                    <div className="text-xs font-black text-white mb-3 opacity-75 tracking-[0.22em]">
                      {isFlipped ? 'RÉPONSE' : 'QUESTION'}
                    </div>
                    <p className="text-3xl font-black text-white leading-relaxed break-words">
                      {isFlipped ? currentCard.answer : currentCard.question}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-gray-700 text-center text-sm font-semibold">
                  Il reste {currentPileRemainingCount} carte{currentPileRemainingCount > 1 ? 's' : ''} dans cette pile
                </p>

                <p className="text-gray-600 text-center text-sm">
                  Appuyez une fois pour voir la réponse, puis une seconde fois pour revenir aux paquets
                </p>

                {canQuarantineDeck(currentCardDeckId) && (
                  <button
                    onClick={() => {
                      setQuarantineNote('');
                      setQuarantineError('');
                      setConfirmQuarantineOpen(true);
                    }}
                    className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                  >
                    Mettre cette carte en quarantaine
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-500 text-center">Cliquez sur une pile pour commencer</p>

              <div className="grid grid-cols-2 gap-2">
                {selectedPiles.map((pile) => {
                  const pileDeckIds = pile.decks.map(deck => deck.id);
                  const pileCards = allFlashcards.filter(
                    card => pileDeckIds.includes(card.deck_id)
                  );
                  const remainingCount = pileCards.filter(
                    card => !usedFlashcards.includes(card.id)
                  ).length;
                  const totalCount = pileCards.length;
                  const pileName = pile.decks.map(deck => deck.name).join(' + ');

                  return (
                    <button
                      key={pile.color}
                      onClick={() => handlePileClick(pile.color)}
                      className="relative text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-violet-200 opacity-40" />
                      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-2xl bg-teal-100 opacity-70" />

                      <div
                        className="relative p-5 rounded-[1.5rem] memory-card text-white min-h-[300px] flex flex-col justify-center items-center border border-white/30"
                        style={{ backgroundColor: pile.color }}
                      >
                        <div className="font-bold text-4xl text-center leading-snug break-words">
                          {pileName}
                        </div>

                        <div className="absolute bottom-3 text-sm opacity-90">
                          {remainingCount}/{totalCount} carte{totalCount > 1 ? 's' : ''} restante{remainingCount > 1 ? 's' : ''}
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
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
            <div className="app-panel rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Quitter la partie ?
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                La partie en cours sera interrompue.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={resetGame}
                  className="flex-1 px-4 py-2 app-danger rounded-lg"
                >
                  Quitter
                </button>

                <button
                  onClick={() => setConfirmExitOpen(false)}
                  className="flex-1 px-4 py-2 app-muted-button rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmQuarantineOpen && currentCard && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
            <div className="app-panel rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Mettre la carte en quarantaine ?
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                Cette carte sera retirée du mode jeu jusqu’à sa relecture et sa réactivation.
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
                    setConfirmQuarantineOpen(false);
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

        {allCardsDoneOpen && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
            <div className="app-panel rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Fin de la pile
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                Toutes les cartes du paquet
                {finishedPileName ? ` "${finishedPileName}"` : ''} ont deja ete tirees.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={resetFinishedDeck}
                  className="flex-1 px-4 py-2 app-primary rounded-lg"
                >
                  Recommencer
                </button>

                <button
                  onClick={() => {
                    setFinishedPileColor(null);
                    setAllCardsDoneOpen(false);
                  }}
                  className="flex-1 px-4 py-2 app-muted-button rounded-lg"
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
      <div className="min-h-screen app-shell pt-4 pb-24">
        <div className="px-4">
          <div className="mission-strip p-5 mb-6">
            <div className="relative z-10">
              <h1 className="text-3xl font-black leading-tight">Sélectionner les paquets</h1>
            </div>
          </div>

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
                    className={`w-full p-4 rounded-2xl text-left transition-all launch-card ${
                      selectedDecksWithColor.has(deck.id)
                        ? 'ring-2 ring-violet-400'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{deck.name}</span>
                        <div className="text-xs text-gray-500 mt-1">
                          {deck.visibility === 'public' ? 'Paquet public' : 'Paquet personnel'}
                        </div>
                      </div>
                      {selectedDecksWithColor.has(deck.id) && (
                        <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
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
                <div className="mb-6 p-4 app-panel rounded-lg">
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
                    : 'app-primary active:brightness-95'
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
          <div className="fixed inset-0 bg-slate-950/50 flex items-end z-50 p-4">
            <div className="app-panel rounded-t-2xl p-6 w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Couleur pour {selectedDeckForColor.name}</h3>
                <button
                  onClick={() => setColorSelectionModalOpen(false)}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Les paquets avec la meme couleur seront melanges dans une seule pile.
              </p>

              <div className="grid grid-cols-5 gap-3">
                {COLOR_OPTIONS.map((color) => {
                  const isSelectedForCurrentDeck =
                    selectedDecksWithColor.get(selectedDeckForColor.id) === color;

                  return (
                    <button
                      key={color}
                      onClick={() => updateDeckColor(selectedDeckForColor.id, color)}
                      className="w-full aspect-square rounded-lg border-4 transition-all hover:scale-110"
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
