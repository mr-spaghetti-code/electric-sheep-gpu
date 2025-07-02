import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FractalViewer from './components/FractalViewer';
import About from './components/About';
import FullScreenViewer from './components/FullScreenViewer';
import Gallery from './components/Gallery';
import Lab from './components/Lab';
import Navigation from './components/Navigation';
import MobileWarning from './components/MobileWarning';
import { useMobileDetection } from './hooks/useMobileDetection';
import './App.css';

function App() {
  const { isMobile } = useMobileDetection();

  // Show mobile warning for mobile devices
  if (isMobile) {
    return <MobileWarning />;
  }

  // Show normal app for desktop/tablet users
  return (
    <Router>
      <div className="App min-h-screen bg-background">
        <Navigation />
        <Routes>
          <Route path="/" element={<FullScreenViewer />} />
          <Route path="/:fractalId" element={<FullScreenViewer />} />
          <Route path="/create" element={<FractalViewer />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/gallery/:fractalId" element={<Gallery />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
