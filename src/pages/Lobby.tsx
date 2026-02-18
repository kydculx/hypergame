import React from 'react';
import { useGameStore, type Game } from '../hooks/useGameStore';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import Leaderboard from '../components/Leaderboard';
import UserProfile from '../components/UserProfile';

const Lobby: React.FC = () => {
  const games = useGameStore((state) => state.games);
  const userProfile = useGameStore((state) => state.userProfile);
  const setCurrentGame = useGameStore((state) => state.setCurrentGame);
  const navigate = useNavigate();

  const handlePlay = (game: Game) => {
    setCurrentGame(game);
    navigate(`/play/${game.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8 w-full font-sans">
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, transparent 50%), linear-gradient(0deg, transparent 95%, #312e81 100%), linear-gradient(90deg, transparent 95%, #312e81 100%)', backgroundSize: '100% 100%, 40px 40px, 40px 40px' }} />

      <div className="max-w-7xl mx-auto relative z-20 flex justify-end mb-4">
        <UserProfile />
      </div>

      <header className="mb-16 text-center relative z-10">
        <h1 className="text-6xl font-black mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm">
          HYPER GAME
        </h1>
        <p className="text-gray-200 text-xl font-medium mb-2">
          Welcome back, <span className="text-indigo-400">{userProfile.nickname}</span>!
        </p>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light leading-relaxed">
          Dive into a collection of high-performance, instant-play games directly in your browser.
        </p>
      </header>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Games List */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-1 bg-indigo-500 rounded-full" />
              <h2 className="text-3xl font-black uppercase tracking-tight">Available Games</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 perspective-1000">
              {games.map((game) => (
                <div 
                  key={game.id} 
                  className="bg-gray-800 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all duration-500 cursor-pointer group relative"
                  onClick={() => handlePlay(game)}
                  onMouseMove={(e) => {
                    const card = e.currentTarget;
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const rotateX = (y - centerY) / 10;
                    const rotateY = (centerX - x) / 10;
                    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
                  }}
                  style={{ 
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.1s ease-out, box-shadow 0.3s ease'
                  }}
                >
                  <div className="relative overflow-hidden aspect-video" style={{ transform: 'translateZ(20px)' }}>
                    <img 
                      src={game.thumbnailUrl} 
                      alt={game.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-90 group-hover:brightness-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />
                  </div>
                  
                  <div className="p-8 relative" style={{ transform: 'translateZ(40px)' }}>
                    <div className="absolute top-0 right-8 transform -translate-y-1/2">
                      <span className="px-4 py-1.5 bg-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-indigo-500/40">
                        {game.category}
                      </span>
                    </div>
                    <h3 className="text-3xl font-black mb-3 tracking-tight group-hover:text-indigo-300 transition-colors">{game.title}</h3>
                    <p className="text-gray-400 text-sm mb-8 line-clamp-2 font-medium leading-relaxed">{game.description}</p>
                    
                    <button className="flex items-center gap-3 bg-white text-gray-900 hover:bg-indigo-400 hover:text-white px-6 py-4 rounded-xl transition-all w-full justify-center font-black uppercase tracking-widest text-xs shadow-xl group-hover:shadow-indigo-500/20">
                      <Play size={16} fill="currentColor" />
                      START
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Leaderboard */}
          <div className="lg:col-span-4">
            <Leaderboard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
