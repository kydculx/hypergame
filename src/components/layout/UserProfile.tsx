import React, { useState } from 'react';
import { User, LogOut, Loader2 } from 'lucide-react';
import { useUserStore } from '../../hooks/useUserStore';
import { AuthModal } from './AuthModal';

export const UserProfile: React.FC = () => {
    const { userName, user, logout } = useUserStore();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleProfileClick = () => {
        if (!user) {
            setIsAuthModalOpen(true);
        } else {
            setIsMenuOpen(!isMenuOpen);
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            setIsMenuOpen(false);
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleProfileClick}
                className="bg-white pl-2 pr-4 py-2 rounded-full shadow-lg flex items-center gap-3 hover:scale-105 transition-all duration-200 group relative"
            >
                <div className={`p-2 rounded-full transition-colors ${user ? 'bg-blue-100 group-hover:bg-blue-200' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                    <User size={20} className={`transition-colors ${user ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>

                <div className="flex flex-col items-start cursor-pointer">
                    <span className={`font-bold text-sm max-w-[100px] truncate transition-colors ${user ? 'text-blue-700' : 'text-gray-700'}`}>
                        {userName}
                    </span>
                    {!user && <span className="text-[10px] text-gray-400 font-medium -mt-1 tracking-wide">Click to Login</span>}
                </div>
            </button>

            {/* Authenticated User Dropdown Menu */}
            {user && isMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl z-50 overflow-hidden border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            <span className="font-semibold">Sign Out</span>
                            {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                        </button>
                    </div>
                </>
            )}

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </div>
    );
};
