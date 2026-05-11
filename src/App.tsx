import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import Navigation from './components/Navigation';
import DeckCreator from './pages/DeckCreator';
import GamePage from './pages/GamePage';
import ReviewPage from './pages/ReviewPage';
import AuthPage from './pages/AuthPage';
import { Profile, supabase } from './lib/supabase';

type Page = 'creator' | 'game' | 'review';

interface QuarantineNotification {
  id: string;
  question: string;
  quarantine_note: string | null;
  quarantined_at: string | null;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('creator');
  const [isGameInProgress, setIsGameInProgress] = useState(false);
  const [pendingPage, setPendingPage] = useState<Page | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [quarantineNotifications, setQuarantineNotifications] = useState<QuarantineNotification[]>([]);
  const [quarantineNoticeOpen, setQuarantineNoticeOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setProfile(null);
        setQuarantineNotifications([]);
        setQuarantineNoticeOpen(false);
        setIsAuthLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setCurrentPage('creator');

      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setProfile(null);
        setQuarantineNotifications([]);
        setQuarantineNoticeOpen(false);
        setIsAuthLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setProfile(data);
    setIsAuthLoading(false);
    loadQuarantineNotifications(userId);
  };

  const loadQuarantineNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('flashcards')
      .select('id, question, quarantine_note, quarantined_at')
      .eq('created_by', userId)
      .eq('status', 'quarantine')
      .order('quarantined_at', { ascending: false });

    if (data && data.length > 0) {
      setQuarantineNotifications(data);
      setQuarantineNoticeOpen(true);
      return;
    }

    setQuarantineNotifications([]);
    setQuarantineNoticeOpen(false);
  };

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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Chargement...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen app-shell pb-20">
      <div className="app-topbar flex justify-between items-center">
        <div className="min-w-0 pr-3">
          <div className="text-sm font-black brand-title leading-tight">Spaced Memory</div>
          <div className="text-xs text-slate-500 truncate">
            {profile.email || user.email}
            {profile.role === 'admin' && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                Admin
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs font-semibold text-rose-600"
        >
          Deconnexion
        </button>
      </div>

      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />

      {currentPage === 'creator' && <DeckCreator user={user} profile={profile} />}

      {currentPage === 'game' && (
        <GamePage user={user} profile={profile} setIsGameInProgress={setIsGameInProgress} />
      )}

      {currentPage === 'review' && <ReviewPage user={user} />}

      {confirmLeaveOpen && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
          <div className="app-panel rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Quitter la partie ?
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Si vous revenez à la page Créer, la partie en cours sera interrompue.
            </p>

            <div className="flex gap-2">
              <button
                onClick={confirmLeaveGame}
                className="flex-1 px-4 py-2 app-danger rounded-lg transition-colors"
              >
                Quitter
              </button>

              <button
                onClick={cancelLeaveGame}
                className="flex-1 px-4 py-2 app-muted-button rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {quarantineNoticeOpen && quarantineNotifications.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
          <div className="app-panel rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Carte en quarantaine
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              {quarantineNotifications.length === 1
                ? 'Une de tes cartes doit etre relue.'
                : `${quarantineNotifications.length} de tes cartes doivent etre relues.`}
            </p>

            <div className="space-y-2 max-h-64 overflow-auto mb-5">
              {quarantineNotifications.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <div className="text-sm font-semibold text-gray-900 break-words">
                    {item.question}
                  </div>
                  {item.quarantine_note && (
                    <div className="mt-1 text-xs text-orange-900 break-words">
                      {item.quarantine_note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCurrentPage('creator');
                  setQuarantineNoticeOpen(false);
                }}
                className="flex-1 px-4 py-2 app-primary rounded-lg"
              >
                Voir
              </button>

              <button
                onClick={() => setQuarantineNoticeOpen(false)}
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

export default App;
