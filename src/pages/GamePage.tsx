import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, X } from 'lucide-react';
import { supabase, CommunityBoard, Deck, Flashcard, Profile } from '../lib/supabase';

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

const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'classic',
    name: 'Classique',
    description: 'Un chemin principal avec un grand détour.',
  },
  {
    id: 'two-detours',
    name: 'Deux detours',
    description: 'Deux chemins alternatifs de difficulté moyenne.',
  },
  {
    id: 'shortcut',
    name: 'Raccourci risque',
    description: 'Un raccourci malus et un détour bonus.',
  },
];

type BoardTileRole = 'malus' | 'bonus' | 'neutral';
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

interface BoardTemplate {
  id: string;
  name: string;
  description: string;
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
  const [communityBoards, setCommunityBoards] = useState<CommunityBoard[]>([]);
  const [selectedCommunityBoardId, setSelectedCommunityBoardId] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [selectedBoardTemplateId, setSelectedBoardTemplateId] = useState(BOARD_TEMPLATES[0].id);
  const [createBoardError, setCreateBoardError] = useState('');
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [confirmQuarantineOpen, setConfirmQuarantineOpen] = useState(false);
  const [quarantineNote, setQuarantineNote] = useState('');
  const [quarantineError, setQuarantineError] = useState('');
  const [allCardsDoneOpen, setAllCardsDoneOpen] = useState(false);
  const [finishedPileColor, setFinishedPileColor] = useState<string | null>(null);

  useEffect(() => {
    loadDecks();
    loadCommunityBoards();
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

  const loadCommunityBoards = async () => {
    const { data, error } = await supabase
      .from('community_boards')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCommunityBoards(data);
      setSelectedCommunityBoardId((currentId) =>
        currentId && data.some((board) => board.id === currentId)
          ? currentId
          : data[0]?.id ?? null
      );
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
  const selectedCommunityBoard = communityBoards.find((board) => board.id === selectedCommunityBoardId) ?? null;
  const selectedBoard = selectedCommunityBoard ? communityBoardToGeneratedBoard(selectedCommunityBoard) : null;
  const canStartWithBoard = allSelectedDecksHaveColor && selectedBoard !== null;

  const canQuarantineDeck = (deckId: string | null) => {
    const deck = decks.find(item => item.id === deckId);
    if (!deck) return false;

    return deck.visibility === 'public' || deck.owner_id === user.id;
  };

  const prepareBoard = () => {
    if (!allSelectedDecksHaveColor) return;

    setView('board');
  };

  const createCommunityBoard = async () => {
    const boardName = newBoardName.trim();
    if (!boardName) {
      setCreateBoardError('Donne un nom au plateau.');
      return;
    }

    const board = createBoardFromTemplate(selectedBoardTemplateId);
    const { data, error } = await supabase
      .from('community_boards')
      .insert({
        name: boardName,
        tiles: board.tiles,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Board creation failed', error);
      setCreateBoardError('Impossible de creer le plateau pour le moment.');
      return;
    }

    if (data) {
      setCommunityBoards((boards) => [data, ...boards]);
      setSelectedCommunityBoardId(data.id);
    }

    setNewBoardName('');
    setCreateBoardError('');
  };

  const startGame = async () => {
    if (!canStartWithBoard) return;

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
              <h1 className="text-3xl font-black leading-tight">Plateaux communautaires</h1>
              <p className="text-sm text-white/78 mt-2">
                Choisis un plateau partage ou cree-en un pour tout le monde.
              </p>
            </div>
          </div>

          <div className="app-panel rounded-lg p-4 mb-4">
            <h2 className="mb-3 text-lg font-black text-gray-900">Choisir un plateau</h2>
            {communityBoards.length === 0 ? (
              <p className="rounded-lg bg-white/70 p-3 text-sm text-gray-600">
                Aucun plateau partage pour l'instant. Cree le premier plateau de la communaute.
              </p>
            ) : (
              <div className="space-y-2">
                {communityBoards.map((board) => {
                  const boardPreview = communityBoardToGeneratedBoard(board);
                  const isSelected = board.id === selectedCommunityBoardId;

                  return (
                    <button
                      key={board.id}
                      onClick={() => setSelectedCommunityBoardId(board.id)}
                      className={`w-full rounded-lg p-3 text-left transition-all app-card ${
                        isSelected ? 'ring-2 ring-violet-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-gray-900">{board.name}</div>
                          <div className="text-xs text-gray-500">
                            {boardPreview?.tiles.length ?? 0} cases
                          </div>
                        </div>
                        {isSelected && (
                          <div className="rounded-full bg-violet-600 px-2 py-1 text-xs font-black text-white">
                            OK
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="app-panel rounded-lg p-4 mb-4">
            <h2 className="mb-3 text-lg font-black text-gray-900">Creer un plateau partage</h2>
            <input
              type="text"
              value={newBoardName}
              onChange={(event) => {
                setNewBoardName(event.target.value);
                setCreateBoardError('');
              }}
              placeholder="Nom du plateau"
              className="mb-3 w-full rounded-lg border px-3 py-2 app-input outline-none"
            />

            <div className="grid gap-2 sm:grid-cols-3">
              {BOARD_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedBoardTemplateId(template.id)}
                  className={`rounded-lg p-3 text-left text-sm app-card ${
                    selectedBoardTemplateId === template.id ? 'ring-2 ring-violet-400' : ''
                  }`}
                >
                  <div className="font-bold text-gray-900">{template.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{template.description}</div>
                </button>
              ))}
            </div>

            {createBoardError && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                {createBoardError}
              </p>
            )}

            <button
              onClick={createCommunityBoard}
              className="mt-3 w-full py-3 app-primary rounded-lg font-semibold"
            >
              Publier le plateau
            </button>
          </div>

          {selectedBoard && (
            <>
              <BoardPreview board={selectedBoard} title={selectedCommunityBoard?.name ?? 'Plateau'} />

              <div className="mt-4 grid grid-cols-3 gap-2">
                {(Object.keys(BOARD_TILE_STYLES) as BoardTileRole[]).map((role) => (
                  <div key={role} className="rounded-lg bg-white/75 p-2 text-center text-xs font-semibold text-gray-700">
                    <span
                      className="mx-auto mb-1 block h-4 w-4 rounded"
                      style={{ backgroundColor: BOARD_TILE_STYLES[role].color }}
                    />
                    {BOARD_TILE_STYLES[role].label} {selectedBoard.counts[role]}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-4">
            <button
              onClick={startGame}
              disabled={!canStartWithBoard}
              className={`w-full py-3 rounded-lg font-semibold ${
                canStartWithBoard
                  ? 'app-primary'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {selectedBoard ? 'Commencer' : 'Choisissez ou creez un plateau'}
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
                    : `Choisir un plateau (${selectedDecksWithColor.size})`}
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

function BoardPreview({ board, title = 'Plateau' }: { board: GeneratedBoard; title?: string }) {
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
          <h2 className="text-lg font-black text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">
            Plateau partage par la communaute.
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

function communityBoardToGeneratedBoard(board: CommunityBoard): GeneratedBoard | null {
  if (!Array.isArray(board.tiles)) return null;

  const tiles = board.tiles.filter(isBoardTile);
  if (tiles.length === 0) return null;

  return {
    tiles,
    fastestPathLength: tiles.filter((tile) => tile.isMainPath).length,
    targetMinutes: 0,
    playerCount: 0,
    counts: getBoardRoleCounts(tiles),
  };
}

function createBoardFromTemplate(templateId: string): GeneratedBoard {
  if (templateId === 'two-detours') {
    return createTemplateBoard(22, [
      { start: 4, end: 10, lane: -1, pathKind: 'bonusDetour' },
      { start: 12, end: 18, lane: 1, pathKind: 'riskyShortcut' },
    ]);
  }

  if (templateId === 'shortcut') {
    return createTemplateBoard(20, [
      { start: 5, end: 10, lane: 1, pathKind: 'riskyShortcut' },
      { start: 11, end: 17, lane: -1, pathKind: 'bonusDetour' },
    ]);
  }

  return createTemplateBoard(18, [
    { start: 4, end: 12, lane: -1, pathKind: 'bonusDetour' },
  ]);
}

function createTemplateBoard(
  mainLength: number,
  branches: Array<{ start: number; end: number; lane: number; pathKind: Extract<BoardPathKind, 'bonusDetour' | 'riskyShortcut'> }>
): GeneratedBoard {
  const hubIndexes = new Set<number>([0, mainLength - 1]);
  branches.forEach((branch) => {
    hubIndexes.add(branch.start);
    hubIndexes.add(branch.end);
  });

  const tiles: BoardTile[] = [];

  for (let q = 0; q < mainLength; q += 1) {
    tiles.push(createBoardTile(q, 0, 'main', true, hubIndexes.has(q), q, mainLength - 1));
  }

  branches.forEach((branch) => {
    for (let q = branch.start; q <= branch.end; q += 1) {
      tiles.push(createBoardTile(q, branch.lane, branch.pathKind, false, false, q, mainLength - 1));
    }
  });

  return {
    tiles,
    fastestPathLength: mainLength,
    targetMinutes: 0,
    playerCount: 0,
    counts: getBoardRoleCounts(tiles),
  };
}

function createBoardTile(
  q: number,
  r: number,
  pathKind: BoardPathKind,
  isMainPath: boolean,
  isHub: boolean,
  pathIndex: number,
  finishIndex: number
): BoardTile {
  const isStart = isMainPath && pathIndex === 0;
  const isFinish = isMainPath && pathIndex === finishIndex;
  const role = chooseTemplateRole(pathKind, isStart || isFinish, pathIndex);

  return {
    id: coordKey({ q, r }),
    q,
    r,
    role,
    pathKind: isHub ? 'hub' : pathKind,
    isMainPath,
    isHub,
    isStart,
    isFinish,
  };
}

function chooseTemplateRole(pathKind: BoardPathKind, isEndpoint: boolean, pathIndex: number): BoardTileRole {
  if (isEndpoint || pathKind === 'hub') return 'neutral';
  if (pathKind === 'bonusDetour') return pathIndex % 4 === 0 ? 'neutral' : 'bonus';
  if (pathKind === 'riskyShortcut') return pathIndex % 4 === 0 ? 'neutral' : 'malus';
  if (pathIndex % 7 === 0) return 'bonus';
  if (pathIndex % 5 === 0) return 'malus';

  return 'neutral';
}

function getBoardRoleCounts(tiles: BoardTile[]) {
  return tiles.reduce<Record<BoardTileRole, number>>(
    (counts, tile) => {
      counts[tile.role] += 1;
      return counts;
    },
    { malus: 0, bonus: 0, neutral: 0 }
  );
}

function isBoardTile(tile: unknown): tile is BoardTile {
  if (!tile || typeof tile !== 'object') return false;

  const candidate = tile as Partial<BoardTile>;
  return typeof candidate.id === 'string'
    && typeof candidate.q === 'number'
    && typeof candidate.r === 'number'
    && isBoardTileRole(candidate.role)
    && isBoardPathKind(candidate.pathKind)
    && typeof candidate.isMainPath === 'boolean'
    && typeof candidate.isHub === 'boolean'
    && typeof candidate.isStart === 'boolean'
    && typeof candidate.isFinish === 'boolean';
}

function isBoardTileRole(role: unknown): role is BoardTileRole {
  return role === 'malus' || role === 'bonus' || role === 'neutral';
}

function isBoardPathKind(pathKind: unknown): pathKind is BoardPathKind {
  return pathKind === 'main'
    || pathKind === 'hub'
    || pathKind === 'bonusDetour'
    || pathKind === 'riskyShortcut';
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
