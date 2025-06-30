import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Hand,
  Download
} from 'lucide-react';
import type { FractalConfig, ExtendedFractalTransform } from '@/types/fractal';
import { useSEO, pageSEO } from '../hooks/useSEO';
import { useFractalGallery } from '@/hooks/useFractalStorage';
import type { FractalRecord } from '@/hooks/useFractalStorage';

interface HandControlState {
  enabled: boolean;
  leftXform: number | null;
  rightXform: number | null;
  leftHandCenter: { x: number; y: number } | null;
  rightHandCenter: { x: number; y: number } | null;
  leftHandRotation: number;
  rightHandRotation: number;
  originalTransforms: Map<number, ExtendedFractalTransform>;
  leftPinching: boolean;
  rightPinching: boolean;
  leftPinchStart: { x: number; y: number } | null;
  rightPinchStart: { x: number; y: number } | null;
  originalZoom: number;
  originalPan: { x: number; y: number };
  lastRandomizeTime: number;
  twoHandedPinchCount: number;
  lastTwoHandedPinchTime: number;
  randomizeProgress: number;
  }

// Extend the Window interface to include gtag
declare global {
  interface Window {
    gtag: (command: string, action: string, parameters?: {
      event_category?: string;
      event_label?: string;
      value?: number;
    }) => void;
  }
}

const FullScreenViewer: React.FC = () => {
  // SEO
  useSEO(pageSEO.fullscreen);
  
  const navigate = useNavigate();
  const { fractalId } = useParams<{ fractalId?: string }>();
  const { fetchFractalById, incrementViewCount } = useFractalGallery();
  
  const [loadedFractal, setLoadedFractal] = useState<FractalRecord | null>(null);
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
  const [showHandGuide, setShowHandGuide] = useState(true);
  const [timeoutCountdown, setTimeoutCountdown] = useState<number>(0);
  const [handControl, setHandControl] = useState<HandControlState>({
    enabled: false,
    leftXform: null,
    rightXform: null,
    leftHandCenter: null,
    rightHandCenter: null,
    leftHandRotation: 0,
    rightHandRotation: 0,
    originalTransforms: new Map(),
    leftPinching: false,
    rightPinching: false,
    leftPinchStart: null,
    rightPinchStart: null,
    originalZoom: 1,
    originalPan: { x: 0, y: 0 },
    lastRandomizeTime: 0,
    twoHandedPinchCount: 0,
    lastTwoHandedPinchTime: 0,
    randomizeProgress: 0
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const handControlRef = useRef(handControl);

  // Update ref whenever handControl state changes
  useEffect(() => {
    handControlRef.current = handControl;
  }, [handControl]);

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

  // Update SEO when viewing a specific fractal
  useEffect(() => {
    if (loadedFractal) {
      // Update page title and meta tags for the specific fractal
      document.title = `${loadedFractal.title} - Full Screen | Electric Sheep GPU`;
      
      // Update meta tags for social sharing
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', 
          loadedFractal.description || `Experience "${loadedFractal.title}" in full screen - A mesmerizing GPU-accelerated fractal flame`
        );
      }

      // Update Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', `${loadedFractal.title} - Full Screen Fractal`);
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', 
          loadedFractal.description || `Experience this stunning fractal flame in full screen mode`
        );
      }

      // If there's a thumbnail, update the image meta tag
      if (loadedFractal.thumbnail_url) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          ogImage.setAttribute('content', loadedFractal.thumbnail_url);
        }
      }

      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) {
        ogUrl.setAttribute('content', `${window.location.origin}/fullscreen/${loadedFractal.id}`);
      }
    }
  }, [loadedFractal]);

  // Load specific fractal if fractalId is in URL
  useEffect(() => {
    if (fractalId) {
      loadSpecificFractal(fractalId);
    }
  }, [fractalId]);

  const loadSpecificFractal = async (id: string) => {
    const fractal = await fetchFractalById(id);
    if (fractal) {
      setLoadedFractal(fractal);
      // Increment view count
      try {
        await incrementViewCount(fractal.id);
      } catch (err) {
        console.warn('Failed to increment view count:', err);
      }
    } else {
      // If fractal not found, redirect to fullscreen
      navigate('/fullscreen');
    }
  };

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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Final safety check: ensure camera is stopped when component unmounts
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped camera track on component unmount:', track.kind);
        });
        videoRef.current.srcObject = null;
      }
      
      // Close MediaPipe Hands if still active
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
    };
  }, []);

  // Load fractal engine
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    const applyFractalData = async (flam3: typeof window.flam3, data: FractalRecord) => {
      try {
        // Set colormap
        if (data.colormap && window.cmaps) {
          console.log('Loading fractal with colormap:', data.colormap);
          flam3.cmap = data.colormap;
          setSelectedCmap(data.colormap);
        }

        // Apply config
        const config = flam3.config;
        Object.assign(config, data.config);

        // Clear existing transforms
        flam3.fractal.length = 0;

        // Add new transforms
        for (let i = 0; i < data.transforms.length; i++) {
          const transform = data.transforms[i];
          flam3.fractal.add({
            variation: transform.variation,
            color: transform.color,
            a: transform.a,
            b: transform.b,
            c: transform.c,
            d: transform.d,
            e: transform.e,
            f: transform.f,
            animateX: transform.animateX,
            animateY: transform.animateY,
          });
        }

        // Update the GPU buffers and clear
        flam3.updateParams();
        flam3.clear();

        console.log('Fractal data applied successfully:', {
          config: data.config,
          transforms: data.transforms,
          colormap: data.colormap
        });

      } catch (error) {
        console.error('Error applying fractal data:', error);
        throw error;
      }
    };
    
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
              // Only randomize if we don't have a specific fractal to load
              if (!loadedFractal) {
                flam3.randomize();
              } else {
                // Apply the loaded fractal data
                await applyFractalData(flam3, loadedFractal);
              }
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
  }, [loadedFractal]);

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

    // Detect pinch gestures
    const leftPinch = leftHand ? isPinching(leftHand) : false;
    const rightPinch = rightHand ? isPinching(rightHand) : false;
    const currentTime = Date.now();

    // Handle two-handed pinch gestures (both hands pinching simultaneously)
    if (leftPinch && rightPinch && leftHand && rightHand) {
      // Get thumb positions for both hands
      const leftThumb = leftHand[4]; // Thumb tip
      const rightThumb = rightHand[4]; // Thumb tip
      
      // Calculate distance between thumbs
      const thumbDistance = Math.hypot(
        rightThumb.x - leftThumb.x,
        rightThumb.y - leftThumb.y,
        rightThumb.z - leftThumb.z
      );
      
      // Calculate midpoint between thumbs
      const thumbMidpoint = {
        x: (leftThumb.x + rightThumb.x) / 2,
        y: (leftThumb.y + rightThumb.y) / 2
      };

      if (!handControlRef.current.leftPinching && !handControlRef.current.rightPinching) {
        // Start two-handed pinching - store initial state
        const currentX = (window.flam3?.config as FractalConfig & { x?: number })?.x || 0;
        const currentY = (window.flam3?.config as FractalConfig & { y?: number })?.y || 0;
        
        // Check if this is part of a quick succession of pinches
        const timeSinceLastPinch = currentTime - handControlRef.current.lastTwoHandedPinchTime;
        if (timeSinceLastPinch < 2000) { // Within 2 seconds of last pinch
          const newCount = handControlRef.current.twoHandedPinchCount + 1;
          
          if (newCount >= 3 && currentTime - handControlRef.current.lastRandomizeTime > 5000) {
            // Trigger randomization after 3 quick pinches
            handleRandomize();
            setHandControl(prev => ({
              ...prev,
              leftPinching: true,
              rightPinching: true,
              leftPinchStart: { x: leftThumb.x, y: leftThumb.y },
              rightPinchStart: { x: rightThumb.x, y: rightThumb.y },
              originalZoom: window.flam3?.config?.zoom || 1,
              originalPan: { x: currentX, y: currentY },
              twoHandedPinchCount: 0,
              lastTwoHandedPinchTime: currentTime,
              lastRandomizeTime: currentTime,
              randomizeProgress: 0
            }));
          } else {
            // Continue counting pinches
            setHandControl(prev => ({
              ...prev,
              leftPinching: true,
              rightPinching: true,
              leftPinchStart: { x: leftThumb.x, y: leftThumb.y },
              rightPinchStart: { x: rightThumb.x, y: rightThumb.y },
              originalZoom: window.flam3?.config?.zoom || 1,
              originalPan: { x: currentX, y: currentY },
              twoHandedPinchCount: newCount,
              lastTwoHandedPinchTime: currentTime,
              randomizeProgress: newCount / 3 // Progress towards randomization
            }));
            // Reset countdown when making progress
            if (newCount === 2) {
              setTimeoutCountdown(3);
            }
          }
        } else {
          // Reset count if too much time has passed
          setHandControl(prev => ({
            ...prev,
            leftPinching: true,
            rightPinching: true,
            leftPinchStart: { x: leftThumb.x, y: leftThumb.y },
            rightPinchStart: { x: rightThumb.x, y: rightThumb.y },
            originalZoom: window.flam3?.config?.zoom || 1,
            originalPan: { x: currentX, y: currentY },
            twoHandedPinchCount: 1,
            lastTwoHandedPinchTime: currentTime,
            randomizeProgress: 1 / 3
          }));
        }
      } else if (handControlRef.current.leftPinchStart && handControlRef.current.rightPinchStart && window.flam3?.config) {
        // Continue two-handed pinching
        
        // Calculate original thumb distance
        const originalThumbDistance = Math.hypot(
          handControlRef.current.rightPinchStart.x - handControlRef.current.leftPinchStart.x,
          handControlRef.current.rightPinchStart.y - handControlRef.current.leftPinchStart.y
        );
        
                 // Calculate zoom based on distance change (wider = zoom in, closer = zoom out)
         const distanceRatio = thumbDistance / originalThumbDistance;
         const newZoom = handControlRef.current.originalZoom * distanceRatio; // wider distance = larger zoom
        
        // Apply zoom with clamping
        window.flam3.config.zoom = Math.max(0.01, Math.min(50, newZoom));
        
        // Calculate original midpoint
        const originalMidpoint = {
          x: (handControlRef.current.leftPinchStart.x + handControlRef.current.rightPinchStart.x) / 2,
          y: (handControlRef.current.leftPinchStart.y + handControlRef.current.rightPinchStart.y) / 2
        };
        
        // Calculate pan based on midpoint movement
        const deltaX = (thumbMidpoint.x - originalMidpoint.x) * 4; // Increased sensitivity
        const deltaY = (thumbMidpoint.y - originalMidpoint.y) * 4;
        
        // Apply pan offset
        const newX = handControlRef.current.originalPan.x + deltaX / window.flam3.config.zoom;
        const newY = handControlRef.current.originalPan.y - deltaY / window.flam3.config.zoom; // Flip Y for natural movement
        (window.flam3.config as FractalConfig & { x?: number }).x = newX;
        (window.flam3.config as FractalConfig & { y?: number }).y = newY;
        
        window.flam3.clear();
      }
    } else if (handControlRef.current.leftPinching || handControlRef.current.rightPinching) {
      // Stop two-handed pinching when either hand stops pinching
      setHandControl(prev => ({
        ...prev,
        leftPinching: false,
        rightPinching: false,
        leftPinchStart: null,
        rightPinchStart: null
      }));
    } else {
      // Neither hand is pinching - check if we should reset the count
      const timeSinceLastPinch = currentTime - handControlRef.current.lastTwoHandedPinchTime;
      if (handControlRef.current.twoHandedPinchCount > 0 && timeSinceLastPinch > 2000) {
        // Reset count if more than 2 seconds have passed
        setHandControl(prev => ({
          ...prev,
          twoHandedPinchCount: 0,
          randomizeProgress: 0
        }));
      }
    }



    // Update left hand controlled xform
    if (handControl.leftXform !== null && leftCenter && window.flam3.fractal[handControl.leftXform]) {
      const xform = window.flam3.fractal[handControl.leftXform] as ExtendedFractalTransform;
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
      const xform = window.flam3.fractal[handControl.rightXform] as ExtendedFractalTransform;
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

  // Helper function to detect pinch gesture (thumb + index finger)
  const isPinching = (landmarks: NormalizedLandmark[]) => {
    // Calculate distance between thumb tip (4) and index finger tip (8)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    const distance = Math.hypot(
      thumbTip.x - indexTip.x,
      thumbTip.y - indexTip.y,
      thumbTip.z - indexTip.z
    );
    
    return distance < 0.06; // Pinch threshold from the example
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
      const xform = window.flam3.fractal[index] as ExtendedFractalTransform;
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

  // Reset pinch counter after timeout with countdown
  useEffect(() => {
    if (handControl.randomizeProgress >= 2/3 && handControl.randomizeProgress < 1) {
      setTimeoutCountdown(3);
      
      // Update countdown every second
      const countdownInterval = setInterval(() => {
        setTimeoutCountdown(prev => {
          if (prev <= 1) {
            // Check if we should actually reset
            const currentTime = Date.now();
            const timeSinceLastPinch = currentTime - handControlRef.current.lastTwoHandedPinchTime;
            
            if (timeSinceLastPinch > 3000) {
              setHandControl(prevControl => ({
                ...prevControl,
                twoHandedPinchCount: 0,
                randomizeProgress: 0
              }));
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(countdownInterval);
        setTimeoutCountdown(0);
      };
    } else {
      setTimeoutCountdown(0);
    }
  }, [handControl.randomizeProgress]);

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
      
      // Log Google Analytics event
      if (window.gtag) {
        window.gtag('event', 'randomize', {
          event_category: 'fractal_generation',
          event_label: 'fullscreen_randomize'
        });
      }
      
      // Set animation speed to 10% after randomizing
      if (window.flam3.config) {
        window.flam3.config.animationSpeed = 0.1;
        window.flam3.updateParams();
      }
      
      // Randomly animate one transform to make the scene dynamic
      if (window.flam3.fractal && window.flam3.fractal.length > 0) {
        // First, disable all animations
        for (let i = 0; i < window.flam3.fractal.length; i++) {
          const transform = window.flam3.fractal[i] as ExtendedFractalTransform;
          transform.animateX = false;
          transform.animateY = false;
        }
        
        // Pick a random transform to animate
        const randomTransformIndex = Math.floor(Math.random() * window.flam3.fractal.length);
        const randomTransform = window.flam3.fractal[randomTransformIndex] as ExtendedFractalTransform;
        
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
      setShowHandGuide(true); // Auto-show gesture guide when enabling hand control
    } else {
      // Disable hand control and restore original xforms
      if (window.flam3?.fractal) {
        handControl.originalTransforms.forEach((original, index) => {
          if (window.flam3.fractal[index]) {
            const xform = window.flam3.fractal[index] as ExtendedFractalTransform;
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
      
      // Stop camera stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped camera track:', track.kind);
        });
        videoRef.current.srcObject = null;
      }
      
      // Stop MediaPipe Hands
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
      
      setHandControl({
        enabled: false,
        leftXform: null,
        rightXform: null,
        leftHandCenter: null,
        rightHandCenter: null,
        leftHandRotation: 0,
        rightHandRotation: 0,
        originalTransforms: new Map(),
        leftPinching: false,
        rightPinching: false,
        leftPinchStart: null,
        rightPinchStart: null,
        originalZoom: 1,
        originalPan: { x: 0, y: 0 },
        lastRandomizeTime: 0,
        twoHandedPinchCount: 0,
        lastTwoHandedPinchTime: 0,
        randomizeProgress: 0
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

  const handleDownloadPNG = () => {
    if (canvasRef.current) {
      try {
        // Create a temporary canvas to ensure we get the full resolution
        const canvas = canvasRef.current;
        const dataURL = canvas.toDataURL('image/png', 1.0);
        
        // Create download link
        const link = document.createElement('a');
        link.download = `fractal-${Date.now()}.png`;
        link.href = dataURL;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Log Google Analytics event
        if (window.gtag) {
          window.gtag('event', 'export_image', {
            event_category: 'export',
            event_label: 'png_export_fullscreen'
          });
        }
      } catch (error) {
        console.error('Error downloading PNG:', error);
      }
    }
  };

  const handleExitFullScreen = () => {
    // Ensure camera is stopped before navigating away
    if (handControl.enabled && videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped camera track on exit:', track.kind);
      });
      videoRef.current.srcObject = null;
    }
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
        <>
          <video 
            ref={videoRef} 
            className="fixed bottom-4 left-4 z-50 w-48 h-36 border-2 border-white/20 rounded-lg bg-black/50" 
            autoPlay 
            playsInline 
            muted
            width={640}
            height={480}
          />
          {/* Camera active indicator */}
          <div className="fixed bottom-4 left-52 z-50 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1.5 rounded-full text-xs font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Camera Active
          </div>
        </>
      )}

      {/* Hand gesture guide */}
      {handControl.enabled && !isLoading && (
        <div className="fixed top-20 left-4 z-40 max-w-xs">
          {showHandGuide ? (
            <Card className="bg-black/80 backdrop-blur-sm border-white/20 text-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hand className="w-4 h-4" />
                    Hand Gestures
                  </CardTitle>
                  <Button
                    onClick={() => setShowHandGuide(false)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/20"
                  >
                    <Minimize className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-lg">✋</span>
                  <div>
                    <p className="font-semibold">Move Hands</p>
                    <p className="text-white/70">Control transforms</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">🤏🤏</span>
                  <div>
                    <p className="font-semibold">Pinch Both Hands</p>
                    <p className="text-white/70">Zoom & Pan mode</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">↔️</span>
                  <div>
                    <p className="font-semibold">Spread/Close</p>
                    <p className="text-white/70">Zoom in/out</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">3️⃣</span>
                  <div>
                    <p className="font-semibold">Triple Pinch</p>
                    <p className="text-white/70">Pinch 3x quickly to randomize</p>
                  </div>
                </div>
              </div>
              
              {/* Privacy notice */}
              <div className="text-xs text-white/50 border-t border-white/20 pt-2 mt-2">
                <p className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  Camera is active and will auto-stop when disabled
                </p>
              </div>
              
              {/* Active gesture indicator */}
              {(handControl.leftPinching && handControl.rightPinching) && (
                <div className="pt-2 border-t border-white/20">
                  <p className="text-yellow-400 animate-pulse">
                    🤏 Two-handed control active
                  </p>
                  {handControl.randomizeProgress >= 1/3 && handControl.randomizeProgress < 1 && (
                    <p className="text-blue-400 text-xs mt-1">
                      Pinch count: {Math.floor(handControl.randomizeProgress * 3)}/3
                    </p>
                  )}
                </div>
              )}
              
              {/* Transform control indicators */}
              {(handControl.leftXform !== null || handControl.rightXform !== null) && (
                <div className="pt-2 border-t border-white/20 space-y-1">
                  {handControl.leftXform !== null && (
                    <p className="text-green-400">
                      Left Hand → Transform {handControl.leftXform + 1}
                    </p>
                  )}
                  {handControl.rightXform !== null && (
                    <p className="text-green-400">
                      Right Hand → Transform {handControl.rightXform + 1}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          ) : (
            <Button
              onClick={() => setShowHandGuide(true)}
              variant="outline"
              size="sm"
              className="bg-black/80 border-white/20 text-white hover:bg-black/90 hover:border-white/40 flex items-center gap-2"
            >
              <Hand className="w-4 h-4" />
              <span className="text-xs">Show Gestures</span>
            </Button>
          )}
        </div>
      )}

      {/* Exit button - always visible */}
      {!isLoading && (
        <div className="absolute top-4 left-4 z-50">
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleExitFullScreen}
              variant="outline"
              size="sm"
              className="bg-black/50 border-white/20 text-white hover:bg-black/70"
            >
              <Minimize className="w-4 h-4 mr-2" />
              Exit Full Screen
            </Button>
            {loadedFractal && (
              <div className="bg-black/50 border border-white/20 text-white px-3 py-1.5 rounded-md text-sm">
                <span className="opacity-70">Viewing:</span> {loadedFractal.title}
              </div>
            )}
          </div>
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

      {/* Hand Control toggle button - prominent circular button */}
      {!isLoading && (
        <div className="absolute bottom-8 right-8 z-50">
          <div className="relative group">
            {/* Pulsing ring animation when not active */}
            {!handControl.enabled && (
              <div className="absolute inset-0 rounded-full animate-ping bg-white/20" />
            )}
            <Button 
              onClick={handleToggleHandControl}
              variant={handControl.enabled ? "default" : "outline"}
              size="lg"
              className={`
                relative w-16 h-16 rounded-full p-0 transition-all duration-300
                ${handControl.enabled 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 border-0 shadow-lg shadow-purple-500/25' 
                  : 'bg-black/50 border-white/20 hover:bg-black/70 hover:border-white/40'
                }
              `}
              title={handControl.enabled ? "Disable hand control" : "Enable hand control"}
            >
              <Hand className={`w-8 h-8 ${handControl.enabled ? 'text-white animate-pulse' : 'text-white/90'}`} />
            </Button>
            {handControl.enabled && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
                  {handControl.randomizeProgress >= 2/3 && handControl.randomizeProgress < 1 
                    ? '🤏 One more pinch!'
                    : 'Hand Control Active'
                  }
                </span>
              </div>
            )}
            {/* Hover tooltip */}
            {!handControl.enabled && (
              <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:opacity-100">
                <div className="bg-black/90 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
                  <p className="font-semibold mb-1">✋ Hand Control</p>
                  <p>Control fractals with your hands!</p>
                  <p className="text-white/70 mt-1">Click to enable camera</p>
                </div>
                <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-black/90" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Triple pinch progress bar - only show after 2 pinches */}
      {!isLoading && handControl.enabled && handControl.randomizeProgress >= 2/3 && handControl.randomizeProgress < 1 && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/20 ${timeoutCountdown <= 1 ? 'animate-pulse' : ''}`}>
          <div className="px-6 py-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-white text-sm">🤏 One more pinch to randomize!</span>
              <span className={`text-xs ${timeoutCountdown <= 1 ? 'text-red-400' : 'text-white/70'}`}>
                {timeoutCountdown > 0 ? `${timeoutCountdown}s remaining` : '2/3 complete'}
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 relative overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${handControl.randomizeProgress * 100}%` }}
              />
              {timeoutCountdown > 0 && (
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent to-red-500/40 transition-all duration-1000 ease-linear"
                  style={{ 
                    width: '100%',
                    transform: `translateX(${(timeoutCountdown / 3) * 100}%)`,
                    opacity: timeoutCountdown <= 1 ? 0.8 : 0.4
                  }}
                />
              )}
            </div>
          </div>
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

                <Button onClick={handleDownloadPNG} variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>

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

                <div className="space-y-2">
                  <Toggle 
                    pressed={handControl.enabled} 
                    onPressedChange={handleToggleHandControl}
                    className="w-full opacity-60"
                    size="sm"
                  >
                    <Hand className="w-4 h-4 mr-2" />
                    {handControl.enabled ? 'Hand Control On' : 'Hand Control Off'}
                  </Toggle>
                  <p className="text-xs text-white/50 text-center">
                    Use the button in the bottom right ↘️
                  </p>
                </div>
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
                    <div className="text-cyan-400 text-xs mt-2">
                      <p>• Both hands pinch = Zoom & Pan</p>
                      <p>• Thumbs apart/together = Zoom in/out</p>
                      <p>• Move thumb midpoint = Pan</p>
                      <p>• Triple pinch quickly = Randomize</p>
                      {(handControl.leftPinching && handControl.rightPinching) && <p className="text-yellow-400">🤏 Two-handed control active</p>}
                      {handControl.randomizeProgress >= 1/3 && handControl.randomizeProgress < 1 && <p className="text-green-400">🤏 Pinch {Math.floor(handControl.randomizeProgress * 3)}/3 (randomize)</p>}
                    </div>
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