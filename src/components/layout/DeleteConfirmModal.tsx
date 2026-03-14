import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message 
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={onClose}
            />

            {/* Modal Content */}
            <div 
                className="relative w-full max-w-sm bg-[#0f1123]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    {/* Warning Icon */}
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                        <AlertCircle className="text-red-500" size={32} />
                    </div>

                    <h3 className="text-xl font-black text-white mb-2">
                        {title || t('community.confirm_delete')}
                    </h3>
                    
                    <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                        {message || t('community.confirm_delete_desc') || '정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'}
                    </p>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/5 transition-all active:scale-95"
                        >
                            {t('community.cancel')}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            {t('community.delete')}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>,
        document.body
    );
};
