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
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={user ? t('community.write_comment') : t('community.login_required')}
                    disabled={!user || isSubmitting}
                    className={`flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-light ${!user ? 'cursor-pointer opacity-50' : ''}`}
                />
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
