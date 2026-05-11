import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import { supabase, Deck, Flashcard, Profile } from '../lib/supabase';


const DIFFICULTY_COLORS = {
  1: '#4F46E5',
  2: '#14B8A6',
  3: '#F59E0B',
  4: '#F97316',
  5: '#E11D48',
};

interface DeckCreatorProps {
  user: User;
  profile: Profile;
}

export default function DeckCreator({ user, profile }: DeckCreatorProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [quarantineCountsByDeck, setQuarantineCountsByDeck] = useState<Record<string, number>>({});
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckVisibility, setNewDeckVisibility] = useState<'personal' | 'public'>('personal');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newDifficulty, setNewDifficulty] = useState(1);
  const [view, setView] = useState<'decks' | 'cards'>('decks');

  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editDifficulty, setEditDifficulty] = useState(1);
  const [flashcardToDelete, setFlashcardToDelete] = useState<Flashcard | null>(null);

  const [editingDeck, setEditingDeck] = useState<string | null>(null);
  const [editDeckName, setEditDeckName] = useState('');
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

  useEffect(() => {
    loadDecks();
  }, [profile.role, user.id]);

  const isAdmin = profile.role === 'admin';

  useEffect(() => {
    if (selectedDeck) loadFlashcards(selectedDeck.id);
  }, [selectedDeck]);

  const loadDecks = async () => {
    const { data } = await supabase
      .from('decks')
      .select('*')
      .order('name', { ascending: true });

    if (data) {
      setDecks(data.filter((deck) => canEditDeck(deck)));
    }

    await loadQuarantineCounts();
  };

  const loadQuarantineCounts = async () => {
    const { data } = await supabase
      .from('flashcards')
      .select('id, deck_id')
      .eq('status', 'quarantine');

    if (!data) return;

    setQuarantineCountsByDeck(
      data.reduce<Record<string, number>>((counts, card) => {
        counts[card.deck_id] = (counts[card.deck_id] ?? 0) + 1;
        return counts;
      }, {})
    );
  };

  const loadFlashcards = async (deckId: string) => {
    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId);

    if (data) setFlashcards(data);
  };

  const createDeck = async () => {
    if (!newDeckName.trim()) return;

    const { data } = await supabase
      .from('decks')
      .insert([{
        name: newDeckName,
        owner_id: user.id,
        visibility: isAdmin ? newDeckVisibility : 'personal',
      }])
      .select()
      .single();

    if (data) {
      setDecks([data, ...decks]);
      setNewDeckName('');
      setNewDeckVisibility('personal');
    }
  };

  const updateDeck = async (id: string, name: string) => {
    const { error } = await supabase
      .from('decks')
      .update({ name })
      .eq('id', id);
  
    if (!error) {
      setDecks(decks.map(d => d.id === id ? { ...d, name } : d));
  
      if (selectedDeck?.id === id) {
        setSelectedDeck({ ...selectedDeck, name });
      }
  
      setEditingDeck(null);
    }
  };

  const canEditDeck = (deck: Deck) => {
    return (deck.visibility === 'public' && isAdmin)
      || (deck.visibility === 'personal' && deck.owner_id === user.id);
  };

  const deleteDeck = async (id: string) => {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', id);
  
    if (!error) {
      setDecks(decks.filter(d => d.id !== id));
  
      if (selectedDeck?.id === id) {
        setSelectedDeck(null);
        setFlashcards([]);
      }
    }
  };

  const deckHasQuarantine = (deckId: string) => {
    return (quarantineCountsByDeck[deckId] ?? 0) > 0;
  };

  const createFlashcard = async () => {
    if (!selectedDeck) return;

    const { data } = await supabase
      .from('flashcards')
      .insert([
        {
          deck_id: selectedDeck.id,
          question: newQuestion,
          answer: newAnswer,
          difficulty: newDifficulty,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (data) {
      setFlashcards([data, ...flashcards]);
      setNewQuestion('');
      setNewAnswer('');
      setNewDifficulty(1);
    }
  };

  const deleteFlashcard = async (id: string) => {
    await supabase.from('flashcards').delete().eq('id', id);
    setFlashcards(flashcards.filter((f) => f.id !== id));
  };

  const reactivateFlashcard = async (id: string) => {
    await supabase
      .from('flashcards')
      .update({
        status: 'active',
        quarantine_note: null,
        quarantined_by: null,
        quarantined_at: null,
      })
      .eq('id', id);

    setFlashcards(
      flashcards.map((f) =>
        f.id === id
          ? {
              ...f,
              status: 'active',
              quarantine_note: null,
              quarantined_by: null,
              quarantined_at: null,
            }
          : f
      )
    );

    loadQuarantineCounts();
  };

  const updateFlashcard = async () => {
    if (!editingFlashcard) return;

    await supabase
      .from('flashcards')
      .update({
        question: editQuestion,
        answer: editAnswer,
        difficulty: editDifficulty,
      })
      .eq('id', editingFlashcard.id);

    setFlashcards(
      flashcards.map((f) =>
        f.id === editingFlashcard.id
          ? {
              ...f,
              question: editQuestion,
              answer: editAnswer,
              difficulty: editDifficulty,
            }
          : f
      )
    );

    setEditingFlashcard(null);
  };



  if (view === 'cards' && selectedDeck) {
    return (
      <div className="min-h-screen app-shell pt-4 px-4">
        <button
          onClick={() => setView('decks')}
          className="mb-4 text-violet-700 font-medium"
        >
          ← Retour
        </button>

        <div className="mission-strip p-5 mb-6">
          <div className="relative z-10">
            <h2 className="text-3xl font-black leading-tight">{selectedDeck.name}</h2>
          </div>
        </div>

        <div className="space-y-3 mb-6">
  <input
    type="text"
    value={newQuestion}
    onChange={(e) => setNewQuestion(e.target.value)}
    placeholder="Question"
    maxLength={200}
    className="w-full px-4 py-3 border rounded-lg outline-none text-sm app-input"
  />
  <input
    type="text"
    value={newAnswer}
    onChange={(e) => setNewAnswer(e.target.value)}
    placeholder="Réponse"
    maxLength={200}
    className="w-full px-4 py-3 border rounded-lg outline-none text-sm app-input"
  />

  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Difficulté
    </label>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          onClick={() => setNewDifficulty(level)}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-white text-sm transition-all difficulty-chip ${
            newDifficulty === level ? 'ring-2 ring-offset-2 ring-gray-400' : ''
          }`}
          style={{
            backgroundColor: DIFFICULTY_COLORS[level as keyof typeof DIFFICULTY_COLORS],
            opacity: newDifficulty === level ? 1 : 0.6,
          }}
        >
          {level}
        </button>
      ))}
    </div>
  </div>

  <button
    onClick={createFlashcard}
    className="w-full px-4 py-3 app-primary rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium"
  >
    <Plus className="w-5 h-5" />
    <span>Ajouter</span>
  </button>
</div>

        {flashcards.map((card) => (
          <div
            key={card.id}
            className={`p-3 mb-2 app-card rounded border-l-4 ${
              card.status === 'quarantine' ? 'opacity-60' : ''
            }`}
            style={{
              borderLeftColor:
                DIFFICULTY_COLORS[
                  card.difficulty as keyof typeof DIFFICULTY_COLORS
                ],
            }}
          >
            <div className="font-semibold">{card.question}</div>
            <div className="text-sm text-gray-600">{card.answer}</div>

            {card.status === 'quarantine' && (
              <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800">
                <div className="font-semibold">En quarantaine</div>
                {card.quarantine_note && (
                  <div className="mt-1 text-orange-900">{card.quarantine_note}</div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              {card.status === 'quarantine' && (
                <button
                  onClick={() => reactivateFlashcard(card.id)}
                  className="px-2 py-1 text-xs bg-teal-600 text-white rounded"
                >
                  Réactiver
                </button>
              )}

              <button
                onClick={() => {
                  setEditingFlashcard(card);
                  setEditQuestion(card.question);
                  setEditAnswer(card.answer);
                  setEditDifficulty(card.difficulty);
                }}
                className="px-2 py-1 text-xs bg-violet-600 text-white rounded"
              >
                Modifier
              </button>

              <button
                onClick={() => setFlashcardToDelete(card)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                  >
                    Supprimer
              </button>
            </div>
          </div>
        ))}

        {editingFlashcard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="app-panel p-6 rounded w-full max-w-md">
              <h3 className="font-bold mb-4">Modifier la flashcard</h3>

              <input
                value={editQuestion}
                onChange={(e)=>setEditQuestion(e.target.value)}
                className="w-full p-2 border rounded mb-2"
              />

              <input
                value={editAnswer}
                onChange={(e)=>setEditAnswer(e.target.value)}
                className="w-full p-2 border rounded mb-2"
              />

<div className="flex gap-2 mb-4">
  {[1,2,3,4,5].map((d)=>(
    <button
      key={d}
      onClick={()=>setEditDifficulty(d)}
      className={`flex-1 py-2 px-3 rounded-lg font-medium text-white text-sm transition-all difficulty-chip ${
        editDifficulty === d ? 'ring-2 ring-offset-2 ring-gray-400' : ''
      }`}
      style={{
        backgroundColor: DIFFICULTY_COLORS[d as keyof typeof DIFFICULTY_COLORS],
        opacity: editDifficulty === d ? 1 : 0.6,
      }}
    >
      {d}
    </button>
  ))}
</div>

              <div className="flex gap-2">
                <button
                  onClick={updateFlashcard}
                  className="flex-1 app-primary py-2 rounded"
                >
                  Enregistrer
                </button>

                <button
                  onClick={()=>setEditingFlashcard(null)}
                  className="flex-1 app-muted-button py-2 rounded"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {flashcardToDelete && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="app-panel p-6 rounded w-full max-w-sm">
      <h3 className="font-bold mb-4">Supprimer la flashcard</h3>

      <p className="mb-4 text-sm text-gray-600">
        Voulez-vous vraiment supprimer cette carte ?
      </p>

      <div className="mb-4 p-3 bg-white/70 rounded border border-violet-100">
        <div className="font-semibold text-sm text-gray-800">
          {flashcardToDelete.question}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {flashcardToDelete.answer}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            deleteFlashcard(flashcardToDelete.id);
            setFlashcardToDelete(null);
          }}
          className="flex-1 bg-red-600 text-white py-2 rounded"
        >
          Supprimer
        </button>

        <button
          onClick={() => setFlashcardToDelete(null)}
          className="flex-1 app-muted-button py-2 rounded"
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

  return (
    <div className="p-4 min-h-screen app-shell">
      <div className="mission-strip p-5 mb-6">
        <div className="relative z-10">
          <h2 className="text-3xl font-black leading-tight">Paquets</h2>
        </div>
      </div>

      <input
        value={newDeckName}
        onChange={(e) => setNewDeckName(e.target.value)}
        placeholder="Nom du paquet"
        className="w-full p-2 border rounded mb-2 app-input outline-none"
      />

      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setNewDeckVisibility('personal')}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              newDeckVisibility === 'personal'
                ? 'app-primary'
                : 'bg-white/90 border border-gray-200 text-gray-700'
            }`}
          >
            Personnel
          </button>
          <button
            onClick={() => setNewDeckVisibility('public')}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              newDeckVisibility === 'public'
                ? 'app-primary'
                : 'bg-white/90 border border-gray-200 text-gray-700'
            }`}
          >
            Public
          </button>
        </div>
      )}

      <button
        onClick={createDeck}
        className="app-primary px-4 py-2 rounded mb-4"
      >
        Créer
      </button>

      {decks.map((deck) => (
        <div
          key={deck.id}
          className="p-3 mb-2 app-card rounded flex justify-between items-center"
        >
          <button
  onClick={() => {
    setSelectedDeck(deck);
    setView('cards');
  }}
  className="flex-1 text-left flex items-center gap-2"
>
  <span>{deck.name}</span>
  <span className={`text-xs px-2 py-0.5 rounded-full ${
    deck.visibility === 'public'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-600'
  }`}>
    {deck.visibility === 'public' ? 'Public' : 'Perso'}
  </span>

  {deckHasQuarantine(deck.id) && (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-100 px-1.5 text-xs font-bold text-orange-700"
      title="Cartes en quarantaine"
    >
      ⚠ {quarantineCountsByDeck[deck.id]}
    </span>
  )}
</button>

          <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingDeck(deck.id);
              setEditDeckName(deck.name);
            }}
            className="px-2 py-1 text-xs bg-violet-600 text-white rounded"
          >
            Renommer
          </button>

          <button
            onClick={() => setDeckToDelete(deck)}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded"
          >
            Supprimer
          </button>
        </div>
      </div>
    ))}

{editingDeck && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="app-panel p-6 rounded w-full max-w-sm">
      <h3 className="font-bold mb-4">Renommer le paquet</h3>

      <input
        value={editDeckName}
        onChange={(e)=>setEditDeckName(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />

      <div className="flex gap-2">
        <button
          onClick={() => updateDeck(editingDeck, editDeckName)}
          className="flex-1 app-primary py-2 rounded"
        >
          Valider
        </button>

        <button
          onClick={()=>setEditingDeck(null)}
          className="flex-1 app-muted-button py-2 rounded"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}

{deckToDelete && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="app-panel p-6 rounded w-full max-w-sm">
      <h3 className="font-bold mb-4">Supprimer le paquet</h3>

      <p className="mb-4">
        Supprimer "{deckToDelete.name}" ?
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => {
            deleteDeck(deckToDelete.id);
            setDeckToDelete(null);
          }}
          className="flex-1 bg-red-600 text-white py-2 rounded"
        >
          Supprimer
        </button>

        <button
          onClick={()=>setDeckToDelete(null)}
          className="flex-1 app-muted-button py-2 rounded"
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
