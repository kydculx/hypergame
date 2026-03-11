import React, { useState } from 'react';
import { GameCard } from '../ui/GameCard';
import type { Game } from '../../hooks/useGameStore';
import { useTranslation } from 'react-i18next';

interface GameGridProps {
    games: Game[];
    onGameSelect: (game: Game) => void;
}

const CATEGORIES = ['all', 'action', 'puzzle', 'casual'] as const;
type Category = typeof CATEGORIES[number];

export const GameGrid: React.FC<GameGridProps> = ({ games, onGameSelect }) => {
    const { t } = useTranslation();
    const [activeCategory, setActiveCategory] = useState<Category>('all');

    const filteredGames = games.filter(game => 
        activeCategory === 'all' ? true : game.categoryId === activeCategory
    );

    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 pt-12 pb-12">
            
            {/* Category Filter Tabs */}
            <div className="flex justify-start md:justify-center mb-10 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-2 p-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10 min-w-max">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                                activeCategory === cat 
                                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.4)]' 
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {t(`categories.${cat}`)}
                        </button>
                    ))}
                </div>
            </div>
            {/* 
        Grid setup:
        - Mobile: 2 columns
        - Tablet: 3-4 columns
        - Desktop: 6 columns 
      */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[160px]">
                {filteredGames.map((game) => (
                    <GameCard
                        key={game.id}
                        title={t(`games.${game.id}.title`)}
                        thumbnail={game.thumbnailUrl}
                        size="medium"
                        category={t(`games.${game.id}.category`)}
                        onClick={() => onGameSelect(game)}
                        className="bg-gray-100" // Fallback color if image loads slow
                    />
                ))}
            </div>
        </div>
    );
};
