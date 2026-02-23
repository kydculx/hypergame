import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, Lock, User, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Helper SVG Icons for Apple and Google
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);



interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleOAuthLogin = async (provider: 'google') => {
        setError(null);
        setLoading(true);
        try {
            // Determine the correct redirect URL based on environment
            // Use window.location.origin to support any port (e.g., 3000, 5173) and production domains
            const redirectUrl = window.location.origin;

            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectUrl
                }
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || `An error occurred during ${provider} authentication`);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onClose();
            } else {
                if (!username.trim()) throw new Error('Username is required');

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            user_name: username.trim(),
                        }
                    }
                });
                if (error) throw error;
                // If email confirmation is off, this practically logs them in immediately
                onClose();
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-[15vh]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="relative w-full max-w-md bg-[#0f1123]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in duration-200 mt-[-10vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-black tracking-tight text-white">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-slate-400 mt-2 font-medium text-sm">
                        {isLogin ? 'Sign in to save your high scores!' : 'Join to climb the global leaderboards!'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/20 text-red-200 text-sm font-medium rounded-lg border border-red-500/30">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-400" size={20} />
                            <input
                                type="text"
                                placeholder="Public Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium"
                                required={!isLogin}
                            />
                        </div>
                    )}

                    <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-400" size={20} />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium"
                            required
                        />
                    </div>

                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-400" size={20} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none disabled:hover:scale-100 mt-2"
                    >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                {/* OAuth Dividers & Buttons */}
                <div className="mt-8">
                    <div className="relative flex items-center mb-6">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase tracking-wider">or continue with</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => handleOAuthLogin('google')}
                            disabled={loading}
                            className="w-full py-3 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none disabled:hover:scale-100"
                        >
                            <GoogleIcon />
                            Google
                        </button>
                    </div>
                </div>

                <div className="mt-6 text-center text-sm text-slate-400">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                        }}
                        className="text-cyan-400 font-bold hover:text-cyan-300 hover:underline transition-colors"
                    >
                        {isLogin ? 'Create one' : 'Sign in'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
