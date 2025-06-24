import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Pause,
  RotateCcw,
  Shuffle,
  Download,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImageIcon,
  Calendar,
  Palette
} from 'lucide-react';
import { useFractalGallery } from '@/hooks/useFractalGallery';
import type { Database } from '@/lib/supabase';
// Gallery component for displaying saved fractals

type FractalRow = Database['public']['Tables']['fractals']['Row'];

// Interface for the fractal instance with add/remove methods
interface GalleryFractalInstance {
  length: number;
  [key: number]: {
    variation: string;
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    animateX: boolean;
    animateY: boolean;
  };
  add: (params: {
    variation: string;
    color: number;
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    animateX: boolean;
    animateY: boolean;
  }) => void;
  remove: (index: number) => void;
}

interface GalleryProps {
  width?: number;
  height?: number;
}

const Gallery: React.FC<GalleryProps> = ({ 
  width = 800, 
  height = 800
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFractal, setSelectedFractal] = useState<FractalRow | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isLoadingFractal, setIsLoadingFractal] = useState(false);
  
  const FRACTALS_PER_PAGE = 10;
  const { 
    fractals, 
    totalCount, 
    isLoading: isLoadingFractals, 
    error: galleryError,
    incrementViewCount 
  } = useFractalGallery(currentPage, FRACTALS_PER_PAGE);
  
  // Combine errors
  const displayError = error || galleryError;
  const totalPages = Math.ceil(totalCount / FRACTALS_PER_PAGE);

  // Load fractal engine
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    const loadFractalEngine = async () => {
      try {
        // Load the main.js script if not already loaded
        if (!window.fractalModuleLoaded) {
          script = document.createElement('script');
          script.type = 'module';
          script.innerHTML = `
            import cmaps from '/colourmaps.js';
            import FractalFunctions from '/fractal_functions.js';
            
            window.cmaps = cmaps;
            window.FractalFunctions = FractalFunctions;
            
            import('/main.js').then(module => {
              window.fractalModuleLoaded = true;
            });
          `;
          document.body.appendChild(script);

          // Wait for the module to load
          await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              if (window.fractalModuleLoaded) {
                clearInterval(checkInterval);
                resolve(true);
              }
            }, 100);
          });
        }

        // Initialize the fractal viewer
        if (canvasRef.current) {
          const initFunction = window.init;
          if (initFunction) {
            const flam3 = await initFunction(canvasRef.current, true);
            window.flam3 = flam3;
            
            // Set default colormap
            flam3.cmap = 'gnuplot';
            
            setIsLoading(false);
          } else {
            throw new Error('Fractal initialization function not found');
          }
        }
      } catch (err) {
        console.error('Error loading fractal engine:', err);
        setError(err instanceof Error ? err.message : 'Failed to load fractal engine');
        setIsLoading(false);
      }
    };

    loadFractalEngine();

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (window.flam3) {
        window.flam3.stop();
      }
    };
  }, []);

  // Select the first fractal when fractals are loaded
  useEffect(() => {
    if (!selectedFractal && fractals.length > 0) {
      setSelectedFractal(fractals[0]);
    }
  }, [fractals, selectedFractal]);

  // Load a fractal into the viewer
  const loadFractal = async (fractal: FractalRow) => {
    if (!window.flam3) return;
    
    setIsLoadingFractal(true);
    setSelectedFractal(fractal);
    
    try {
      // Stop current rendering
      window.flam3.stop();
      
      console.log('Loading fractal:', fractal.title);
      console.log('Saved fractal config:', fractal.config);
      console.log('Saved fractal transforms:', fractal.transforms);
      console.log('Saved fractal colormap:', fractal.colormap);
      
      // Clear existing fractal and rebuild from saved data
      const fractalInstance = window.flam3.fractal as unknown as GalleryFractalInstance;
      
      // Clear existing transforms
      while (fractalInstance.length > 0) {
        fractalInstance.remove(0);
      }
      
      console.log('Cleared existing transforms, fractal length:', fractalInstance.length);
      
      // Load transforms from saved data - exactly like FractalViewer does it
      fractal.transforms.forEach((transform, index) => {
        console.log(`Adding transform ${index}:`, transform);
        const addParams = {
          variation: transform.variation,
          color: index / fractal.transforms.length, // Distribute colors evenly
          a: transform.a,
          b: transform.b,
          c: transform.c,
          d: transform.d,
          e: transform.e,
          f: transform.f,
          animateX: transform.animateX,
          animateY: transform.animateY
        };
        console.log(`Transform ${index} add params:`, addParams);
        fractalInstance.add(addParams);
      });
      
      console.log('Added transforms, new fractal length:', fractalInstance.length);
      
      // Verify transforms were loaded correctly
      console.log('Verifying loaded transforms:');
      for (let i = 0; i < fractalInstance.length; i++) {
        const loadedTransform = (window.flam3.fractal as unknown as GalleryFractalInstance)[i];
        console.log(`Loaded transform ${i}:`, {
          variation: loadedTransform.variation,
          a: loadedTransform.a,
          b: loadedTransform.b,
          c: loadedTransform.c,
          d: loadedTransform.d,
          e: loadedTransform.e,
          f: loadedTransform.f,
          animateX: loadedTransform.animateX,
          animateY: loadedTransform.animateY
        });
      }
      
      // Update configuration properties individually to avoid buffer issues
      const config = window.flam3.config;
      console.log('Current config before update:', { ...config });
      
      if (fractal.config.zoom !== undefined) config.zoom = fractal.config.zoom;
      if (fractal.config.rotation !== undefined) config.rotation = fractal.config.rotation;
      if (fractal.config.mirrorX !== undefined) config.mirrorX = fractal.config.mirrorX;
      if (fractal.config.mirrorY !== undefined) config.mirrorY = fractal.config.mirrorY;
      if (fractal.config.gamma !== undefined) config.gamma = fractal.config.gamma;
      if (fractal.config.hueShift !== undefined) config.hueShift = fractal.config.hueShift;
      if (fractal.config.satShift !== undefined) config.satShift = fractal.config.satShift;
      if (fractal.config.lightShift !== undefined) config.lightShift = fractal.config.lightShift;
      if (fractal.config.final !== undefined) config.final = fractal.config.final;
      if (fractal.config.cfinal !== undefined) config.cfinal = fractal.config.cfinal;
      if (fractal.config.animationSpeed !== undefined) config.animationSpeed = fractal.config.animationSpeed;
      if (fractal.config.numPoints !== undefined) config.numPoints = fractal.config.numPoints;
      if (fractal.config.x !== undefined) config.x = fractal.config.x;
      if (fractal.config.y !== undefined) config.y = fractal.config.y;
      
      console.log('Updated config:', { ...config });
      
      // Set the colormap
      console.log('Setting colormap to:', fractal.colormap);
      window.flam3.cmap = fractal.colormap;
      console.log('Colormap set, current cmap:', window.flam3.cmap);
      
      // Clear and restart
      console.log('Clearing canvas and updating params...');
      window.flam3.clear();
      window.flam3.updateParams();
      
      console.log('Final fractal state - length:', fractalInstance.length);
      console.log('Final config state:', { ...config });
      
      if (isRunning) {
        console.log('Starting fractal rendering...');
        window.flam3.start();
      } else {
        console.log('Fractal loaded but not starting (isRunning is false)');
      }
      
      // Increment view count
      incrementViewCount(fractal.id, fractal.view_count);
        
    } catch (err) {
      console.error('Error loading fractal:', err);
      setError(err instanceof Error ? err.message : 'Failed to load fractal');
    } finally {
      setIsLoadingFractal(false);
    }
  };

  const handleStart = () => {
    if (window.flam3) {
      window.flam3.start();
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    if (window.flam3) {
      window.flam3.stop();
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    if (window.flam3) {
      window.flam3.clear();
    }
  };

  const handleRandomize = () => {
    if (window.flam3 && window.flam3.randomize) {
      window.flam3.randomize();
    }
  };

  const handleExportPNG = () => {
    if (window.flam3 && window.flam3.exportPNG) {
      window.flam3.exportPNG();
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (displayError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{displayError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Fractal Gallery</h1>
        <p className="text-muted-foreground">
          Explore a collection of beautiful fractal flames. Click any thumbnail to view and interact with the fractal.
        </p>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Fractal Viewer */}
        <div className="lg:col-span-3">
          <Card className="fractal-canvas-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    {selectedFractal ? selectedFractal.title : 'Select a Fractal'}
                  </CardTitle>
                  {selectedFractal && (
                    <CardDescription>
                      {selectedFractal.description || 'No description available'}
                    </CardDescription>
                  )}
                </div>
                
                {selectedFractal && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Eye className="w-3 h-3" />
                      {selectedFractal.view_count}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Palette className="w-3 h-3" />
                      {selectedFractal.colormap}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {isLoading && (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                    <p className="text-lg">Loading WebGPU Fractal Engine...</p>
                  </div>
                </div>
              )}
              
              {isLoadingFractal && !isLoading && (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p>Loading fractal...</p>
                  </div>
                </div>
              )}
              
              <canvas 
                ref={canvasRef} 
                width={width} 
                height={height}
                className="fractal-canvas w-full"
                style={{ 
                  display: (isLoading || isLoadingFractal) ? 'none' : 'block',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />
              
              {!isLoading && (
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={isRunning ? handleStop : handleStart}
                    variant="outline"
                    size="sm"
                  >
                    {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isRunning ? 'Pause' : 'Play'}
                  </Button>
                  <Button onClick={handleClear} variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  <Button onClick={handleRandomize} variant="outline" size="sm">
                    <Shuffle className="w-4 h-4 mr-2" />
                    Randomize
                  </Button>
                  <Button onClick={handleExportPNG} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export PNG
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with fractal info */}
        <div className="lg:col-span-1">
          {selectedFractal && !isLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fractal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">CREATED</h4>
                  <p className="flex items-center gap-1 text-sm">
                    <Calendar className="w-3 h-3" />
                    {formatDate(selectedFractal.created_at)}
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">DIMENSIONS</h4>
                  <p className="text-sm">{selectedFractal.width} × {selectedFractal.height}</p>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">TRANSFORMS</h4>
                  <p className="text-sm">{selectedFractal.transforms.length} XForms</p>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">PARAMETERS</h4>
                  <div className="text-xs space-y-1">
                    <div>Zoom: {selectedFractal.config.zoom?.toFixed(2) || 'N/A'}</div>
                    <div>Gamma: {selectedFractal.config.gamma?.toFixed(2) || 'N/A'}</div>
                    <div>Rotation: {selectedFractal.config.rotation || 'N/A'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Thumbnail Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Gallery ({totalCount} fractals)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePreviousPage}
                disabled={currentPage === 0 || isLoadingFractals}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1 || isLoadingFractals}
                variant="outline"
                size="sm"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoadingFractals ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array.from({ length: FRACTALS_PER_PAGE }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {fractals.map((fractal) => (
                <button
                  key={fractal.id}
                  onClick={() => loadFractal(fractal)}
                  className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-primary ${
                    selectedFractal?.id === fractal.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                  }`}
                >
                  {fractal.thumbnail_url ? (
                    <img
                      src={fractal.thumbnail_url}
                      alt={fractal.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                    <div className="p-2 text-white text-left">
                      <h3 className="font-semibold text-sm truncate">{fractal.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {fractal.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Palette className="w-3 h-3" />
                          {fractal.colormap}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Gallery; 