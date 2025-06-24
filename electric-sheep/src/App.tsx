import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FractalViewer from './components/FractalViewer';
import About from './components/About';
import FullScreenViewer from './components/FullScreenViewer';
import Gallery from './components/Gallery';
import Navigation from './components/Navigation';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-background">
        <Navigation />
        <Routes>
          <Route path="/" element={<FractalViewer />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/fullscreen" element={<FullScreenViewer />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
