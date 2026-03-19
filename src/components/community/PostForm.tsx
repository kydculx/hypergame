import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../hooks/useUserStore';

interface PostFormProps {
    onClose: () => void;
    onSuccess: () => void;
    editingPost?: {
        id: string;
        title: string;
        content: string;
        author_name: string;
    };
}

const PostForm: React.FC<PostFormProps> = ({ onClose, onSuccess, editingPost }) => {
    const { t } = useTranslation();
    const user = useUserStore((state) => state.user);
    const storeUserName = useUserStore((state) => state.userName);
    
    const [title, setTitle] = useState(editingPost?.title || '');
    const [content, setContent] = useState(editingPost?.content || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        const currentAuthorName = user?.user_metadata?.user_name || storeUserName || 'Anonymous';

        setIsSubmitting(true);
        try {
            if (editingPost) {
                const { error } = await supabase
                    .from('posts')
                    .update({
                        title,
                        content,
                        author_name: currentAuthorName // Update name if user changed their nickname
                    })
                    .eq('id', editingPost.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('posts')
                    .insert([
                        {
                            title,
                            content,
                            author_name: currentAuthorName,
                            author_id: user?.id || null
                        }
                    ]);

                if (error) throw error;
            }
            onSuccess();
        } catch (err) {
            console.error('Error submitting post:', err);
            alert(editingPost ? t('community.error_submit') : t('community.error_submit'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <div 
                className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">
                        {editingPost ? t('community.edit') : t('community.write')}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-sm font-medium text-slate-400">
                                {t('community.title_label')}
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                                {title.length}/50
                            </span>
                        </div>
                        <input
                            type="text"
                            required
                            maxLength={50}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all font-medium"
                            placeholder="글 제목을 입력하세요 (최대 50자)"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-sm font-medium text-slate-400">
                                {t('community.content_label')}
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                                {content.length}/50
                            </span>
                        </div>
                        <textarea
                            required
                            rows={8}
                            maxLength={50}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none"
                            placeholder="내용을 입력하세요... (최대 50자)"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                        >
                            {t('community.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? t('community.loading') : t('community.submit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PostForm;
