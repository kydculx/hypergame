import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import CommentList from './CommentList';
import CommentForm from './CommentForm';

interface CommentSectionProps {
    postId: string;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleCommentAdded = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className="mt-6 pt-4 border-t border-white/5">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition-colors text-sm font-medium mb-4"
            >
                <MessageSquare size={16} />
                <span>{t('community.comments')}</span>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <CommentList postId={postId} refreshTrigger={refreshTrigger} />
                    <CommentForm postId={postId} onSuccess={handleCommentAdded} />
                </div>
            )}
        </div>
    );
};

export default CommentSection;
