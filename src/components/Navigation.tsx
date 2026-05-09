import { BookOpen, Play } from 'lucide-react';

interface NavigationProps {
  currentPage: 'creator' | 'game';
  onNavigate: (page: 'creator' | 'game') => void;
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
      <div className="flex">
        <button
          onClick={() => onNavigate('creator')}
          className={`flex-1 flex flex-col items-center justify-center py-4 transition-all ${
            currentPage === 'creator'
              ? 'text-blue-600 border-t-2 border-blue-600'
              : 'text-gray-600'
          }`}
        >
          <BookOpen className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Créer</span>
        </button>

        <button
          onClick={() => onNavigate('game')}
          className={`flex-1 flex flex-col items-center justify-center py-4 transition-all ${
            currentPage === 'game'
              ? 'text-blue-600 border-t-2 border-blue-600'
              : 'text-gray-600'
          }`}
        >
          <Play className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Jouer</span>
        </button>
      </div>
    </nav>
  );
}
