import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Player from './pages/Player';

function App() {
  return (
    <Router>
      <div className="w-full min-h-screen">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/play/:gameId" element={<Player />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;