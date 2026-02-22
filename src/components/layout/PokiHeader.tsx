import React, { useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { UserProfile } from './UserProfile';
import Leaderboard from '../Leaderboard';

export const PokiHeader: React.FC = () => {
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

    return (
        <>
            <header className="fixed top-0 left-0 w-full z-40 flex items-center justify-between p-4 pointer-events-none">
                {/* Logo Container */}
                <div className="bg-white rounded-full p-2 pr-4 pl-4 shadow-lg flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform duration-200 pointer-events-auto">
                    <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg pb-0.5">
                        W
                    </div>
                    <span className="font-bold text-gray-800 text-xl tracking-tight hidden sm:block">WCGames</span>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* Leaderboard Button */}
                    <button
                        onClick={() => setIsLeaderboardOpen(true)}
                        className="bg-white p-3 rounded-full shadow-lg text-amber-500 hover:text-amber-600 hover:scale-105 transition-all duration-200"
                    >
                        <Trophy size={24} />
                    </button>

                    {/* User Profile */}
                    <UserProfile />
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
