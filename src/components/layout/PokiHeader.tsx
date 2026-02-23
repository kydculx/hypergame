import React, { useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { UserProfile } from './UserProfile';
import Leaderboard from '../Leaderboard';

export const PokiHeader: React.FC = () => {
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

    return (
        <>
            <header className="fixed top-0 left-0 w-full z-40 bg-black/20 backdrop-blur-md border-b border-white/5 transition-all duration-300">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between p-4 px-6">
                    {/* Logo Container */}
                    <div
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="flex items-center gap-3 cursor-pointer group"
                    >
                        <div className="bg-white p-1.5 rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300">
                            <img src="/images/wc-icon.png" alt="WCGames" className="w-7 h-7" />
                        </div>
                        <span className="font-extrabold text-white text-xl tracking-tight hidden sm:block drop-shadow-sm group-hover:text-cyan-400 transition-colors">
                            WCGames
                        </span>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-4 border border-white/10 bg-black/20 rounded-full p-1.5">
                        {/* Leaderboard Button */}
                        <button
                            onClick={() => setIsLeaderboardOpen(true)}
                            className="bg-white/5 hover:bg-white/20 p-2.5 rounded-full text-amber-500 hover:text-amber-400 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
                            title="Leaderboard"
                        >
                            <Trophy size={20} className="drop-shadow-sm" />
                        </button>

                        <div className="w-[1px] h-6 bg-white/10"></div>

                        {/* User Profile */}
                        <div className="pr-1">
                            <UserProfile />
                        </div>
                    </div>
                </div>
            </header>

            {/* Leaderboard Modal */}
            {isLeaderboardOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsLeaderboardOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto hidden-scrollbar rounded-2xl animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsLeaderboardOpen(false)}
                            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <Leaderboard />
                    </div>
                </div>
            )}
        </>
    );
};
