import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Player from './pages/Player';

function App() {
  return (
    <Router>
      <div className="w-full h-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:gameId" element={<Player />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;