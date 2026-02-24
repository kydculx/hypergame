import React from 'react';
import { GameCard } from '../ui/GameCard';
import type { Game } from '../../hooks/useGameStore';
import { useTranslation } from 'react-i18next';

interface GameGridProps {
    games: Game[];
    onGameSelect: (game: Game) => void;
}

export const GameGrid: React.FC<GameGridProps> = ({ games, onGameSelect }) => {
    const { t } = useTranslation();
    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 pt-12 pb-12">
            {/* 
        Grid setup:
        - Mobile: 2 columns
        - Tablet: 3-4 columns
        - Desktop: 6 columns 
      */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[160px]">
                {games.map((game) => (
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
