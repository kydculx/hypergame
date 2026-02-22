import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, type Game } from '../hooks/useGameStore';
import { PokiHeader } from '../components/layout/PokiHeader';
import { GameGrid } from '../components/layout/GameGrid';
import { PortalBackground } from '../components/layout/PortalBackground';

const Home: React.FC = () => {
    const games = useGameStore((state) => state.games);
    const setCurrentGame = useGameStore((state) => state.setCurrentGame);
    const navigate = useNavigate();

    const handlePlay = (game: Game) => {
        setCurrentGame(game);
        navigate(`/play/${game.id}`);
    };

    return (
        <div className="min-h-screen relative z-0">
            <PortalBackground />
            <PokiHeader />
            <GameGrid games={games} onGameSelect={handlePlay} />
        </div>
    );
};

export default Home;
