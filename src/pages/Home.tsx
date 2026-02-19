import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, type Game } from '../hooks/useGameStore';
import { PokiHeader } from '../components/layout/PokiHeader';
import { GameGrid } from '../components/layout/GameGrid';

const Home: React.FC = () => {
    const games = useGameStore((state) => state.games);
    const setCurrentGame = useGameStore((state) => state.setCurrentGame);
    const navigate = useNavigate();

    const handlePlay = (game: Game) => {
        setCurrentGame(game);
        navigate(`/play/${game.id}`);
    };

    return (
        <div className="min-h-screen">
            <PokiHeader />
            <GameGrid games={games} onGameSelect={handlePlay} />

            {/* Background decoration if needed, but CSS body gradient handles most of it */}
        </div>
    );
};

export default Home;
