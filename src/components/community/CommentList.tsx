import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

import { Trash2, Edit2 } from 'lucide-react';
import { useUserStore } from '../../hooks/useUserStore';
import { DeleteConfirmModal } from '../layout/DeleteConfirmModal';

interface Comment {
    id: string;
    created_at: string;
    content: string;
    author_name: string;
    author_id: string | null;
}

interface CommentListProps {
    postId: string;
    refreshTrigger: number;
}

const CommentList: React.FC<CommentListProps> = ({ postId, refreshTrigger }) => {
    const { t } = useTranslation();
    const user = useUserStore((state) => state.user);
    const isAdmin = useUserStore((state) => state.isAdmin);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

    const fetchComments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setComments(data || []);
        } catch (err: unknown) {
            console.error('Error fetching comments:', err);
        } finally {
            setIsLoading(false);
        }
    }, [postId]);

    const handleDeleteComment = async (commentId: string) => {
        setCommentToDelete(commentId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteComment = async () => {
        if (!commentToDelete) return;

        try {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentToDelete);

            if (error) throw error;

            setComments(prev => prev.filter(c => c.id !== commentToDelete));
        } catch (err: any) {
            console.error('Error deleting comment:', err);
            
            let errorMessage = t('community.delete_failed') || '삭제에 실패했습니다.';
            if (err.code === '42501') {
                errorMessage = '권한이 없습니다.';
            }
            alert(errorMessage);
        } finally {
            setCommentToDelete(null);
            setIsDeleteModalOpen(false);
        }
    };

    const handleUpdateComment = async (commentId: string) => {
        if (!editContent.trim()) return;

        try {
            const { error } = await supabase
                .from('comments')
                .update({ content: editContent })
                .eq('id', commentId);

            if (error) throw error;

            setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editContent } : c));
            setEditingComment(null);
        } catch (err: unknown) {
            console.error('Error updating comment:', err);
            alert(t('community.update_failed') || '수정에 실패했습니다.');
        }
    };

    useEffect(() => {
        fetchComments();
    }, [fetchComments, refreshTrigger]);

    if (isLoading && comments.length === 0) {
        return <div className="py-2 text-xs text-slate-500">{t('community.loading')}</div>;
    }

    if (comments.length === 0) {
        return <div className="py-2 text-xs text-slate-500 italic font-light">{t('community.no_comments')}</div>;
    }

    return (
        <div className="space-y-3 mt-4">
            {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 group/comment">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-bold flex-shrink-0">
                        {comment.author_name ? comment.author_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300">{comment.author_name}</span>
                                <span className="text-[10px] text-slate-600 font-mono">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            {(isAdmin || user?.id === comment.author_id) && (
                                <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-all">
                                    <button
                                        onClick={() => {
                                            setEditingComment(comment.id);
                                            setEditContent(comment.content);
                                        }}
                                        className="p-1 text-slate-600 hover:text-cyan-400"
                                        title={t('community.edit')}
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="p-1 text-slate-600 hover:text-red-400"
                                        title={t('community.delete')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                        {editingComment === comment.id ? (
                            <div className="mt-2 space-y-2">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setEditingComment(null)}
                                        className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                                    >
                                        {t('community.cancel')}
                                    </button>
                                    <button
                                        onClick={() => handleUpdateComment(comment.id)}
                                        className="px-3 py-1 bg-cyan-600 text-[10px] font-bold text-white rounded-md hover:bg-cyan-500 transition-colors"
                                    >
                                        {t('community.submit')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 font-light leading-snug">
                                {comment.content}
                            </p>
                        )}
                    </div>
                </div>
            ))}

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeleteComment}
            />
        </div>
    );
};

export default CommentList;
