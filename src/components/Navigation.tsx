import { BookOpen, Brain, Play } from 'lucide-react';

interface NavigationProps {
  currentPage: 'creator' | 'game' | 'review';
  onNavigate: (page: 'creator' | 'game' | 'review') => void;
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 app-nav z-50">
      <div className="flex">
        <button
          onClick={() => onNavigate('creator')}
          className={`relative flex-1 flex flex-col items-center justify-center py-4 transition-all ${
            currentPage === 'creator'
              ? 'app-nav-item-active'
              : 'app-nav-item'
          }`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 ${
            currentPage === 'creator' ? 'bg-violet-100' : 'bg-transparent'
          }`}>
            <BookOpen className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Créer</span>
        </button>

        <button
          onClick={() => onNavigate('game')}
          className={`relative flex-1 flex flex-col items-center justify-center py-4 transition-all ${
            currentPage === 'game'
              ? 'app-nav-item-active'
              : 'app-nav-item'
          }`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 ${
            currentPage === 'game' ? 'bg-teal-100' : 'bg-transparent'
          }`}>
            <Play className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Jouer</span>
        </button>

        <button
          onClick={() => onNavigate('review')}
          className={`relative flex-1 flex flex-col items-center justify-center py-4 transition-all ${
            currentPage === 'review'
              ? 'app-nav-item-active'
              : 'app-nav-item'
          }`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 ${
            currentPage === 'review' ? 'bg-amber-100' : 'bg-transparent'
          }`}>
            <Brain className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Reviser</span>
        </button>
      </div>
    </nav>
  );
}
