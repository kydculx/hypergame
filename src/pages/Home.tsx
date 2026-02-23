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
            <footer className="relative py-12 px-6 mt-12 mb-20 bg-black/30 backdrop-blur-sm border-t border-white/5">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                            WCGames
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Play the best web games for free.
                        </p>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-2">
                        <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">
                            Contact & Support
                        </p>
                        <a
                            href="mailto:kydculx@gmail.com"
                            className="text-slate-300 hover:text-cyan-400 transition-colors duration-200 text-sm font-medium"
                        >
                            kydculx@gmail.com
                        </a>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-slate-600 text-[10px] uppercase tracking-tighter">
                        © {new Date().getFullYear()} WCGames. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Home;
