import React from 'react';
import { Search } from 'lucide-react';
import { UserProfile } from './UserProfile';

export const PokiHeader: React.FC = () => {
    return (
        <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between p-4 pointer-events-none">
            {/* Logo Container */}
            <div className="bg-white rounded-full p-2 pr-4 pl-4 shadow-lg flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform duration-200 pointer-events-auto">
                <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg pb-0.5">
                    W
                </div>
                <span className="font-bold text-gray-800 text-xl tracking-tight hidden sm:block">WCGames</span>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 pointer-events-auto">
                {/* Search Button */}
                <button className="bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-blue-500 hover:scale-105 transition-all duration-200">
                    <Search size={24} />
                </button>

                {/* User Profile */}
                <UserProfile />
            </div>
        </header>
    );
};
