import React from 'react';

interface DataPoint {
    date: string;
    playCount: number;
}

interface GameStatsChartProps {
    data: DataPoint[];
    height?: number;
    color?: string;
}

export const GameStatsChart: React.FC<GameStatsChartProps> = ({ 
    data, 
    height = 200, 
    color = '#22d3ee' 
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm italic">
                데이터가 없습니다.
            </div>
        );
    }

    // Sort data by date just in case
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate max value for scaling
    const maxPlays = Math.max(...sortedData.map(d => d.playCount), 10); // Minimum scale of 10
    const padding = 40;
    const chartHeight = height - padding * 2;
    const chartWidth = 800; // Fixed internal coordinate system for SVG
    
    // Generate points for the polyline
    const points = sortedData.map((d, i) => {
        const x = (i / (sortedData.length - 1 || 1)) * chartWidth;
        const y = chartHeight - (d.playCount / maxPlays) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    // Generate area path
    const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

    return (
        <div className="w-full h-full flex flex-col">
            <div className="relative flex-1">
                <svg 
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                >
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                        <line
                            key={p}
                            x1="0"
                            y1={chartHeight * p}
                            x2={chartWidth}
                            y2={chartHeight * p}
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="1"
                        />
                    ))}

                    {/* Background Area */}
                    <path
                        d={`M ${areaPoints}`}
                        fill={`url(#gradient-${color.replace('#', '')})`}
                        className="opacity-20"
                    />

                    {/* Main Line */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                    />

                    {/* Data Points */}
                    {sortedData.map((d, i) => {
                        const x = (i / (sortedData.length - 1 || 1)) * chartWidth;
                        const y = chartHeight - (d.playCount / maxPlays) * chartHeight;
                        return (
                            <circle
                                key={i}
                                cx={x}
                                cy={y}
                                r="4"
                                fill={color}
                                className="hover:r-6 cursor-pointer transition-all"
                            >
                                <title>{`${d.date}: ${d.playCount}`}</title>
                            </circle>
                        );
                    })}

                    {/* Gradients */}
                    <defs>
                        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={color} />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            
            {/* X-Axis Labels */}
            <div className="flex justify-between mt-4 text-[9px] text-slate-500 font-bold uppercase tracking-wider px-1">
                <span>{sortedData[0].date}</span>
                <span className="hidden sm:inline">{sortedData[Math.floor(sortedData.length / 2)].date}</span>
                <span>{sortedData[sortedData.length - 1].date}</span>
            </div>
        </div>
    );
};
