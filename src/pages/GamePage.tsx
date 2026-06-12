import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, X } from 'lucide-react';
import { supabase, Deck, Flashcard, Profile } from '../lib/supabase';

const COLOR_OPTIONS = [
  {
    value: '#005AB5',
    label: 'Bleu',
    pattern: 'repeating-linear-gradient(45deg, transparent 0 8px, rgba(255, 255, 255, 0.28) 8px 12px)',
  },
  {
    value: '#B45309',
    label: 'Orange',
    pattern: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255, 255, 255, 0.3) 10px 14px)',
  },
  {
    value: '#047857',
    label: 'Vert',
    pattern: 'radial-gradient(circle, rgba(255, 255, 255, 0.35) 2px, transparent 2.5px)',
  },
  {
    value: '#6D28D9',
    label: 'Violet',
    pattern: 'repeating-linear-gradient(135deg, transparent 0 7px, rgba(255, 255, 255, 0.3) 7px 9px)',
  },
  {
    value: '#B91C1C',
    label: 'Rouge',
    pattern: 'repeating-linear-gradient(0deg, transparent 0 9px, rgba(255, 255, 255, 0.28) 9px 12px)',
  },
  {
    value: '#111827',
    label: 'Noir',
    pattern: 'linear-gradient(45deg, rgba(255, 255, 255, 0.24) 25%, transparent 25% 50%, rgba(255, 255, 255, 0.24) 50% 75%, transparent 75%)',
  },
];

const UNSET_COLOR = 'UNSET';

const DIFFICULTY_COLORS = {
  1: '#4F46E5', // Violet
  2: '#14B8A6', // Teal
  3: '#F59E0B', // Amber
  4: '#F97316', // Orange
  5: '#E11D48', // Rose
};

const BOARD_LIMITS = {
  malus: 9,
  bonus: 18,
  neutral: 18,
};

const BOARD_TILE_STYLES = {
  malus: {
    label: 'Malus',
    color: '#DC2626',
  },
  bonus: {
    label: 'Bonus',
    color: '#7C3AED',
  },
  neutral: {
    label: 'Neutre',
    color: '#2563EB',
  },
};

const HEX_NEIGHBOR_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

type BoardTileRole = keyof typeof BOARD_LIMITS;
type BoardPathKind = 'main' | 'hub' | 'bonusDetour' | 'riskyShortcut';

interface BoardTile {
  id: string;
  q: number;
  r: number;
  role: BoardTileRole;
  pathKind: BoardPathKind;
  isMainPath: boolean;
  isHub: boolean;
  isStart: boolean;
  isFinish: boolean;
}

interface GeneratedBoard {
  tiles: BoardTile[];
  fastestPathLength: number;
  targetMinutes: number;
  playerCount: number;
  counts: Record<BoardTileRole, number>;
}

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
  const [view, setView] = useState<'select' | 'color' | 'board' | 'play'>('select');
  const [colorSelectionModalOpen, setColorSelectionModalOpen] = useState(false);
  const [selectedDeckForColor, setSelectedDeckForColor] = useState<Deck | null>(null);
  const [usedFlashcards, setUsedFlashcards] = useState<string[]>([]);
  const [gameDurationMinutes, setGameDurationMinutes] = useState(30);
  const [playerCount, setPlayerCount] = useState(3);
  const [generatedBoard, setGeneratedBoard] = useState<GeneratedBoard>(() => generateBoard(30, 3));
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

  const prepareBoard = () => {
    if (!allSelectedDecksHaveColor) return;

    setGeneratedBoard(generateBoard(gameDurationMinutes, playerCount));
    setView('board');
  };

  const regenerateBoard = () => {
    setGeneratedBoard(generateBoard(gameDurationMinutes, playerCount));
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
    setGeneratedBoard(generateBoard(gameDurationMinutes, playerCount));
  };

  if (view === 'board') {
    return (
      <div className="min-h-screen app-shell pt-4 pb-24">
        <div className="px-4">
          <button
            onClick={() => setView('select')}
            className="flex items-center text-violet-700 mb-4 font-medium"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            <span>Retour</span>
          </button>

          <div className="mission-strip p-5 mb-6">
            <div className="relative z-10">
              <h1 className="text-3xl font-black leading-tight">Plateau</h1>
              <p className="text-sm text-white/78 mt-2">
                Ajuste la duree et les joueurs, puis lance la partie.
              </p>
            </div>
          </div>

          <div className="app-panel rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Duree</span>
                <input
                  type="number"
                  min={10}
                  max={120}
                  step={5}
                  value={gameDurationMinutes}
                  onChange={(event) => {
                    const nextDuration = clampNumber(Number(event.target.value), 10, 120);
                    setGameDurationMinutes(nextDuration);
                    setGeneratedBoard(generateBoard(nextDuration, playerCount));
                  }}
                  className="mt-1 w-full rounded-lg border px-3 py-2 app-input outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Joueurs</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={playerCount}
                  onChange={(event) => {
                    const nextPlayerCount = clampNumber(Number(event.target.value), 1, 8);
                    setPlayerCount(nextPlayerCount);
                    setGeneratedBoard(generateBoard(gameDurationMinutes, nextPlayerCount));
                  }}
                  className="mt-1 w-full rounded-lg border px-3 py-2 app-input outline-none"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/70 p-2">
                <div className="text-lg font-black text-gray-900">{generatedBoard.fastestPathLength}</div>
                <div className="text-xs text-gray-500">chemin rapide</div>
              </div>
              <div className="rounded-lg bg-white/70 p-2">
                <div className="text-lg font-black text-gray-900">{generatedBoard.tiles.length}</div>
                <div className="text-xs text-gray-500">cases</div>
              </div>
              <div className="rounded-lg bg-white/70 p-2">
                <div className="text-lg font-black text-gray-900">{Math.max(0, 45 - generatedBoard.tiles.length)}</div>
                <div className="text-xs text-gray-500">reserve</div>
              </div>
            </div>
          </div>

          <BoardPreview board={generatedBoard} />

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(BOARD_TILE_STYLES) as BoardTileRole[]).map((role) => (
              <div key={role} className="rounded-lg bg-white/75 p-2 text-center text-xs font-semibold text-gray-700">
                <span
                  className="mx-auto mb-1 block h-4 w-4 rounded"
                  style={{ backgroundColor: BOARD_TILE_STYLES[role].color }}
                />
                {BOARD_TILE_STYLES[role].label} {generatedBoard.counts[role]}/{BOARD_LIMITS[role]}
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={regenerateBoard}
              className="py-3 app-muted-button rounded-lg font-semibold"
            >
              Regenerer
            </button>

            <button
              onClick={startGame}
              className="py-3 app-primary rounded-lg font-semibold"
            >
              Commencer
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      ? selectedDecksWithColor.get(currentDeck.id) || COLOR_OPTIONS[0].value
      : COLOR_OPTIONS[0].value;
    const currentColorOption = getColorOption(currentDeckColor);
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
                    ...getColorPatternStyle(
                      isFlipped
                        ? adjustBrightness(currentDeckColor, -20)
                        : currentDeckColor,
                      currentDeckColor
                    ),
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
                  Il reste {currentPileRemainingCount} carte{currentPileRemainingCount > 1 ? 's' : ''} dans la pile {currentColorOption.label}
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
                  const colorOption = getColorOption(pile.color);

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
                        style={getColorPatternStyle(pile.color)}
                      >
                        <div className="absolute top-3 left-3 rounded-full bg-black/20 px-3 py-1 text-xs font-bold">
                          {colorOption.label}
                        </div>

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
                      const colorOption = selectedColor && selectedColor !== UNSET_COLOR
                        ? getColorOption(selectedColor)
                        : null;

                      return (
                        <button
                          key={deck.id}
                          onClick={() => {
                            setSelectedDeckForColor(deck);
                            setColorSelectionModalOpen(true);
                          }}
                          className="w-full p-3 rounded-lg flex items-center justify-between font-medium hover:opacity-90 transition-opacity app-card"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-gray-900">{deck.name}</span>
                            {selectedColor === UNSET_COLOR && (
                              <span className="text-xs text-gray-500">Couleur à choisir</span>
                            )}
                            {colorOption && (
                              <span className="text-xs text-gray-500">{colorOption.label}</span>
                            )}
                          </div>
                          <div
                            className="h-9 w-9 rounded-lg border border-white shadow-sm"
                            style={getColorPatternStyle(deckColor)}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={prepareBoard}
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
                    : `Preparer le plateau (${selectedDecksWithColor.size})`}
              </button>
            </>
          )}
        </div>

        {colorSelectionModalOpen && selectedDeckForColor && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4 pb-28">
            <div className="app-panel rounded-lg p-6 w-full max-w-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COLOR_OPTIONS.map((colorOption) => {
                  const isSelectedForCurrentDeck =
                    selectedDecksWithColor.get(selectedDeckForColor.id) === colorOption.value;

                  return (
                    <button
                      key={colorOption.value}
                      onClick={() => updateDeckColor(selectedDeckForColor.id, colorOption.value)}
                      className="min-h-24 rounded-lg border-4 p-3 text-left text-white transition-all hover:scale-[1.02]"
                      style={{
                        ...getColorPatternStyle(colorOption.value),
                        borderColor: isSelectedForCurrentDeck ? '#111827' : 'transparent',
                      }}
                    >
                      <div className="text-sm font-black drop-shadow-sm">{colorOption.label}</div>
                      <div className="mt-1 text-xs font-medium text-white/85">
                        {getPatternLabel(colorOption.value)}
                      </div>
                    </button>
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

function BoardPreview({ board }: { board: GeneratedBoard }) {
  const hexSize = 22;
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  const points = getHexPoints(hexSize);
  const positions = board.tiles.map((tile) => ({
    tile,
    x: hexWidth * (tile.q + tile.r / 2),
    y: hexSize * 1.5 * tile.r,
  }));
  const minX = Math.min(...positions.map(position => position.x)) - hexWidth;
  const maxX = Math.max(...positions.map(position => position.x)) + hexWidth;
  const minY = Math.min(...positions.map(position => position.y)) - hexHeight;
  const maxY = Math.max(...positions.map(position => position.y)) + hexHeight;

  return (
    <div className="app-panel rounded-lg p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">Variante generee</h2>
          <p className="text-xs text-gray-500">
            Depart commun, arrivee commune, chemins alternatifs inclus.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white/70 p-2">
        <svg
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          className="h-80 min-w-[520px] w-full"
          role="img"
          aria-label="Plateau genere"
        >
          {positions.map(({ tile, x, y }) => (
            <g key={tile.id} transform={`translate(${x} ${y})`}>
              <polygon
                points={points}
                fill={BOARD_TILE_STYLES[tile.role].color}
                stroke={tile.isMainPath ? '#111827' : '#ffffff'}
                strokeWidth={tile.isMainPath ? 3 : 2}
              />
              {(tile.isStart || tile.isFinish) && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="14"
                  fontWeight="900"
                >
                  {tile.isStart ? 'D' : 'A'}
                </text>
              )}
              {tile.isHub && !tile.isStart && !tile.isFinish && (
                <circle
                  r="6"
                  fill="#ffffff"
                  stroke="#111827"
                  strokeWidth="2"
                />
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function generateBoard(targetMinutes: number, playerCount: number): GeneratedBoard {
  const safeMinutes = clampNumber(targetMinutes, 10, 120);
  const safePlayerCount = clampNumber(playerCount, 1, 8);
  const fastestPathLength = clampNumber(
    Math.round((safeMinutes * 1.5) / safePlayerCount),
    8,
    45
  );
  const targetTileCount = clampNumber(
    fastestPathLength + Math.round(fastestPathLength * 0.55),
    fastestPathLength,
    45
  );
  const mainPath = buildMainPath(fastestPathLength);
  const hubIndexes = getHubIndexes(mainPath.length);
  const tilesByKey = new Map<string, {
    q: number;
    r: number;
    isMainPath: boolean;
    isHub: boolean;
    pathKind: BoardPathKind;
  }>();

  mainPath.forEach((coord, index) => {
    const isHub = hubIndexes.includes(index);
    tilesByKey.set(coordKey(coord), {
      ...coord,
      isMainPath: true,
      isHub,
      pathKind: isHub ? 'hub' : 'main',
    });
  });

  const startKey = coordKey(mainPath[0]);
  const finishKey = coordKey(mainPath[mainPath.length - 1]);
  const hubPairs = hubIndexes
    .slice(0, -1)
    .map((startIndex, index) => ({
      startIndex,
      endIndex: hubIndexes[index + 1],
    }))
    .filter(pair => pair.endIndex - pair.startIndex >= 3);

  for (const [pairIndex, pair] of shuffleArray(hubPairs).entries()) {
    if (tilesByKey.size >= targetTileCount) break;

    const branchOffset = pairIndex % 2 === 0 ? 2 : -2;
    const branchKind: BoardPathKind = branchOffset > 0 ? 'bonusDetour' : 'riskyShortcut';
    const branch = buildForwardBranch(
      mainPath[pair.startIndex],
      mainPath[pair.endIndex],
      branchOffset,
      targetTileCount - tilesByKey.size
    );

    const candidateTilesByKey = new Map(tilesByKey);

    branch.forEach((coord) => {
      if (candidateTilesByKey.size < targetTileCount) {
        candidateTilesByKey.set(coordKey(coord), {
          ...coord,
          isMainPath: false,
          isHub: false,
          pathKind: branchKind,
        });
      }
    });

    if (isBoardConnectivityAllowed(candidateTilesByKey, startKey, finishKey)) {
      tilesByKey.clear();
      candidateTilesByKey.forEach((tile, key) => {
        tilesByKey.set(key, tile);
      });
    }
  }

  const rawTiles = Array.from(tilesByKey.values()).sort((a, b) => {
    const aKey = coordKey(a);
    const bKey = coordKey(b);
    const aIsEndpoint = aKey === startKey || aKey === finishKey;
    const bIsEndpoint = bKey === startKey || bKey === finishKey;

    return Number(bIsEndpoint) - Number(aIsEndpoint);
  });
  const counts: Record<BoardTileRole, number> = {
    malus: 0,
    bonus: 0,
    neutral: 0,
  };

  const tiles = rawTiles.map((tile) => {
    const key = coordKey(tile);
    const isStart = key === startKey;
    const isFinish = key === finishKey;
    const role = chooseBoardRole(tile.pathKind, isStart || isFinish, counts);

    counts[role] += 1;

    return {
      id: key,
      q: tile.q,
      r: tile.r,
      role,
      pathKind: tile.pathKind,
      isMainPath: tile.isMainPath,
      isHub: tile.isHub,
      isStart,
      isFinish,
    };
  });

  return {
    tiles,
    fastestPathLength,
    targetMinutes: safeMinutes,
    playerCount: safePlayerCount,
    counts,
  };
}

function buildMainPath(length: number) {
  return Array.from({ length }, (_, index) => ({ q: index, r: 0 }));
}

function getHubIndexes(pathLength: number) {
  const indexes = new Set([0, pathLength - 1]);
  const hubSpacing = pathLength >= 24 ? 6 : pathLength >= 14 ? 5 : 4;

  for (let index = hubSpacing; index < pathLength - 1; index += hubSpacing) {
    indexes.add(index);
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

function buildForwardBranch(
  start: { q: number; r: number },
  finish: { q: number; r: number },
  offset: number,
  remainingSlots: number
) {
  const branch: Array<{ q: number; r: number }> = [];
  const isUpperBranch = offset < 0;
  const connectorLane = isUpperBranch ? -1 : 1;
  const detourLane = isUpperBranch ? -2 : 2;
  const firstQ = isUpperBranch ? start.q + 1 : start.q - 1;
  const lastQ = finish.q;

  branch.push({ q: firstQ, r: connectorLane });

  for (let q = firstQ; q <= lastQ; q += 1) {
    branch.push({ q, r: detourLane });
  }

  branch.push({ q: finish.q, r: connectorLane });

  const cleanBranch = dedupeCoords(branch)
    .filter(coord => coord.q >= start.q - 1 && coord.q <= finish.q);

  return cleanBranch.length <= remainingSlots ? cleanBranch : [];
}

function isBoardConnectivityAllowed(
  tilesByKey: Map<string, { q: number; r: number }>,
  startKey: string,
  finishKey: string
) {
  const connectionCounts = getBoardConnectionCounts(tilesByKey);
  const maxHighConnectionTiles = Math.floor(tilesByKey.size * 0.15);
  let highConnectionTileCount = 0;

  for (const [key, connectionCount] of connectionCounts) {
    if (key === startKey || key === finishKey) {
      if (connectionCount < 1 || connectionCount > 2) return false;
      continue;
    }

    if (connectionCount === 2) continue;
    if (connectionCount < 2) return false;

    highConnectionTileCount += 1;
    if (highConnectionTileCount > maxHighConnectionTiles) return false;
  }

  return true;
}

function getBoardConnectionCounts(tilesByKey: Map<string, { q: number; r: number }>) {
  const connectionCounts = new Map<string, number>();

  tilesByKey.forEach((tile, key) => {
    const connectionCount = HEX_NEIGHBOR_DIRECTIONS.filter(direction =>
      tilesByKey.has(coordKey({ q: tile.q + direction.q, r: tile.r + direction.r }))
    ).length;

    connectionCounts.set(key, connectionCount);
  });

  return connectionCounts;
}

function chooseBoardRole(
  pathKind: BoardPathKind,
  isEndpoint: boolean,
  counts: Record<BoardTileRole, number>
): BoardTileRole {
  if (isEndpoint) return 'neutral';

  const roll = Math.random();
  const preferredRoles: BoardTileRole[] = pathKind === 'hub'
    ? ['neutral', 'bonus', 'malus']
    : pathKind === 'bonusDetour'
      ? roll < 0.62
        ? ['bonus', 'neutral', 'malus']
        : ['neutral', 'bonus', 'malus']
      : pathKind === 'riskyShortcut'
        ? roll < 0.62
          ? ['malus', 'neutral', 'bonus']
          : ['neutral', 'malus', 'bonus']
        : roll < 0.7
      ? ['neutral', 'bonus', 'malus']
      : roll < 0.88
        ? ['bonus', 'neutral', 'malus']
        : ['malus', 'neutral', 'bonus'];

  return preferredRoles.find(role => counts[role] < BOARD_LIMITS[role])
    ?? (Object.keys(BOARD_LIMITS) as BoardTileRole[])
      .find(role => counts[role] < BOARD_LIMITS[role])
    ?? 'neutral';
}

function getHexPoints(size: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30);
    return `${Math.cos(angle) * size},${Math.sin(angle) * size}`;
  }).join(' ');
}

function coordKey(coord: { q: number; r: number }) {
  return `${coord.q},${coord.r}`;
}

function dedupeCoords(coords: Array<{ q: number; r: number }>) {
  const seen = new Set<string>();

  return coords.filter((coord) => {
    const key = coordKey(coord);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function shuffleArray<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;

  return Math.min(max, Math.max(min, value));
}

function getColorOption(color: string) {
  return COLOR_OPTIONS.find(option => option.value === color) ?? COLOR_OPTIONS[0];
}

function getColorPatternStyle(color: string, patternColor = color) {
  const colorOption = COLOR_OPTIONS.find(option => option.value === patternColor);

  if (!colorOption) {
    return {
      backgroundColor: color,
    };
  }

  const isDottedPattern = colorOption.value === '#047857';
  const isCheckerPattern = colorOption.value === '#111827';

  return {
    backgroundColor: color,
    backgroundImage: colorOption.pattern,
    backgroundSize: isDottedPattern
      ? '14px 14px'
      : isCheckerPattern
        ? '18px 18px'
        : undefined,
  };
}

function getPatternLabel(color: string) {
  switch (getColorOption(color).value) {
    case '#005AB5':
      return 'diagonales';
    case '#B45309':
      return 'verticales';
    case '#047857':
      return 'points';
    case '#6D28D9':
      return 'diagonales fines';
    case '#B91C1C':
      return 'horizontales';
    case '#111827':
      return 'damier';
    default:
      return 'motif';
  }
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
