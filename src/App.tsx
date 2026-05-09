import { useState } from 'react';
import Navigation from './components/Navigation';
import DeckCreator from './pages/DeckCreator';
import GamePage from './pages/GamePage';
import ReviewPage from './pages/ReviewPage';

type Page = 'creator' | 'game' | 'review';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('creator');
  const [isGameInProgress, setIsGameInProgress] = useState(false);
  const [pendingPage, setPendingPage] = useState<Page | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const handleNavigate = (page: Page) => {
    if (
      currentPage === 'game' &&
      page !== 'game' &&
      isGameInProgress
    ) {
      setPendingPage(page);
      setConfirmLeaveOpen(true);
      return;
    }

    setCurrentPage(page);
  };

  const confirmLeaveGame = () => {
    if (pendingPage) {
      setCurrentPage(pendingPage);
    }
    setIsGameInProgress(false);
    setPendingPage(null);
    setConfirmLeaveOpen(false);
  };

  const cancelLeaveGame = () => {
    setPendingPage(null);
    setConfirmLeaveOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />

      {currentPage === 'creator' && <DeckCreator />}

      {currentPage === 'game' && (
        <GamePage setIsGameInProgress={setIsGameInProgress} />
      )}

      {currentPage === 'review' && <ReviewPage />}

      {confirmLeaveOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Quitter la partie ?
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Si vous revenez à la page Créer, la partie en cours sera interrompue.
            </p>

            <div className="flex gap-2">
              <button
                onClick={confirmLeaveGame}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Quitter
              </button>

              <button
                onClick={cancelLeaveGame}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
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

export default App;
