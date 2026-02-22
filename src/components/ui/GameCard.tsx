import React from 'react';

interface GameCardProps {
    title: string;
    thumbnail: string;
    size?: 'small' | 'medium' | 'large' | 'wide';
    category?: string;
    className?: string;
    onClick?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
    title,
    thumbnail,
    size = 'medium',
    category,
    className = '',
    onClick
}) => {
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
        group relative rounded-2xl overflow-hidden bg-white cursor-pointer
        shadow-[0_5px_0_rgba(0,0,0,0.2)] transition-all duration-150
        hover:-translate-y-1 hover:shadow-[0_9px_0_rgba(0,0,0,0.2)]
        active:translate-y-[5px] active:shadow-none
        ${sizeClasses[size]}
        ${className}
      `}
        >
            {/* Background Image / Placeholder */}
            <div className="w-full h-full overflow-hidden transition-transform duration-500 group-hover:scale-110 group-hover:brightness-110">
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

            {/* Overlay / Title visible on hover or always for some styles */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <h3 className="text-white font-bold text-sm truncate">{title}</h3>
                {category && <p className="text-white/80 text-xs">{category}</p>}
            </div>

            {/* White rounded badge for category if needed, or just play icon */}
            <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200">
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5"></div>
            </div>
        </div>
    );
};
