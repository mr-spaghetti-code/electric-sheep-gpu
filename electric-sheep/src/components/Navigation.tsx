import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Info, Maximize, Images, TestTubes } from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="w-full bg-background border-b border-border px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold">FractalMachine.xyz</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            asChild
            variant={location.pathname === '/' ? 'default' : 'ghost'}
            size="sm"
          >
            <Link to="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Home
            </Link>
          </Button>
          
          <Button
            asChild
            variant={location.pathname === '/fullscreen' ? 'default' : 'ghost'}
            size="sm"
          >
            <Link to="/fullscreen" className="flex items-center gap-2">
              <Maximize className="w-4 h-4" />
              Full Screen
            </Link>
          </Button>
          
          <Button
            asChild
            variant={location.pathname === '/gallery' ? 'default' : 'ghost'}
            size="sm"
          >
            <Link to="/gallery" className="flex items-center gap-2">
              <Images className="w-4 h-4" />
              Gallery
            </Link>
          </Button>
          
          <Button
            asChild
            variant={location.pathname === '/lab' ? 'default' : 'ghost'}
            size="sm"
          >
            <Link to="/lab" className="flex items-center gap-2">
              <TestTubes className="w-4 h-4" />
              Lab
            </Link>
          </Button>
          
          <Button
            asChild
            variant={location.pathname === '/about' ? 'default' : 'ghost'}
            size="sm"
          >
            <Link to="/about" className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              About
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 