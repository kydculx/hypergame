import React from 'react';

export const PortalBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 min-h-screen w-full -z-10 overflow-hidden bg-[#0A0B1A]">
            {/* Base dark radial background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#2b1055_0%,#050510_100%)]"></div>

            {/* Faint Grid Overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 1) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            ></div>

            {/* Glowing animated blobs */}
            {/* Blob 1: Cyan/Blue top left */}
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-cyan-600/20 blur-[120px] mix-blend-screen animate-blob"></div>

            {/* Blob 2: Magenta/Purple top right */}
            <div className="absolute top-[10%] -right-[10%] w-[40%] h-[60%] rounded-full bg-fuchsia-600/20 blur-[100px] mix-blend-screen animate-blob animation-delay-2000"></div>

            {/* Blob 3: Blue/Indigo bottom center */}
            <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen animate-blob animation-delay-4000"></div>

            {/* Subtle moving particles / stars could go here, but blobs + grid is a clean modern portal look */}

            {/* Global style overrides for animations */}
            <style>
                {`
                    @keyframes blob {
                        0% { transform: translate(0px, 0px) scale(1); }
                        33% { transform: translate(30px, -50px) scale(1.1); }
                        66% { transform: translate(-20px, 20px) scale(0.9); }
                        100% { transform: translate(0px, 0px) scale(1); }
                    }
                    .animate-blob {
                        animation: blob 20s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .animation-delay-2000 {
                        animation-delay: 2s;
                    }
                    .animation-delay-4000 {
                        animation-delay: 4s;
                    }
                `}
            </style>
        </div>
    );
};
