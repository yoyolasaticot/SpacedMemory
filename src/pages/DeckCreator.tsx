import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase, Deck, Flashcard } from '../lib/supabase';


const DIFFICULTY_COLORS = {
  1: '#0c13eb',
  2: '#34c924',
  3: '#FFFF00',
  4: '#F97316',
  5: '#EF4444',
};

export default function DeckCreator() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [newDeckName, setNewDeckName] = useState('');
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
  }, []);

  useEffect(() => {
    if (selectedDeck) loadFlashcards(selectedDeck.id);
  }, [selectedDeck]);

  const loadDecks = async () => {
    const { data } = await supabase.from('decks').select('*');
    if (data) setDecks(data);
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
      .insert([{ name: newDeckName }])
      .select()
      .single();

    if (data) {
      setDecks([data, ...decks]);
      setNewDeckName('');
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
  return flashcards.some(
    card => card.deck_id === deckId && card.status === 'quarantine'
  );
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
      .update({ status: 'active' })
      .eq('id', id);

    setFlashcards(
      flashcards.map((f) =>
        f.id === id ? { ...f, status: 'active' } : f
      )
    );
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
      <div className="min-h-screen bg-gray-50 pt-4 px-4">
        <button
          onClick={() => setView('decks')}
          className="mb-4 text-blue-600"
        >
          ← Retour
        </button>

        <h2 className="text-xl font-bold mb-4">{selectedDeck.name}</h2>

        <div className="space-y-3 mb-6">
  <input
    type="text"
    value={newQuestion}
    onChange={(e) => setNewQuestion(e.target.value)}
    placeholder="Question"
    maxLength={200}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
  />
  <input
    type="text"
    value={newAnswer}
    onChange={(e) => setNewAnswer(e.target.value)}
    placeholder="Réponse"
    maxLength={200}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
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
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-white text-sm transition-all ${
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
    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 font-medium"
  >
    <Plus className="w-5 h-5" />
    <span>Ajouter</span>
  </button>
</div>

        {flashcards.map((card) => (
          <div
            key={card.id}
            className={`p-3 mb-2 bg-white rounded shadow border-l-4 ${
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
              <div className="text-xs text-red-600">En quarantaine</div>
            )}

            <div className="flex gap-2 mt-2">
              {card.status === 'quarantine' && (
                <button
                  onClick={() => reactivateFlashcard(card.id)}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded"
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
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
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
            <div className="bg-white p-6 rounded w-full max-w-md">
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
      className={`flex-1 py-2 px-3 rounded-lg font-medium text-white text-sm transition-all ${
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
                  className="flex-1 bg-blue-600 text-white py-2 rounded"
                >
                  Enregistrer
                </button>

                <button
                  onClick={()=>setEditingFlashcard(null)}
                  className="flex-1 bg-gray-300 py-2 rounded"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {flashcardToDelete && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white p-6 rounded w-full max-w-sm">
      <h3 className="font-bold mb-4">Supprimer la flashcard</h3>

      <p className="mb-4 text-sm text-gray-600">
        Voulez-vous vraiment supprimer cette carte ?
      </p>

      <div className="mb-4 p-3 bg-gray-50 rounded border">
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
          className="flex-1 bg-gray-300 py-2 rounded"
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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Paquets</h2>

      <input
        value={newDeckName}
        onChange={(e) => setNewDeckName(e.target.value)}
        placeholder="Nom du paquet"
        className="w-full p-2 border rounded mb-2"
      />

      <button
        onClick={createDeck}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        Créer
      </button>

      {decks.map((deck) => (
        <div
          key={deck.id}
          className="p-3 mb-2 bg-white rounded shadow flex justify-between items-center"
        >
          <button
  onClick={() => {
    setSelectedDeck(deck);
    setView('cards');
  }}
  className="flex-1 text-left flex items-center gap-2"
>
  <span>{deck.name}</span>

  {deckHasQuarantine(deck.id) && (
    <span className="text-yellow-500 text-base">☢</span>
  )}
</button>

          <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingDeck(deck.id);
              setEditDeckName(deck.name);
            }}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
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
    <div className="bg-white p-6 rounded w-full max-w-sm">
      <h3 className="font-bold mb-4">Renommer le paquet</h3>

      <input
        value={editDeckName}
        onChange={(e)=>setEditDeckName(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />

      <div className="flex gap-2">
        <button
          onClick={() => updateDeck(editingDeck, editDeckName)}
          className="flex-1 bg-blue-600 text-white py-2 rounded"
        >
          Valider
        </button>

        <button
          onClick={()=>setEditingDeck(null)}
          className="flex-1 bg-gray-300 py-2 rounded"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}

{deckToDelete && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white p-6 rounded w-full max-w-sm">
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
          className="flex-1 bg-gray-300 py-2 rounded"
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