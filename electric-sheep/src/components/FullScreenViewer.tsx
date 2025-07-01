import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Debug logging control
const PRINT_LOGS = false;
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Hands, type Results, type NormalizedLandmark } from '@mediapipe/hands';
import { guess } from 'web-audio-beat-detector';
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
  Download,
  Music,
  Upload,
  Volume2
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

interface AudioState {
  file: File | null;
  audioBuffer: AudioBuffer | null;
  audioContext: AudioContext | null;
  audioSource: AudioBufferSourceNode | null;
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  isLoading: boolean;
  bpm: number | null;
  offset: number | null;
  beatThreshold: number;
  lastBeatTime: number;
  beatSensitivity: number;
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
  const [showAudioModal, setShowAudioModal] = useState(false);
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

  const [audioState, setAudioState] = useState<AudioState>({
    file: null,
    audioBuffer: null,
    audioContext: null,
    audioSource: null,
    analyser: null,
    isPlaying: false,
    isLoading: false,
    bpm: null,
    offset: null,
    beatThreshold: 0.8,
    lastBeatTime: 0,
    beatSensitivity: 1.5
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const handControlRef = useRef(handControl);
  const audioStateRef = useRef(audioState);
  const beatAnimationRef = useRef<number | null>(null);
  const beatCountRef = useRef<number>(0);

  // Update ref whenever handControl state changes
  useEffect(() => {
    handControlRef.current = handControl;
  }, [handControl]);

  // Update ref whenever audioState changes
  useEffect(() => {
    audioStateRef.current = audioState;
  }, [audioState]);

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
      } else if (event.key === 'Enter') {
        event.preventDefault();
        // Trigger beat animation for testing
        triggerBeatAnimation();
        if (PRINT_LOGS) console.log('🎵 Manual beat triggered via Enter key');
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

      // Stop audio and beat detection
      if (audioStateRef.current.audioSource) {
        audioStateRef.current.audioSource.stop();
      }
      stopBeatDetection();
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



  // Audio processing and beat detection
  const loadAudioFile = async (file: File) => {
    setAudioState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Create audio context if not exists
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Analyze beat pattern
      const { bpm, offset } = await guess(audioBuffer);
      
      console.log('Audio analysis complete:', { bpm, offset });
      
      setAudioState(prev => ({
        ...prev,
        file,
        audioBuffer,
        audioContext,
        bpm,
        offset,
        isLoading: false
      }));
      
      // Log Google Analytics event
      if (window.gtag) {
        window.gtag('event', 'audio_upload', {
          event_category: 'audio_visualization',
          event_label: 'mp3_loaded'
        });
      }
      
    } catch (error) {
      console.error('Error loading audio file:', error);
      setAudioState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const playAudio = () => {
    if (PRINT_LOGS) console.log('🎵 Starting audio playback...');
    
    if (!audioStateRef.current.audioBuffer || !audioStateRef.current.audioContext) {
      if (PRINT_LOGS) console.log('❌ Missing audio buffer or context');
      return;
    }
    
    // Stop existing source if playing
    if (audioStateRef.current.audioSource) {
      audioStateRef.current.audioSource.stop();
    }
    
    // Create new audio source
    const source = audioStateRef.current.audioContext.createBufferSource();
    const analyser = audioStateRef.current.audioContext.createAnalyser();
    
    source.buffer = audioStateRef.current.audioBuffer;
    source.connect(analyser);
    analyser.connect(audioStateRef.current.audioContext.destination);
    
    // Configure analyser for beat detection
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    
    if (PRINT_LOGS) console.log('🎵 Audio nodes created and connected');
    
    // Update the ref immediately for beat detection
    audioStateRef.current = {
      ...audioStateRef.current,
      audioSource: source,
      analyser,
      isPlaying: true
    };
    
    setAudioState(prev => ({
      ...prev,
      audioSource: source,
      analyser,
      isPlaying: true
    }));
    
    // Start playback
    source.start();
    if (PRINT_LOGS) console.log('🎵 Audio source started');
    
    // Start beat detection with the analyser directly
    startBeatDetection(analyser);
    
    // Handle audio end
    source.onended = () => {
      if (PRINT_LOGS) console.log('🎵 Audio ended');
      setAudioState(prev => ({
        ...prev,
        audioSource: null,
        isPlaying: false
      }));
      
      stopBeatDetection();
    };
  };

  const pauseAudio = () => {
    if (PRINT_LOGS) console.log('🎵 Pausing audio...');
    if (audioStateRef.current.audioSource) {
      audioStateRef.current.audioSource.stop();
      
      // Update ref immediately
      audioStateRef.current = {
        ...audioStateRef.current,
        audioSource: null,
        isPlaying: false
      };
      
      setAudioState(prev => ({
        ...prev,
        audioSource: null,
        isPlaying: false
      }));
      
      stopBeatDetection();
    }
  };

  const startBeatDetection = (analyserNode?: AnalyserNode) => {
    const analyser = analyserNode || audioStateRef.current.analyser;
    
    if (PRINT_LOGS) console.log('🎵 Starting beat detection...', {
      hasAnalyser: !!analyser,
      hasAnalyserFromRef: !!audioStateRef.current.analyser,
      isPlaying: audioStateRef.current.isPlaying,
      hasAudioBuffer: !!audioStateRef.current.audioBuffer
    });
    
    if (!analyser) {
      if (PRINT_LOGS) console.log('❌ No analyser available for beat detection');
      return;
    }
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    if (PRINT_LOGS) console.log('🎵 Beat detection setup:', { bufferLength, analyserNode: !!analyser });
    
    const detectBeats = () => {
      if (!audioStateRef.current.isPlaying || !analyser) {
        if (PRINT_LOGS) console.log('🎵 Beat detection stopped:', { 
          isPlaying: audioStateRef.current.isPlaying, 
          hasAnalyser: !!analyser 
        });
        return;
      }
      
      analyser.getByteFrequencyData(dataArray);
      
      // Focus on bass frequencies (0-50Hz range) - expanded for better detection
      const bassRange = Math.floor(bufferLength * 0.15); // Increased from 0.1 to 0.15
      let bassSum = 0;
      
      for (let i = 0; i < bassRange; i++) {
        bassSum += dataArray[i];
      }
      
      const bassAverage = bassSum / bassRange;
      const normalizedBass = bassAverage / 255;
      

      
      // Detect beat if bass exceeds threshold and enough time has passed
      const currentTime = Date.now();
      const timeSinceLastBeat = currentTime - audioStateRef.current.lastBeatTime;
      
      if (normalizedBass > audioStateRef.current.beatThreshold && timeSinceLastBeat > 150) {
        if (PRINT_LOGS) console.log('🎵 Beat detected!', {
          bassLevel: normalizedBass.toFixed(3),
          sensitivity: audioStateRef.current.beatSensitivity.toFixed(1)
        });
        triggerBeatAnimation();
        setAudioState(prev => ({ ...prev, lastBeatTime: currentTime }));
      }
      
      beatAnimationRef.current = requestAnimationFrame(detectBeats);
    };
    
    if (PRINT_LOGS) console.log('🎵 Starting beat detection loop...');
    beatAnimationRef.current = requestAnimationFrame(detectBeats);
  };

  const stopBeatDetection = () => {
    if (beatAnimationRef.current) {
      cancelAnimationFrame(beatAnimationRef.current);
      beatAnimationRef.current = null;
    }
  };

  // Track ongoing beat animations
  const beatAnimationState = useRef<{
    animating: boolean;
    startFrame: number;
    targetFrame: number;
    startTime: number;
    animationId?: number;
    // For origin movement
    originTransformIndex?: number;
    originStartC?: number;
    originStartF?: number;
    originTargetC?: number;
    originTargetF?: number;
  }>({
    animating: false,
    startFrame: 0,
    targetFrame: 0,
    startTime: 0
  });

  const triggerBeatAnimation = () => {
    if (PRINT_LOGS) console.log('🎵 triggerBeatAnimation called');
    
    if (!window.flam3?.fractal || !window.flam3?.config) {
      if (PRINT_LOGS) console.log('❌ Missing flam3 or fractal/config');
      return;
    }
    
    // Increment beat counter
    beatCountRef.current += 1;
    if (PRINT_LOGS) console.log(`🎵 Beat #${beatCountRef.current}`);
    
    // Find animated and non-animated transforms
    const animatedTransforms: number[] = [];
    const nonAnimatedTransforms: number[] = [];
    
    for (let i = 0; i < window.flam3.fractal.length; i++) {
      const xform = window.flam3.fractal[i] as ExtendedFractalTransform;
      if (xform.animateX || xform.animateY) {
        animatedTransforms.push(i);
      } else {
        nonAnimatedTransforms.push(i);
      }
    }
    
    // Cancel any ongoing animation
    if (beatAnimationState.current.animationId) {
      cancelAnimationFrame(beatAnimationState.current.animationId);
    }
    
    // Set up base animation state
    beatAnimationState.current = {
      animating: true,
      startFrame: 0,
      targetFrame: 0,
      startTime: performance.now(),
      animationId: undefined
    };
    
    // Handle rotation for animated transforms (every beat)
    let framesToAdvance = 0;
    if (animatedTransforms.length > 0) {
      // The animation system calculates rotation as: angle = originalAngle + (frame * baseSpeed * animationSpeed)
      const desiredRotationDegrees = 15 * audioStateRef.current.beatSensitivity;
      const desiredRotationRadians = desiredRotationDegrees * Math.PI / 180;
      
      // Base animation speed is 0.02 radians per frame (from main.js)
      const baseAnimationSpeed = 0.02;
      const currentAnimationSpeed = window.flam3.config.animationSpeed;
      
      // Calculate how many frames to advance to achieve the desired rotation
      framesToAdvance = Math.floor(desiredRotationRadians / (baseAnimationSpeed * currentAnimationSpeed));
      
      // Access the actual WebGPU config buffer which has the frame property
      const configObj = window.flam3.config as FractalConfig & { frame?: number };
      const currentFrame = configObj.frame || 0;
      
      beatAnimationState.current.startFrame = currentFrame;
      beatAnimationState.current.targetFrame = currentFrame + framesToAdvance;
      
      if (PRINT_LOGS) {
        console.log(`🔄 Rotation for ${animatedTransforms.length} animated transforms:`);
        console.log(`   Rotation: ${desiredRotationDegrees.toFixed(1)}°`);
        console.log(`   Frames: ${currentFrame} → ${currentFrame + framesToAdvance}`);
      }
    }
    
    // Handle origin movement for one non-animated transform (every 4th beat only)
    const isEvery4thBeat = beatCountRef.current % 4 === 0;
    if (nonAnimatedTransforms.length > 0 && isEvery4thBeat) {
      // Pick a random non-animated transform
      const randomIndex = nonAnimatedTransforms[Math.floor(Math.random() * nonAnimatedTransforms.length)];
      const xform = window.flam3.fractal[randomIndex] as ExtendedFractalTransform;
      
      // Generate random target position within reasonable bounds
      const moveScale = 0.5 * audioStateRef.current.beatSensitivity; // Scale movement by sensitivity
      const targetC = xform.c + (Math.random() - 0.5) * moveScale;
      const targetF = xform.f + (Math.random() - 0.5) * moveScale;
      
      // Store origin animation data
      beatAnimationState.current.originTransformIndex = randomIndex;
      beatAnimationState.current.originStartC = xform.c;
      beatAnimationState.current.originStartF = xform.f;
      beatAnimationState.current.originTargetC = targetC;
      beatAnimationState.current.originTargetF = targetF;
      
      if (PRINT_LOGS) {
        console.log(`🎯 Origin movement for transform ${randomIndex} (${xform.variation}) - 4th Beat!:`);
        console.log(`   From: (${xform.c.toFixed(3)}, ${xform.f.toFixed(3)})`);
        console.log(`   To: (${targetC.toFixed(3)}, ${targetF.toFixed(3)})`);
      }
    } else if (nonAnimatedTransforms.length > 0) {
      if (PRINT_LOGS) console.log(`⏭️ Skipping origin movement (beat ${beatCountRef.current % 4 + 1}/4)`);
    }
    
    // If we have nothing to animate, exit
    if (animatedTransforms.length === 0 && (!isEvery4thBeat || nonAnimatedTransforms.length === 0)) {
      if (PRINT_LOGS) console.log('❌ No transforms to animate on this beat');
      return;
    }
    
    // Easing function (ease-out cubic)
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };
    
    // Animation duration in milliseconds
    const animationDuration = 300; // 300ms for smooth animation
    
    // Animation loop
    const animate = () => {
      if (!beatAnimationState.current.animating || !window.flam3?.config || !window.flam3?.fractal) return;
      
      const now = performance.now();
      const elapsed = now - beatAnimationState.current.startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Apply easing
      const easedProgress = easeOutCubic(progress);
      
      // Update frame counter for rotation animations
      if (animatedTransforms.length > 0 && framesToAdvance > 0) {
        const frameRange = beatAnimationState.current.targetFrame - beatAnimationState.current.startFrame;
        const currentAnimFrame = beatAnimationState.current.startFrame + Math.floor(frameRange * easedProgress);
        
        const config = window.flam3.config as FractalConfig & { frame?: number };
        config.frame = currentAnimFrame;
      }
      
      // Update origin position for non-animated transform
      if (beatAnimationState.current.originTransformIndex !== undefined) {
        const xform = window.flam3.fractal[beatAnimationState.current.originTransformIndex] as ExtendedFractalTransform;
        
        // Interpolate position
        const startC = beatAnimationState.current.originStartC || 0;
        const startF = beatAnimationState.current.originStartF || 0;
        const targetC = beatAnimationState.current.originTargetC || 0;
        const targetF = beatAnimationState.current.originTargetF || 0;
        
        xform.c = startC + (targetC - startC) * easedProgress;
        xform.f = startF + (targetF - startF) * easedProgress;
      }
      
      // Update display
      if (window.flam3.updateParams) {
        window.flam3.updateParams();
      }
      
      // Continue animation if not complete
      if (progress < 1) {
        beatAnimationState.current.animationId = requestAnimationFrame(animate);
      } else {
        // Animation complete
        beatAnimationState.current.animating = false;
        if (PRINT_LOGS) console.log('🎵 Beat animation complete');
      }
    };
    
    // Start animation
    beatAnimationState.current.animationId = requestAnimationFrame(animate);
  };

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

      {/* Audio Control and Hand Control buttons */}
      {!isLoading && (
        <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-4">
          {/* Audio Control button */}
          <div className="relative group">
            <Button 
              onClick={() => setShowAudioModal(true)}
              variant={audioState.isPlaying ? "default" : "outline"}
              size="lg"
              className={`
                relative w-16 h-16 rounded-full p-0 transition-all duration-300
                ${audioState.isPlaying 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-0 shadow-lg shadow-green-500/25' 
                  : 'bg-black/50 border-white/20 hover:bg-black/70 hover:border-white/40'
                }
              `}
              title="Audio visualization"
            >
              {audioState.isPlaying ? (
                <Volume2 className="w-8 h-8 text-white animate-pulse" />
              ) : (
                <Music className="w-8 h-8 text-white/90" />
              )}
            </Button>
            
            {/* Audio status indicator */}
            {audioState.file && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
                  {audioState.isPlaying ? '🎵 Audio Active' : '🎵 Ready'}
                </span>
              </div>
            )}
            
            {/* Hover tooltip */}
            {!audioState.file && (
              <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:opacity-100">
                <div className="bg-black/90 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap">
                  <p className="font-semibold mb-1">🎵 Audio Visualization</p>
                  <p>Sync fractals with music beats!</p>
                  <p className="text-white/70 mt-1">Click to upload MP3</p>
                </div>
                <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-black/90" />
              </div>
            )}
          </div>

          {/* Hand Control toggle button */}
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
                <p><kbd className="px-1 py-0.5 bg-white/20 rounded">ENTER</kbd> Manual beat (testing)</p>
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

      {/* Audio Modal */}
      {showAudioModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-black/90 border-white/20 text-white max-w-md w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Audio Visualization
                </CardTitle>
                <Button
                  onClick={() => setShowAudioModal(false)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!audioState.file ? (
                <>
                  {/* File Upload */}
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-white/50" />
                    <p className="text-lg mb-2">Upload MP3 File</p>
                    <p className="text-sm text-white/70 mb-4">
                      Choose an MP3 file to sync fractal animations with music beats
                    </p>
                    <input
                      type="file"
                      accept="audio/mp3,audio/mpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          loadAudioFile(file);
                        }
                      }}
                      className="hidden"
                      id="audio-upload"
                    />
                    <Button
                      onClick={() => document.getElementById('audio-upload')?.click()}
                      variant="outline"
                      className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                      disabled={audioState.isLoading}
                    >
                      {audioState.isLoading ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose File
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* How it works */}
                  <div className="text-xs text-white/70 space-y-2">
                    <h4 className="text-white font-medium">How it works:</h4>
                    <ul className="space-y-1 pl-2">
                      <li>• Upload an MP3 file to analyze beats</li>
                      <li>• Animated transforms rotate on beat</li>
                      <li>• Static transforms move position on beat</li>
                      <li>• Adjust sensitivity to control effect intensity</li>
                      <li>• Works best with electronic/dance music</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* Audio Controls */}
                  <div className="space-y-4">
                    <div className="bg-white/10 rounded-lg p-4">
                      <h3 className="font-medium mb-2">🎵 {audioState.file.name}</h3>
                      {audioState.bpm && (
                        <p className="text-sm text-white/70">
                          Detected BPM: {Math.round(audioState.bpm)}
                        </p>
                      )}
                    </div>
                    
                    {/* Play/Pause Controls */}
                    <div className="flex gap-2">
                      <Button
                        onClick={audioState.isPlaying ? pauseAudio : playAudio}
                        variant="outline"
                        className="flex-1 bg-black/50 border-white/20 text-white hover:bg-black/70"
                      >
                        {audioState.isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Play
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => {
                          pauseAudio();
                          setAudioState(prev => ({
                            ...prev,
                            file: null,
                            audioBuffer: null,
                            bpm: null,
                            offset: null
                          }));
                        }}
                        variant="outline"
                        size="sm"
                        className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Beat Sensitivity */}
                    <div className="space-y-2">
                      <Label className="text-sm">Beat Sensitivity</Label>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={audioState.beatSensitivity}
                        onChange={(e) => 
                          setAudioState(prev => ({
                            ...prev,
                            beatSensitivity: parseFloat(e.target.value)
                          }))
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-white/50">
                        <span>Subtle</span>
                        <span>Intense</span>
                      </div>
                    </div>

                    {/* Status */}
                    {audioState.isPlaying && (
                      <div className="text-center p-3 bg-green-900/30 border border-green-500/20 rounded-lg">
                        <Volume2 className="w-6 h-6 mx-auto mb-2 text-green-400 animate-pulse" />
                        <p className="text-sm text-green-400">
                          🎵 Audio visualization active
                        </p>
                        <p className="text-xs text-white/70 mt-1">
                          Transforms pulse & move with beats!
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Instructions */}
                  <div className="text-xs text-white/70 space-y-1 border-t border-white/20 pt-3">
                    <p className="text-white font-medium">💡 Tips:</p>
                    <p>• Animated transforms: rotation pulses on beat</p>
                    <p>• Static transforms: origin moves to random position</p>
                    <p>• Adjust sensitivity for stronger/weaker effects</p>
                    <p>• Electronic music with clear bass works best</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FullScreenViewer;