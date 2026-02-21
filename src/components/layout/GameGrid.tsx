import React from 'react';
import { GameCard } from '../ui/GameCard';
import type { Game } from '../../hooks/useGameStore';

interface GameGridProps {
    games: Game[];
    onGameSelect: (game: Game) => void;
}

export const GameGrid: React.FC<GameGridProps> = ({ games, onGameSelect }) => {
    // Helper to assign sizes - Force all to square as requested
    const getSize = (_index: number): 'medium' => {
        return 'medium';
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 pt-24 pb-12">
            {/* 
        Grid setup:
        - Mobile: 2 columns
        - Tablet: 3-4 columns
        - Desktop: 6 columns 
      */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[160px]">
                {games.map((game, index) => (
                    <GameCard
                        key={game.id}
                        title={game.title}
                        thumbnail={game.thumbnailUrl} // Note: Store uses thumbnailUrl matching GameCard prop? No GameCard uses 'thumbnail'
                        size={getSize(index)}
                        category={game.category}
                        onClick={() => onGameSelect(game)}
                        className="bg-gray-100" // Fallback color if image loads slow
                    />
                ))}
            </div>



            {/* Footer */}
            <footer className="text-center text-white/80 py-8 text-sm">
                <p>© 2026 WCGames. All rights reserved.</p>
            </footer>
        </div>
    );
};
