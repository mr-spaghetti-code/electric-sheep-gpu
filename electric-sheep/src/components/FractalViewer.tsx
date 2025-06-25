import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Shuffle,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  ZoomIn,
  Palette,
  Settings2,
  Plus,
  Film,

  ChevronDown,
  ChevronRight,
  Upload
} from 'lucide-react';
import './FractalViewer.css';
import type { FractalConfig, FractalInstance, ExtendedFractalTransform } from '@/types/fractal';
import SaveFractalDialog from './SaveFractalDialog';
import GifExportDialog from './GifExportDialog';
import { useSEO, pageSEO } from '../hooks/useSEO';

// Extend the FractalInstance interface for the FractalViewer specific needs
interface FractalViewerInstance extends FractalInstance {
  exportPNG: () => void;
  exportGIF: (progressCallback: (current: number, total: number, status?: string) => void, settings?: { duration: number; quality: number; fps: number; size: number }) => Promise<void>;
  step: () => void;
  updateUIControls?: () => void;
  currentColormap?: string;
}

// Interface for XForm from main.js with affine transform properties
interface WebGPUXForm {
  variation: string;
  animateX: boolean;
  animateY: boolean;
  color: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

declare global {
  interface Window {
    flam3: FractalViewerInstance;
    config: FractalConfig;
    cmaps: Record<string, unknown>;
    FractalFunctions: unknown;
    init: (canvas: HTMLCanvasElement, startRunning?: boolean) => Promise<FractalViewerInstance>;
    populateVariationOptions: () => void;
    fractalModuleLoaded: boolean;
    refreshXFormEditorsList?: () => void;
  }
}

interface FractalViewerProps {
  width?: number;
  height?: number;
}

const FractalViewer: React.FC<FractalViewerProps> = ({ 
  width = 900, 
  height = 900
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCmap, setSelectedCmap] = useState('gnuplot');
  const [animationSpeed, setAnimationSpeed] = useState(0.1);
  const [zoomLevel, setZoomLevel] = useState(0.7);
  const [isRunning, setIsRunning] = useState(true);
  const [guiEnabled, setGuiEnabled] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  const [cmapOptions, setCmapOptions] = useState<string[]>([]);

  // Advanced controls state
  const [finalXform, setFinalXform] = useState(-1);
  const [cfinalXform, setCfinalXform] = useState(-1);
  const [rotation, setRotation] = useState(1);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [gamma, setGamma] = useState(2.2);
  const [hueShift, setHueShift] = useState(0);
  const [satShift, setSatShift] = useState(0);
  const [lightShift, setLightShift] = useState(0);
  const [numPoints, setNumPoints] = useState(30000);
  const [availableTransforms, setAvailableTransforms] = useState<Array<{id: number, name: string}>>([]);
  
  // How to use dropdown state
  const [showHowTo, setShowHowTo] = useState(true);
  
  // GIF export state
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [gifExportProgress, setGifExportProgress] = useState<{current: number, total: number, status: string}>({
    current: 0,
    total: 0,
    status: ''
  });
  const [showGifExportDialog, setShowGifExportDialog] = useState(false);
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // SEO
  useSEO(pageSEO.home);


  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    // Add the XForm editor template to the document
    const template = document.createElement('template');
    template.id = 'xform-editor-template';
    template.innerHTML = `
      <style>
        :host {
          color: #f8fafc;
        }
        .editor-element {
          display: block;
          margin-top: 0.8em;
        }
        .vector {
          vertical-align: middle;
          display: inline-block;
          border: 1px solid #475569;
          border-radius: 0.375rem;
          padding: 0.25rem;
          background: #1e293b;
        }
        .affine-transform {
          min-width: 200px;
          margin: 0.5rem 0;
        }
        .vector td {
          text-align: right;
          padding: 0.25rem 0.5rem;
          color: #f8fafc;
          font-family: monospace;
          font-weight: 600;
        }
        .remove-button {
          text-align: center;
          margin-top: 1rem;
        }
        select, input[type="range"] {
          background: #0f172a;
          border: 1px solid #475569;
          color: #f8fafc;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          margin-left: 0.5rem;
        }
        select:hover, input[type="range"]:hover {
          background: #1e293b;
          border-color: #64748b;
        }
        select:focus, input[type="range"]:focus {
          outline: 2px solid #3b82f6;
          border-color: #3b82f6;
        }
        label {
          color: #f8fafc;
          font-size: 0.875rem;
          font-weight: 500;
        }
        i {
          color: #f8fafc;
          font-style: normal;
          font-weight: 600;
        }
        button {
          background: #dc2626;
          color: white;
          border: none;
          padding: 0.375rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
        }
        button:hover {
          background: #b91c1c;
        }
        input[type="checkbox"] {
          margin-right: 0.5rem;
          width: 1rem;
          height: 1rem;
          accent-color: #3b82f6;
        }
      </style>
      <label class="editor-element">
        <i>Variation:</i>
        <select name="variation-selector">
        </select>
      </label>
      <label class="editor-element">
        <i>Color:</i>
        <input type="range" name="color" min="0" max="1" step="0.0001" value="0">
      </label>
      <div class="editor-element">
        <label><input type="checkbox" name="animateX"> Animate X</label>
        <label style="margin-left: 20px;"><input type="checkbox" name="animateY"> Animate Y</label>
      </div>
      <div class="affine-transform editor-element">
        <table class="vector">
          <tr>
            <td><slot name="a">a</slot></td>
            <td><slot name="b">b</slot></td>
          </tr>
          <tr>
            <td><slot name="d">d</slot></td>
            <td><slot name="e">e</slot></td>
          </tr>
        </table>
        <table class="vector">
          <tr><td>x</td></tr>
          <tr><td>y</td></tr>
        </table>
         +
        <table class="vector">
          <tr><td><slot name="c">c</slot></td></tr>
          <tr><td><slot name="f">f</slot></td></tr>
        </table>
      </div>
      <div class="editor-element remove-button">
        <button>Remove</button>
      </div>
    `;
    document.body.appendChild(template);
    
    // Define the XForm editor custom element
    if (!customElements.get('xform-editor')) {
      customElements.define('xform-editor', class extends HTMLElement {
        static get observedAttributes() {
          return ['variation', 'color', 'a', 'b', 'c', 'd', 'e', 'f', 'animateX', 'animateY']
        }
        constructor() {
          super();
          const template = document.getElementById('xform-editor-template') as HTMLTemplateElement;
          if (template && template.content) {
            this.attachShadow({mode: 'open'})
              .appendChild(template.content.cloneNode(true));
          }
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          if ((this.constructor as typeof HTMLElement & { observedAttributes: string[] }).observedAttributes.includes(name)) {
            if (name === 'variation' && this.shadowRoot) {
              const select = this.shadowRoot.querySelector('select');
              if (select && newValue) select.value = newValue;
            } else if (name === 'color' && this.shadowRoot) {
              const input = this.shadowRoot.querySelector('input[name="color"]') as HTMLInputElement;
              if (input && newValue) input.value = newValue;
            } else if (name === 'animateX' && this.shadowRoot) {
              const checkbox = this.shadowRoot.querySelector('input[name="animateX"]') as HTMLInputElement;
              if (checkbox) checkbox.checked = newValue === 'true';
            } else if (name === 'animateY' && this.shadowRoot) {
              const checkbox = this.shadowRoot.querySelector('input[name="animateY"]') as HTMLInputElement;
              if (checkbox) checkbox.checked = newValue === 'true';
            } else if (this.shadowRoot && newValue) {
              const slot = this.shadowRoot.querySelector(`slot[name="${name}"]`);
              if (slot) slot.textContent = newValue;
            }
          } else {
            console.warn(`Unknown attribute ${name} changed from ${oldValue} to ${newValue}`);
          }
        }
      });
    }
    
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
            // Populate variation options after template is loaded
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
              
              // Update available transforms
              updateAvailableTransforms();
              
              // Sync UI state with the randomized config values
              if (flam3.config) {
                const config = flam3.config;
                setRotation(config.rotation);
                setMirrorX(config.mirrorX);
                setMirrorY(config.mirrorY);
                setGamma(config.gamma);
                setHueShift(config.hueShift);
                setSatShift(config.satShift);
                setLightShift(config.lightShift);
                setZoomLevel(config.zoom);
                setFinalXform(config.final);
                setCfinalXform(config.cfinal);
                setNumPoints(config.numPoints || 30000);
                
                // Apply the UI animation speed to the config
                config.animationSpeed = animationSpeed;
                flam3.updateParams();
                
                // Sync the colormap state with what was set by randomize
                setTimeout(() => {
                  const currentCmap = getCurrentColormap();
                  setSelectedCmap(currentCmap);
                }, 100);
              }
            }
            
            // Initialize animation state
            if (flam3.hasActiveAnimations) {
              setAnimationsEnabled(flam3.hasActiveAnimations());
            }
            
            // Ensure GUI overlay is disabled to match React state
            // Do this after randomize() call since it might enable the GUI
            flam3.gui = guiEnabled; // Set to match the React state (false by default)
            
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
      // Remove template
      const templateToRemove = document.getElementById('xform-editor-template');
      if (templateToRemove && templateToRemove.parentNode) {
        templateToRemove.parentNode.removeChild(templateToRemove);
      }
    };
  }, []);

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

  const handleStep = () => {
    if (window.flam3) {
      window.flam3.step();
    }
  };

  const handleClear = () => {
    if (window.flam3) {
      window.flam3.clear();
    }
  };

  const handleToggleGui = () => {
    if (window.flam3) {
      window.flam3.gui = !window.flam3.gui;
      setGuiEnabled(!guiEnabled);
    }
  };

  const handleRandomize = () => {
    if (window.flam3 && window.flam3.randomize) {
      window.flam3.randomize();
      
      // Update available transforms
      updateAvailableTransforms();
      
      // Sync UI state with the new config values
      if (window.flam3.config) {
        const config = window.flam3.config;
        setRotation(config.rotation);
        setMirrorX(config.mirrorX);
        setMirrorY(config.mirrorY);
        setGamma(config.gamma);
        setHueShift(config.hueShift);
        setSatShift(config.satShift);
        setLightShift(config.lightShift);
        setZoomLevel(config.zoom);
        setFinalXform(config.final);
        setCfinalXform(config.cfinal);
        setNumPoints(config.numPoints || 30000);
        
        // Apply the UI animation speed to the config
        config.animationSpeed = animationSpeed;
        window.flam3.updateParams();
        
        // Update animation state
        if (window.flam3.hasActiveAnimations) {
          setAnimationsEnabled(window.flam3.hasActiveAnimations());
        }
        
        // Sync the colormap state with what was set by randomize
        setTimeout(() => {
          const currentCmap = getCurrentColormap();
          setSelectedCmap(currentCmap);
        }, 100);
      }
    }
  };

  const handleToggleAnimations = (enabled: boolean) => {
    if (window.flam3 && window.flam3.toggleAnimations) {
      const actualState = window.flam3.toggleAnimations(enabled);
      setAnimationsEnabled(actualState);
    }
  };

  // Function to update available transforms
  const updateAvailableTransforms = () => {
    if (window.flam3 && window.flam3.fractal) {
      const transforms = [];
      for (let i = 0; i < window.flam3.fractal.length; i++) {
        transforms.push({
          id: i,
          name: `XForm ${i + 1} (${window.flam3.fractal[i].variation})`
        });
      }
      setAvailableTransforms(transforms);
    }
  };

  // Check animation state periodically to keep UI in sync
  useEffect(() => {
    if (!isLoading && window.flam3 && window.flam3.hasActiveAnimations) {
      const interval = setInterval(() => {
        const hasAnimations = window.flam3.hasActiveAnimations();
        if (hasAnimations !== animationsEnabled) {
          setAnimationsEnabled(hasAnimations);
        }
        // Also update available transforms
        updateAvailableTransforms();
      }, 1000); // Check every second

      return () => clearInterval(interval);
    }
  }, [isLoading, animationsEnabled]);

  // Initialize XForm editors when component loads and fractal is ready
  useEffect(() => {
    if (!isLoading && window.flam3) {
      // Always refresh XForm editors when component loads to ensure they appear
      setTimeout(() => {
        if (window.refreshXFormEditorsList) {
          window.refreshXFormEditorsList();
        }
      }, 200);
    }
  }, [isLoading]);

  // Refresh XForm editors when available transforms change
  useEffect(() => {
    if (!isLoading && availableTransforms.length > 0) {
      // Only refresh if the DOM container exists but has no editors
      const xformContainer = document.getElementById('xforms');
      if (xformContainer && xformContainer.children.length === 0) {
        setTimeout(() => {
          if (window.refreshXFormEditorsList) {
            window.refreshXFormEditorsList();
          }
        }, 100);
      }
    }
  }, [isLoading, availableTransforms.length]);

  const handleExportPNG = () => {
    if (window.flam3 && window.flam3.exportPNG) {
      window.flam3.exportPNG();
    }
  };

  const handleExportGIF = async (settings: { duration: number; quality: number; fps: number; size: number }) => {
    if (window.flam3 && window.flam3.exportGIF) {
      setIsExportingGif(true);
      setGifExportProgress({ current: 0, total: 0, status: 'Starting...' });
      
      try {
        await window.flam3.exportGIF((current: number, total: number, status?: string) => {
          setGifExportProgress({
            current,
            total,
            status: status || `Frame ${current} of ${total}`
          });
        }, settings);
      } catch (error) {
        console.error('GIF export failed:', error);
      } finally {
        setIsExportingGif(false);
        setGifExportProgress({ current: 0, total: 0, status: '' });
      }
    }
  };

  const handleShowGifExportDialog = () => {
    setShowGifExportDialog(true);
  };

  const getCurrentFractalData = () => {
    if (!window.flam3) {
      throw new Error('Fractal engine not initialized');
    }

    const { config, fractal } = window.flam3;

    // Get transforms data
    const transforms: ExtendedFractalTransform[] = [];
    for (let i = 0; i < fractal.length; i++) {
      const xform = fractal[i] as WebGPUXForm;
      transforms.push({
        variation: xform.variation,
        animateX: xform.animateX,
        animateY: xform.animateY,
        color: xform.color,
        a: xform.a,
        b: xform.b,
        c: xform.c,
        d: xform.d,
        e: xform.e,
        f: xform.f,
      });
    }

    const serializableConfig: FractalConfig = {
      x: config.x,
      y: config.y,
      animationSpeed: config.animationSpeed,
      zoom: config.zoom,
      rotation: config.rotation,
      mirrorX: config.mirrorX,
      mirrorY: config.mirrorY,
      gamma: config.gamma,
      hueShift: config.hueShift,
      satShift: config.satShift,
      lightShift: config.lightShift,
      final: config.final,
      cfinal: config.cfinal,
      numPoints: config.numPoints,
      seed: config.seed,
    };

    // Get the actual current colormap from the engine
    const currentColormap = getCurrentColormap();
    
    console.log('Saving fractal with colormap:', currentColormap, 'React state was:', selectedCmap);

    return {
      config: serializableConfig,
      transforms,
      colormap: currentColormap,
      width,
      height,
    };
  };

  // Function to get the current colormap from the engine
  const getCurrentColormap = () => {
    // First try to get from the engine if it supports currentColormap
    if (window.flam3 && window.flam3.currentColormap) {
      return window.flam3.currentColormap;
    }
    
    // Try to get the current colormap from the DOM
    const cmapSelect = document.querySelector('#flam3-cmap') as HTMLSelectElement;
    if (cmapSelect && cmapSelect.value) {
      return cmapSelect.value;
    }
    
    // Fallback: use the React state
    return selectedCmap;
  };

  const handleSaveToGallery = () => {
    setShowSaveDialog(true);
  };

  const handleCmapChange = (value: string) => {
    setSelectedCmap(value);
    if (window.flam3) {
      window.flam3.cmap = value;
    }
  };

  const handleAnimationSpeedChange = (value: number[]) => {
    const speed = value[0];
    setAnimationSpeed(speed);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.animationSpeed = speed;
      window.flam3.clear();
      window.flam3.updateParams();
    }
  };

  const handleZoomLevelChange = (value: number[]) => {
    const zoom = value[0];
    setZoomLevel(zoom);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.zoom = zoom;
      window.flam3.clear();
      window.flam3.updateParams();
    }
  };

  // Advanced control handlers
  const handleRotationChange = (value: number[]) => {
    const rot = value[0];
    setRotation(rot);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.rotation = rot;
      window.flam3.updateParams();
    }
  };

  const handleMirrorXChange = (pressed: boolean) => {
    setMirrorX(pressed);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.mirrorX = pressed;
      window.flam3.updateParams();
    }
  };

  const handleMirrorYChange = (pressed: boolean) => {
    setMirrorY(pressed);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.mirrorY = pressed;
      window.flam3.updateParams();
    }
  };

  const handleGammaChange = (value: number[]) => {
    const g = value[0];
    setGamma(g);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.gamma = g;
      window.flam3.updateParams();
    }
  };

  const handleHueShiftChange = (value: number[]) => {
    const h = value[0];
    setHueShift(h);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.hueShift = h;
      window.flam3.updateParams();
    }
  };

  const handleSatShiftChange = (value: number[]) => {
    const s = value[0];
    setSatShift(s);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.satShift = s;
      window.flam3.updateParams();
    }
  };

  const handleLightShiftChange = (value: number[]) => {
    const l = value[0];
    setLightShift(l);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.lightShift = l;
      window.flam3.updateParams();
    }
  };

  const handleFinalXformChange = (value: string) => {
    const final = parseInt(value, 10);
    setFinalXform(final);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.final = final;
      window.flam3.updateParams();
    }
  };

  const handleCfinalXformChange = (value: string) => {
    const cfinal = parseInt(value, 10);
    setCfinalXform(cfinal);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.cfinal = cfinal;
      window.flam3.updateParams();
    }
  };

  const handleNumPointsChange = (value: number[]) => {
    const points = value[0];
    setNumPoints(points);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.numPoints = points;
      window.flam3.updateParams();
    }
  };

  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="fractal-viewer-container">
      <Card className="fractal-canvas-card">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 animate-pulse" />
              <p className="text-lg">Loading WebGPU Fractal Engine...</p>
            </div>
          </div>
        )}
        
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height}
          className="fractal-canvas"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </Card>

      {!isLoading && (
        <div className="fractal-controls-panel">
                      <Tabs 
            defaultValue="controls" 
            className="w-full h-full"
            onValueChange={(value) => {
              // When transforms tab is selected, ensure XForm editors are initialized
              if (value === 'transforms') {
                setTimeout(() => {
                  const xformContainer = document.getElementById('xforms');
                  if (xformContainer && xformContainer.children.length === 0 && window.refreshXFormEditorsList) {
                    window.refreshXFormEditorsList();
                  }
                }, 50);
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="visual">Visual</TabsTrigger>
                <TabsTrigger value="transforms">Transforms</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="controls" className="space-y-4">
                <Card>
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowHowTo(!showHowTo)}
                  >
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4" />
                        How to Use
                      </div>
                      {showHowTo ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {showHowTo && (
                    <CardContent className="space-y-3">
                      <div className="text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Click and drag on the canvas to pan</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Zoom using scroll wheel</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>To modify the fractal: Turn on Transform Overlay. Drag the large ring to modify position. Drag smaller rings to adjust vectors.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Share it with the world by adding it to the Gallery or exporting as PNG or GIF.</span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Playback Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      <Toggle 
                        pressed={isRunning} 
                        onPressedChange={(pressed) => pressed ? handleStart() : handleStop()}
                        className="gap-2"
                      >
                        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isRunning ? 'Pause' : 'Play'}
                      </Toggle>
                      <Button onClick={handleStep} variant="outline" size="sm">
                        <SkipForward className="w-4 h-4 mr-2" />
                        Step
                      </Button>
                      <Button onClick={handleClear} variant="outline" size="sm">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Animation Speed</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[animationSpeed]}
                          onValueChange={handleAnimationSpeedChange}
                          min={0.25}
                          max={2}
                          step={0.25}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{animationSpeed * 100}%</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Button onClick={handleRandomize} className="flex-1">
                        <Shuffle className="w-4 h-4 mr-2" />
                        Randomize
                      </Button>
                    </div>
                    <Toggle 
                      pressed={animationsEnabled} 
                      onPressedChange={handleToggleAnimations}
                      className={`w-full justify-start gap-2 ${
                        animationsEnabled 
                          ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300 data-[state=on]:bg-green-500 data-[state=on]:text-white' 
                          : 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      {animationsEnabled ? 'Animations Enabled' : 'Animations Disabled'}
                    </Toggle>
                    <Toggle 
                      pressed={guiEnabled} 
                      onPressedChange={handleToggleGui}
                      className={`w-full justify-start gap-2 ${
                        guiEnabled 
                          ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300 data-[state=on]:bg-green-500 data-[state=on]:text-white' 
                          : 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
                      }`}
                    >
                      {guiEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      {guiEnabled ? 'Transform Overlay Enabled' : 'Transform Overlay Disabled'}
                    </Toggle>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button onClick={handleSaveToGallery} className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Add to Gallery
                    </Button>
                    <Button onClick={handleExportPNG} className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Export as PNG
                    </Button>
                    <Button 
                      onClick={handleShowGifExportDialog} 
                      className="w-full" 
                      disabled={isExportingGif}
                    >
                      <Film className="w-4 h-4 mr-2" />
                      Export Animated GIF
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="visual" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Color Palette
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedCmap} onValueChange={handleCmapChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a color palette" />
                      </SelectTrigger>
                      <SelectContent>
                        {cmapOptions.map(name => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ZoomIn className="w-4 h-4" />
                      View Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Zoom Level</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[zoomLevel]}
                          onValueChange={handleZoomLevelChange}
                          min={0.3}
                          max={3}
                          step={0.1}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{Math.round(zoomLevel * 100)}%</Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-sm">Gamma Correction</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[gamma]}
                          onValueChange={handleGammaChange}
                          min={0.1}
                          max={5}
                          step={0.1}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{gamma.toFixed(1)}</Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-sm">Number of Points</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[numPoints]}
                          onValueChange={handleNumPointsChange}
                          min={5000}
                          max={30000}
                          step={5000}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{Math.round(numPoints / 1000)}K</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Color Adjustments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Hue Shift</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[hueShift]}
                          onValueChange={handleHueShiftChange}
                          min={-1}
                          max={1}
                          step={0.01}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{hueShift.toFixed(2)}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Saturation</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[satShift]}
                          onValueChange={handleSatShiftChange}
                          min={-1}
                          max={1}
                          step={0.01}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{satShift.toFixed(2)}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Lightness</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[lightShift]}
                          onValueChange={handleLightShiftChange}
                          min={-1}
                          max={1}
                          step={0.01}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{lightShift.toFixed(2)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="transforms" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Transforms
                    </CardTitle>
                    <Button 
                      id="add-xform" 
                      size="sm" 
                      variant="outline"
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Transform
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div 
                      id="xforms" 
                      className="space-y-4"
                    >
                      {/* XForm editors will be inserted here */}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Transform Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Rotation Symmetry</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[rotation]}
                          onValueChange={handleRotationChange}
                          min={1}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <Badge variant="secondary">{rotation}</Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-sm">Mirror Settings</Label>
                      <div className="flex gap-2">
                        <Toggle 
                          pressed={mirrorX} 
                          onPressedChange={handleMirrorXChange}
                          className="flex-1"
                        >
                          Mirror X
                        </Toggle>
                        <Toggle 
                          pressed={mirrorY} 
                          onPressedChange={handleMirrorYChange}
                          className="flex-1"
                        >
                          Mirror Y
                        </Toggle>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transform Chain</CardTitle>
                    <CardDescription>
                      Final and color final transform settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="final-xform">Final Transform</Label>
                      <Select value={finalXform.toString()} onValueChange={handleFinalXformChange}>
                        <SelectTrigger id="final-xform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">None</SelectItem>
                          {availableTransforms.map(transform => (
                            <SelectItem key={transform.id} value={transform.id.toString()}>
                              {transform.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cfinal-xform">Color Final</Label>
                      <Select value={cfinalXform.toString()} onValueChange={handleCfinalXformChange}>
                        <SelectTrigger id="cfinal-xform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">None</SelectItem>
                          {availableTransforms.map(transform => (
                            <SelectItem key={transform.id} value={transform.id.toString()}>
                              {transform.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        <SaveFractalDialog
          isOpen={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          getCurrentFractalData={getCurrentFractalData}
          canvas={canvasRef.current || undefined}
          onSuccess={() => {
            console.log('Fractal saved successfully!');
          }}
        />
        
        <GifExportDialog
          isOpen={showGifExportDialog}
          onClose={() => setShowGifExportDialog(false)}
          onExport={handleExportGIF}
          isExporting={isExportingGif}
          exportProgress={gifExportProgress}
        />
    </div>
  );
};

export default FractalViewer;