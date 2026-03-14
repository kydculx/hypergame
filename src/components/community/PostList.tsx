import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import CommentSection from './CommentSection';
import { Edit2, Trash2 } from 'lucide-react';
import { useUserStore } from '../../hooks/useUserStore';
import PostForm from './PostForm';
import { DeleteConfirmModal } from '../layout/DeleteConfirmModal';

interface Post {
    id: string;
    created_at: string;
    title: string;
    content: string;
    author_name: string;
    author_id: string | null;
}

const ITEMS_PER_PAGE = 10;

const PostList: React.FC = () => {
    const { t } = useTranslation();
    const user = useUserStore((state) => state.user);
    const isAdmin = useUserStore((state) => state.isAdmin);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const isLoadingRef = useRef(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [postToDelete, setPostToDelete] = useState<string | null>(null);
    
    // For infinite scroll
    const observer = useRef<IntersectionObserver | null>(null);
    const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoadingRef.current) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isLoadingRef.current) {
                setPage(prevPage => prevPage + 1);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [hasMore]);

    const fetchPosts = useCallback(async (isReset = false) => {
        if (isLoadingRef.current) return;
        
        isLoadingRef.current = true;
        setIsLoading(true);
        try {
            const currentPage = isReset ? 0 : page;
            const from = currentPage * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            
            if (data) {
                if (isReset) {
                    setPosts(data);
                } else {
                    setPosts(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const newPosts = data.filter(p => !existingIds.has(p.id));
                        return [...prev, ...newPosts];
                    });
                }
                
                if (data.length < ITEMS_PER_PAGE) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error fetching posts:', error);
            setError(t('community.error_load'));
        } finally {
            isLoadingRef.current = false;
            setIsLoading(false);
            setIsInitialLoading(false);
        }
    }, [page, t]);

    useEffect(() => {
        fetchPosts();
    }, [page]); // Only fetch when page changes

    const handleDeletePost = async (postId: string) => {
        setPostToDelete(postId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeletePost = async () => {
        if (!postToDelete) return;

        try {
            // Log for debugging
            console.log('Attempting to delete post and its comments:', postToDelete);
            
            // First, attempt to delete all comments for this post to satisfy foreign key constraints
            // (In case ON DELETE CASCADE is not configured in the database)
            const { error: commentError } = await supabase
                .from('comments')
                .delete()
                .eq('post_id', postToDelete);

            if (commentError) {
                console.warn('Comment deletion error (might be okay if no comments exist):', commentError);
            }

            // Then delete the post
            const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', postToDelete);

            if (error) {
                console.error('Database error deleting post:', error);
                throw error;
            }

            // Successfully deleted from DB, now update local state
            setPosts(prev => prev.filter(p => p.id !== postToDelete));
            
            // Close modal is handled by the component itself usually, 
            // but let's ensure it's clean if we need a specific order.
        } catch (err: any) {
            console.error('Error during post deletion flow:', err);
            
            let errorMessage = t('community.delete_failed') || '삭제에 실패했습니다.';
            if (err.code === '42501') {
                errorMessage = `권한이 없습니다 (RLS 정책 오류). 현재 사용자 ID: ${user?.id}, 관리자 여부: ${isAdmin}`;
            } else if (err.message) {
                errorMessage = `삭제 오류: ${err.message} (${err.code || 'unknown'})`;
            }
            
            alert(errorMessage);
        } finally {
            setPostToDelete(null);
            setIsDeleteModalOpen(false); // Explicitly close to be safe
        }
    };

    const handleEditSuccess = () => {
        setEditingPost(null);
        // Reset to first page
        setPage(0);
        // If we are already on page 0, useEffect won't trigger, so call manually
        if (page === 0) {
            fetchPosts(true);
        } else {
            setPosts([]); // Clear to show loading state properly
        }
    };

    if (isInitialLoading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                <span className="ml-3 text-slate-400">{t('community.loading')}</span>
            </div>
        );
    }

    if (error && posts.length === 0) {
        return (
            <div className="text-center py-20 text-red-400">
                {error}
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-32 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <div className="text-5xl mb-4 opacity-20 text-white">Empty</div>
                <p className="text-slate-400">{t('community.no_posts')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {posts.map((post, index) => {
                const isLastElement = posts.length === index + 1;
                return (
                    <div 
                        key={post.id} 
                        ref={isLastElement ? lastPostElementRef : null}
                        className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all group animate-in fade-in slide-in-from-bottom-4 duration-500"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                                {post.title}
                            </h3>
                            <div className="flex items-center gap-4">
                                {(isAdmin || user?.id === post.author_id) && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditingPost(post)}
                                            className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                                            title={t('community.edit')}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePost(post.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                            title={t('community.delete')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                                <span className="text-xs text-slate-500 font-mono">
                                    {new Date(post.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                        <p className="text-slate-300 whitespace-pre-wrap leading-relaxed mb-4">
                            {post.content}
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-[10px] text-white font-bold shadow-lg shadow-cyan-500/20">
                                {post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="text-sm text-slate-400">
                                {post.author_name}
                            </span>
                        </div>

                        {/* Comments Section Integration */}
                        <CommentSection postId={post.id} />
                    </div>
                );
            })}
            
            {isLoading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
                </div>
            )}

            {!isLoading && hasMore && (
                <div className="flex justify-center pt-4">
                    <button 
                        onClick={() => setPage(prev => prev + 1)}
                        className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-slate-400 hover:text-white transition-all"
                    >
                        {t('community.load_more') || '더 보기'}
                    </button>
                </div>
            )}

            {editingPost && (
                <PostForm
                    onClose={() => setEditingPost(null)}
                    onSuccess={handleEditSuccess}
                    editingPost={editingPost}
                />
            )}

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeletePost}
            />
        </div>
    );
};

export default PostList;
