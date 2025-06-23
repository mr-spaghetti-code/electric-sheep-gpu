import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Hands, type Results, type NormalizedLandmark } from '@mediapipe/hands';
import {
  Play,
  Pause,
  Shuffle,
  Sparkles,
  Zap,
  X,
  Settings,
  Minimize,
  Hand
} from 'lucide-react';

interface FractalConfig {
  animationSpeed: number;
  zoom: number;
  rotation: number;
  mirrorX: boolean;
  mirrorY: boolean;
  gamma: number;
  hueShift: number;
  satShift: number;
  lightShift: number;
  final: number;
  cfinal: number;
  numPoints: number;
}

interface ExtendedFractalTransform {
  variation: string;
  animateX: boolean;
  animateY: boolean;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface FractalTransform {
  variation: string;
  animateX: boolean;
  animateY: boolean;
}

interface HandControlState {
  enabled: boolean;
  leftXform: number | null;
  rightXform: number | null;
  leftHandCenter: { x: number; y: number } | null;
  rightHandCenter: { x: number; y: number } | null;
  leftHandRotation: number;
  rightHandRotation: number;
  originalTransforms: Map<number, ExtendedFractalTransform>;
}

interface FractalInstance {
  config: FractalConfig;
  fractal: { 
    length: number; 
    [key: number]: FractalTransform;
  };
  randomize: () => void;
  toggleAnimations: (enabled?: boolean) => boolean;
  hasActiveAnimations: () => boolean;
  gui: boolean;
  cmap: string;
  start: () => void;
  stop: () => void;
  clear: () => void;
  updateParams: () => void;
}

declare global {
  interface Window {
    flam3: FractalInstance;
    config: FractalConfig;
    cmaps: Record<string, unknown>;
    FractalFunctions: unknown;
    init: (canvas: HTMLCanvasElement, startRunning?: boolean) => Promise<FractalInstance>;
    populateVariationOptions: () => void;
    fractalModuleLoaded: boolean;
  }
}

const FullScreenViewer: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [selectedCmap, setSelectedCmap] = useState('gnuplot');
  const [isRunning, setIsRunning] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  const [cmapOptions, setCmapOptions] = useState<string[]>([]);
  const [autoRandomize, setAutoRandomize] = useState(false);
  const [guiEnabled, setGuiEnabled] = useState(false);
  const [handControl, setHandControl] = useState<HandControlState>({
    enabled: false,
    leftXform: null,
    rightXform: null,
    leftHandCenter: null,
    rightHandCenter: null,
    leftHandRotation: 0,
    rightHandRotation: 0,
    originalTransforms: new Map()
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<Hands | null>(null);

  // Get viewport dimensions and calculate square canvas size
  const [canvasSize, setCanvasSize] = useState(() => {
    const size = Math.min(window.innerWidth, window.innerHeight);
    return size;
  });

  // Update canvas size on resize
  useEffect(() => {
    const handleResize = () => {
      const size = Math.min(window.innerWidth, window.innerHeight);
      setCanvasSize(size);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        setShowControls(prev => !prev);
      } else if (event.key === 'Escape') {
        navigate('/');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Load fractal engine
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    const loadFractalEngine = async () => {
      try {
        // Load the main.js script
        script = document.createElement('script');
        script.type = 'module';
        script.innerHTML = `
          import cmaps from '/colourmaps.js';
          import FractalFunctions from '/fractal_functions.js';
          
          // Make them globally available
          window.cmaps = cmaps;
          window.FractalFunctions = FractalFunctions;
          
          // Load and initialize the fractal engine
          import('/main.js').then(module => {
            window.fractalModuleLoaded = true;
            if (module.populateVariationOptions) {
              module.populateVariationOptions();
            }
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

        // Initialize the fractal viewer
        if (canvasRef.current) {
          const initFunction = window.init;
          if (initFunction) {
            const flam3 = await initFunction(canvasRef.current, true);
            window.flam3 = flam3;
            
            // Set colormap options
            if (window.cmaps) {
              setCmapOptions(Object.keys(window.cmaps));
            }
            
            // Initialize with a random fractal
            if (flam3.randomize) {
              flam3.randomize();
            }
            
            // Set animation speed to 10% by default
            if (flam3.config) {
              flam3.config.animationSpeed = 0.1;
              flam3.updateParams();
            }
            
            // Enable GUI overlay by default in full screen mode
            flam3.gui = guiEnabled;
            
            // Enable animations by default in full screen mode
            if (flam3.toggleAnimations) {
              flam3.toggleAnimations(true);
              setAnimationsEnabled(true);
            }
            
            // Initialize animation state
            if (flam3.hasActiveAnimations) {
              setAnimationsEnabled(flam3.hasActiveAnimations());
            }
            
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
      // Cleanup
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (window.flam3) {
        window.flam3.stop();
      }
    };
  }, []);

  // Initialize hand tracking
  useEffect(() => {
    const initializeHandTracking = async () => {
      if (!handControl.enabled) return;

      try {
        // Get camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'user'
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Initialize MediaPipe Hands
        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onHandResults);
        handsRef.current = hands;

        // Start manual camera processing using requestAnimationFrame
        const processFrame = async () => {
          if (videoRef.current && handsRef.current && handControl.enabled) {
            try {
              await handsRef.current.send({ image: videoRef.current });
            } catch (error) {
              console.error('Error processing frame:', error);
            }
            requestAnimationFrame(processFrame);
          }
        };

        // Start the frame processing loop once video is ready
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            requestAnimationFrame(processFrame);
          };
        }
      } catch (error) {
        console.error('Error initializing hand tracking:', error);
      }
    };

    if (handControl.enabled) {
      initializeHandTracking();
    }

    return () => {
      // Cleanup camera stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [handControl.enabled]);

  // Hand tracking results handler
  const onHandResults = (results: Results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }

    const handedness = results.multiHandedness;
    let leftHand: NormalizedLandmark[] | null = null;
    let rightHand: NormalizedLandmark[] | null = null;

    // Identify left and right hands
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const handLabel = handedness?.[i]?.label;
      if (handLabel === 'Left') {
        leftHand = results.multiHandLandmarks[i];
      } else if (handLabel === 'Right') {
        rightHand = results.multiHandLandmarks[i];
      }
    }

    updateXformsFromHands(leftHand, rightHand);
  };

  // Update xforms based on hand positions
  const updateXformsFromHands = (leftHand: NormalizedLandmark[] | null, rightHand: NormalizedLandmark[] | null) => {
    if (!window.flam3?.fractal || !handControl.enabled) return;

    // Calculate hand centers and rotations
    const leftCenter = leftHand ? getHandCenter(leftHand) : null;
    const rightCenter = rightHand ? getHandCenter(rightHand) : null;
    const leftRotation = leftHand ? getHandRotation(leftHand) : 0;
    const rightRotation = rightHand ? getHandRotation(rightHand) : 0;

    // Update left hand controlled xform
    if (handControl.leftXform !== null && leftCenter && window.flam3.fractal[handControl.leftXform]) {
      const xform = window.flam3.fractal[handControl.leftXform] as any;
      const original = handControl.originalTransforms.get(handControl.leftXform);
      
      if (original) {
        // Map hand position to translation (c, f parameters) - flipped axes
        const translateX = (0.5 - leftCenter.x) * 2; // Flip X direction and convert from [0,1] to [-1,1]
        const translateY = (0.5 - leftCenter.y) * 2; // Flip Y direction and convert to [-1,1]
        
        // Apply rotation to the transform matrix
        const cos = Math.cos(leftRotation);
        const sin = Math.sin(leftRotation);
        
        xform.a = original.a * cos - original.b * sin;
        xform.b = original.a * sin + original.b * cos;
        xform.c = original.c + translateX * 0.5;
        xform.d = original.d * cos - original.e * sin;
        xform.e = original.d * sin + original.e * cos;
        xform.f = original.f + translateY * 0.5;
      }
    }

    // Update right hand controlled xform
    if (handControl.rightXform !== null && rightCenter && window.flam3.fractal[handControl.rightXform]) {
      const xform = window.flam3.fractal[handControl.rightXform] as any;
      const original = handControl.originalTransforms.get(handControl.rightXform);
      
      if (original) {
        // Map hand position to translation (c, f parameters) - flipped axes
        const translateX = (0.5 - rightCenter.x) * 2; // Flip X direction and convert from [0,1] to [-1,1]
        const translateY = (0.5 - rightCenter.y) * 2; // Flip Y direction and convert to [-1,1]
        
        // Apply rotation to the transform matrix
        const cos = Math.cos(rightRotation);
        const sin = Math.sin(rightRotation);
        
        xform.a = original.a * cos - original.b * sin;
        xform.b = original.a * sin + original.b * cos;
        xform.c = original.c + translateX * 0.5;
        xform.d = original.d * cos - original.e * sin;
        xform.e = original.d * sin + original.e * cos;
        xform.f = original.f + translateY * 0.5;
      }
    }

    // Update hand control state
    setHandControl(prev => ({
      ...prev,
      leftHandCenter: leftCenter,
      rightHandCenter: rightCenter,
      leftHandRotation: leftRotation,
      rightHandRotation: rightRotation
    }));

    // Trigger fractal update
    if (window.flam3.updateParams) {
      window.flam3.updateParams();
    }
  };

  // Helper function to get hand center point
  const getHandCenter = (landmarks: NormalizedLandmark[]) => {
    // Use palm center (landmark 0) as the main control point
    return {
      x: landmarks[0].x,
      y: landmarks[0].y
    };
  };

  // Helper function to calculate hand rotation
  const getHandRotation = (landmarks: NormalizedLandmark[]) => {
    // Calculate rotation based on the vector from wrist to middle finger tip
    const wrist = landmarks[0];
    const middleTip = landmarks[12];
    
    const dx = middleTip.x - wrist.x;
    const dy = middleTip.y - wrist.y;
    
    return Math.atan2(dy, dx);
  };

  // Select random xforms for hand control
  const selectRandomXforms = () => {
    if (!window.flam3?.fractal || window.flam3.fractal.length < 2) return;

    // Get all available xform indices
    const indices = Array.from({ length: window.flam3.fractal.length }, (_, i) => i);
    
    // Shuffle and pick first two
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const leftXform = indices[0];
    const rightXform = indices[1];

    // Store original transform parameters
    const originalTransforms = new Map();
    
    [leftXform, rightXform].forEach(index => {
      const xform = window.flam3.fractal[index] as any;
      originalTransforms.set(index, {
        variation: xform.variation,
        animateX: xform.animateX,
        animateY: xform.animateY,
        a: xform.a,
        b: xform.b,
        c: xform.c,
        d: xform.d,
        e: xform.e,
        f: xform.f
      });
    });

    setHandControl(prev => ({
      ...prev,
      leftXform,
      rightXform,
      originalTransforms
    }));

    console.log(`Selected xforms for hand control: Left=${leftXform}, Right=${rightXform}`);
  };

  // Check animation state periodically and auto-randomize if enabled
  useEffect(() => {
    if (!isLoading && window.flam3 && window.flam3.hasActiveAnimations) {
      const interval = setInterval(() => {
        const hasAnimations = window.flam3.hasActiveAnimations();
        if (hasAnimations !== animationsEnabled) {
          setAnimationsEnabled(hasAnimations);
        }
        
        // Auto-randomize periodically when enabled
        if (autoRandomize && Math.random() < 0.05) { // 5% chance per check
          handleRandomize();
        }
      }, 1000); // Check every second

      return () => clearInterval(interval);
    }
  }, [isLoading, animationsEnabled, autoRandomize]);

  // Event handlers
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

  const handleRandomize = () => {
    if (window.flam3 && window.flam3.randomize) {
      window.flam3.randomize();
      
      // Set animation speed to 10% after randomizing
      if (window.flam3.config) {
        window.flam3.config.animationSpeed = 0.1;
        window.flam3.updateParams();
      }
      
      // Randomly animate one transform to make the scene dynamic
      if (window.flam3.fractal && window.flam3.fractal.length > 0) {
        // First, disable all animations
        for (let i = 0; i < window.flam3.fractal.length; i++) {
          const transform = window.flam3.fractal[i] as any;
          transform.animateX = false;
          transform.animateY = false;
        }
        
        // Pick a random transform to animate
        const randomTransformIndex = Math.floor(Math.random() * window.flam3.fractal.length);
        const randomTransform = window.flam3.fractal[randomTransformIndex] as any;
        
        // Randomly choose to animate X, Y, or both
        const animationType = Math.random();
        if (animationType < 0.4) {
          // 40% chance: animate X only
          randomTransform.animateX = true;
        } else if (animationType < 0.8) {
          // 40% chance: animate Y only
          randomTransform.animateY = true;
        } else {
          // 20% chance: animate both X and Y
          randomTransform.animateX = true;
          randomTransform.animateY = true;
        }
        
        console.log(`Animating transform ${randomTransformIndex + 1} (${randomTransform.variation}):`, 
                   `X=${randomTransform.animateX}, Y=${randomTransform.animateY}`);
        console.log('Transform after setting animation:', randomTransform);
        
        // Update the fractal buffer and clear to apply changes
        if (window.flam3.updateParams) {
          window.flam3.updateParams();
        }
        if (window.flam3.clear) {
          window.flam3.clear();
        }
      }
      
      if (window.flam3.hasActiveAnimations) {
        setAnimationsEnabled(window.flam3.hasActiveAnimations());
      }
    }
  };

  const handleToggleAutoRandomize = () => {
    setAutoRandomize(prev => !prev);
  };

  const handleToggleGui = () => {
    const newGuiState = !guiEnabled;
    setGuiEnabled(newGuiState);
    if (window.flam3) {
      window.flam3.gui = newGuiState;
    }
  };

  const handleToggleHandControl = () => {
    const newHandControlState = !handControl.enabled;
    
    if (newHandControlState) {
      // Enable hand control and select random xforms
      selectRandomXforms();
      setHandControl(prev => ({ ...prev, enabled: true }));
    } else {
      // Disable hand control and restore original xforms
      if (window.flam3?.fractal) {
        handControl.originalTransforms.forEach((original, index) => {
          if (window.flam3.fractal[index]) {
            const xform = window.flam3.fractal[index] as any;
            xform.a = original.a;
            xform.b = original.b;
            xform.c = original.c;
            xform.d = original.d;
            xform.e = original.e;
            xform.f = original.f;
          }
        });
        
        if (window.flam3.updateParams) {
          window.flam3.updateParams();
        }
      }
      
      setHandControl({
        enabled: false,
        leftXform: null,
        rightXform: null,
        leftHandCenter: null,
        rightHandCenter: null,
        leftHandRotation: 0,
        rightHandRotation: 0,
        originalTransforms: new Map()
      });
    }
  };

  const handleToggleAnimations = (enabled: boolean) => {
    if (window.flam3 && window.flam3.toggleAnimations) {
      const actualState = window.flam3.toggleAnimations(enabled);
      setAnimationsEnabled(actualState);
    }
  };

  const handleCmapChange = (value: string) => {
    setSelectedCmap(value);
    if (window.flam3) {
      window.flam3.cmap = value;
    }
  };

  const handleExitFullScreen = () => {
    navigate('/');
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={handleExitFullScreen} className="mt-4">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
          <div className="text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 animate-pulse" />
            <p className="text-lg">Loading WebGPU Fractal Engine...</p>
          </div>
        </div>
      )}
      
      {/* Full screen canvas - centered and maintaining aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          width={canvasSize} 
          height={canvasSize}
          className={`${isLoading ? 'hidden' : 'block'}`}
          style={{ 
            width: `${canvasSize}px`, 
            height: `${canvasSize}px`,
            maxWidth: '100vw',
            maxHeight: '100vh'
          }}
        />
      </div>

      {/* Debug video element for hand tracking */}
      {handControl.enabled && (
        <video 
          ref={videoRef} 
          className="fixed bottom-4 left-4 z-50 w-48 h-36 border-2 border-white/20 rounded-lg bg-black/50" 
          autoPlay 
          playsInline 
          muted
          width={640}
          height={480}
        />
      )}

      {/* Exit button - always visible */}
      {!isLoading && (
        <div className="absolute top-4 left-4 z-50">
          <Button 
            onClick={handleExitFullScreen}
            variant="outline"
            size="sm"
            className="bg-black/50 border-white/20 text-white hover:bg-black/70"
          >
            <Minimize className="w-4 h-4 mr-2" />
            Exit Full Screen
          </Button>
        </div>
      )}

      {/* Controls toggle button */}
      {!isLoading && (
        <div className="absolute top-4 right-4 z-50">
          <Button 
            onClick={() => setShowControls(!showControls)}
            variant="outline"
            size="sm"
            className="bg-black/50 border-white/20 text-white hover:bg-black/70"
          >
            <Settings className="w-4 h-4 mr-2" />
            {showControls ? 'Hide' : 'Show'} Controls
          </Button>
        </div>
      )}

      {/* Floating controls panel */}
      {!isLoading && showControls && (
        <div className="absolute top-16 right-4 z-40 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <Card className="bg-black/80 backdrop-blur-sm border-white/20 text-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Controls
                </CardTitle>
                <Button 
                  onClick={() => setShowControls(false)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Controls */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Toggle 
                    pressed={isRunning} 
                    onPressedChange={(pressed) => pressed ? handleStart() : handleStop()}
                    className="flex-1"
                  >
                    {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isRunning ? 'Pause' : 'Play'}
                  </Toggle>
                  <Button onClick={handleRandomize} variant="outline" size="sm">
                    <Shuffle className="w-4 h-4 mr-1" />
                    Random
                  </Button>
                </div>

                <Toggle 
                  pressed={animationsEnabled} 
                  onPressedChange={handleToggleAnimations}
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {animationsEnabled ? 'Animations On' : 'Animations Off'}
                </Toggle>

                <Toggle 
                  pressed={autoRandomize} 
                  onPressedChange={handleToggleAutoRandomize}
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {autoRandomize ? 'Auto-Randomize On' : 'Auto-Randomize Off'}
                </Toggle>

                <Toggle 
                  pressed={guiEnabled} 
                  onPressedChange={handleToggleGui}
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {guiEnabled ? 'Interactive GUI On' : 'Interactive GUI Off'}
                </Toggle>

                <Toggle 
                  pressed={handControl.enabled} 
                  onPressedChange={handleToggleHandControl}
                  className="w-full"
                >
                  <Hand className="w-4 h-4 mr-2" />
                  {handControl.enabled ? 'Hand Control On' : 'Hand Control Off'}
                </Toggle>
              </div>

              <Separator className="bg-white/20" />

              {/* Color Palette */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Color Palette</Label>
                <Select value={selectedCmap} onValueChange={handleCmapChange}>
                  <SelectTrigger className="bg-black/50 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cmapOptions.map(name => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-white/20" />

              {/* Instructions */}
              <div className="text-xs text-white/70 space-y-1">
                <p><kbd className="px-1 py-0.5 bg-white/20 rounded">SPACE</kbd> Toggle controls</p>
                <p><kbd className="px-1 py-0.5 bg-white/20 rounded">ESC</kbd> Exit full screen</p>
                <p>Scroll to zoom • Drag to pan</p>
                {guiEnabled && <p className="text-blue-400">Interactive GUI: Drag transform rings/lines</p>}
                {autoRandomize && <p className="text-yellow-400">Auto-randomizing every ~20s</p>}
                {handControl.enabled && (
                  <div className="text-green-400">
                    <p>Hand Control Active</p>
                    {handControl.leftXform !== null && (
                      <p>Left Hand → XForm {handControl.leftXform + 1}</p>
                    )}
                    {handControl.rightXform !== null && (
                      <p>Right Hand → XForm {handControl.rightXform + 1}</p>
                    )}
                    <p>Move hands to control position & rotation</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FullScreenViewer; 