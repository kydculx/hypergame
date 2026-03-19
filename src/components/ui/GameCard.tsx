import React from 'react';
import { useTranslation } from 'react-i18next';

interface GameCardProps {
    title: string;
    thumbnail: string;
    size?: 'small' | 'medium' | 'large' | 'wide';
    category?: string;
    playCount?: number;
    className?: string;
    onClick?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
    title,
    thumbnail,
    size = 'medium',
    category,
    playCount,
    className = '',
    onClick
}) => {
    const { t } = useTranslation();
    // Determine spans based on size
    const sizeClasses = {
        small: 'col-span-1 row-span-1',
        medium: 'col-span-1 row-span-1', // Standard square
        large: 'col-span-2 row-span-2', // Large featured
        wide: 'col-span-2 row-span-1', // Wide rectangle
    };

    return (
        <div
            onClick={onClick}
            className={`
        group relative rounded-2xl overflow-hidden bg-[#1A1B2E] cursor-pointer
        shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-cyan-400/60
        transition-all duration-300 ease-out
        hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(14,165,233,0.5)] hover:border-cyan-300/80
        active:translate-y-[2px] active:shadow-none
        ${sizeClasses[size]}
        ${className}
      `}
        >
            {/* Background Image / Placeholder */}
            <div className="w-full h-full overflow-hidden transition-transform duration-500 ease-out group-hover:scale-105 group-hover:brightness-110">
                {(thumbnail.includes('/') || thumbnail.includes('.')) ? (
                    <img
                        src={thumbnail}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className={`w-full h-full ${thumbnail} bg-cover bg-center`} />
                )}
            </div>

            {/* Always visible bottom label with glassmorphism */}
            <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none flex flex-col justify-end">
                <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-4 px-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <h3 className="text-white font-bold text-base tracking-tight truncate drop-shadow-md">{title}</h3>
                    <div className="flex items-center justify-between mt-0.5">
                        {category && <p className="text-cyan-400 font-medium text-[10px] uppercase tracking-wider">{category}</p>}
                        {playCount !== undefined && (
                            <p className="text-slate-400 text-[10px] font-medium">
                                {playCount.toLocaleString()} {t('plays')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Play Button overlay (appears on hover for desktop, subtle hint for mobile) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 border border-white/20 shadow-lg">
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
            </div>
        </div>
    );
};
