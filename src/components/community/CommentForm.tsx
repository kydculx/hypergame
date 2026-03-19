import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../hooks/useUserStore';
import { Send } from 'lucide-react';
import { AuthModal } from '../layout/AuthModal';

interface CommentFormProps {
    postId: string;
    onSuccess: () => void;
}

const CommentForm: React.FC<CommentFormProps> = ({ postId, onSuccess }) => {
    const { t } = useTranslation();
    const user = useUserStore((state) => state.user);
    const storeUserName = useUserStore((state) => state.userName);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setIsAuthModalOpen(true);
            return;
        }
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('comments')
                .insert([
                    {
                        post_id: postId,
                        content,
                        author_name: user?.user_metadata?.user_name || storeUserName || 'Anonymous',
                        author_id: user?.id || null
                    }
                ]);

            if (error) throw error;
            
            setContent('');
            onSuccess();
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error submitting comment:', error);
            alert(t('community.error_submit'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <form 
                onSubmit={handleSubmit} 
                className="relative mt-4 flex items-center gap-2"
                onClick={() => !user && setIsAuthModalOpen(true)}
            >
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={content}
                        maxLength={50}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={user ? t('community.write_comment') : t('community.login_required')}
                        disabled={!user || isSubmitting}
                        className={`w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-light ${!user ? 'cursor-pointer opacity-50' : ''}`}
                    />
                    {user && content.length > 0 && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                            {content.length}/50
                        </span>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isSubmitting || (!user ? false : !content.trim())}
                    className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-cyan-500/10 active:scale-90"
                >
                    <Send size={16} />
                </button>
            </form>

            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
        </>
    );
};

export default CommentForm;
