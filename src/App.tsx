import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Player from './pages/Player';
import Community from './pages/Community';
import LeaderboardPage from './pages/LeaderboardPage';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/auth/AdminRoute';

function App() {
  return (
    <Router>
      <div className="w-full h-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:gameId" element={<Player />} />
          <Route path="/community" element={<Community />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route
            path="/admin-stats"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;