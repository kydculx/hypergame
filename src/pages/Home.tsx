import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, type Game } from '../hooks/useGameStore';
import { Header } from '../components/layout/Header';
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
            <Header />

            {/* Hero Section */}
            <section className="relative pt-32 pb-12 px-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto z-10 w-full">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-white/80 text-xs font-medium tracking-wide">New games added weekly</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    Play <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">Instantly.</span><br />
                    Zero Downloads.
                </h1>

                <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl font-light animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    Discover and play the best free hyper-casual HTML5 games directly in your browser. No installation required.
                </p>

                <button
                    onClick={() => document.getElementById('game-grid')?.scrollIntoView({ behavior: 'smooth' })}
                    className="group relative px-8 py-4 bg-white text-black font-bold text-lg rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 group-hover:text-white transition-colors duration-300 flex items-center gap-2">
                        Start Playing
                        <svg className="w-5 h-5 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </span>
                </button>
            </section>

            <div id="game-grid">
                <GameGrid games={games} onGameSelect={handlePlay} />
            </div>
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
