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
          <BookOpen className="w-6 h-6 mb-1" />
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
          <Play className="w-6 h-6 mb-1" />
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
          <Brain className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Reviser</span>
        </button>
      </div>
    </nav>
  );
}
