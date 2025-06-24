import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  X,
  Loader2
} from 'lucide-react';
import type { FractalRecord } from '@/hooks/useFractalStorage';

interface FractalRendererProps {
  fractalData: FractalRecord;
  width?: number;
  height?: number;
  onClose?: () => void;
  className?: string;
}

const FractalRenderer: React.FC<FractalRendererProps> = ({ 
  fractalData,
  width = 600, 
  height = 600,
  onClose,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [guiEnabled, setGuiEnabled] = useState(false);
  const flam3InstanceRef = useRef<any>(null);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    // Add the XForm editor template to the document if it doesn't exist
    let template = document.getElementById('xform-editor-template') as HTMLTemplateElement;
    if (!template) {
      template = document.createElement('template');
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
    }
    
    // Define the XForm editor custom element if not already defined
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
        // Load the main.js script if not already loaded
        if (!window.fractalModuleLoaded) {
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
        }

        // Initialize the fractal viewer
        if (canvasRef.current) {
          const initFunction = window.init;
          if (initFunction) {
            const flam3 = await initFunction(canvasRef.current, false); // Start paused
            flam3InstanceRef.current = flam3;
            
            // Apply the fractal data
            await applyFractalData(flam3, fractalData);
            
            // Update UI state to reflect that rendering is now active
            setIsRunning(true);
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
      if (flam3InstanceRef.current) {
        flam3InstanceRef.current.stop();
      }
    };
  }, [fractalData]);

  const applyFractalData = async (flam3: any, data: FractalRecord) => {
    try {
      // Set colormap
      if (data.colormap && window.cmaps) {
        flam3.cmap = data.colormap;
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

      // Start rendering immediately after data is applied
      flam3.start();

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

  const handleStart = () => {
    if (flam3InstanceRef.current) {
      flam3InstanceRef.current.start();
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    if (flam3InstanceRef.current) {
      flam3InstanceRef.current.stop();
      setIsRunning(false);
    }
  };

  const handleStep = () => {
    if (flam3InstanceRef.current) {
      flam3InstanceRef.current.step();
    }
  };

  const handleClear = () => {
    if (flam3InstanceRef.current) {
      flam3InstanceRef.current.clear();
    }
  };

  const handleToggleGui = () => {
    if (flam3InstanceRef.current) {
      flam3InstanceRef.current.gui = !flam3InstanceRef.current.gui;
      setGuiEnabled(!guiEnabled);
    }
  };

  const handleExportPNG = () => {
    if (flam3InstanceRef.current && flam3InstanceRef.current.exportPNG) {
      flam3InstanceRef.current.exportPNG();
    }
  };

  if (error) {
    return (
      <Card className={`max-w-md mx-auto ${className}`}>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          {onClose && (
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{fractalData.title}</CardTitle>
            {fractalData.description && (
              <CardDescription>{fractalData.description}</CardDescription>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{fractalData.colormap}</Badge>
              <span>•</span>
              <span>{fractalData.width}×{fractalData.height}</span>
              <span>•</span>
              <span>{fractalData.view_count} views</span>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center h-64">
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
              className="border rounded-lg mx-auto block"
              style={{ 
                display: isLoading ? 'none' : 'block',
                maxWidth: '100%',
                height: 'auto'
              }}
            />

            {!isLoading && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={isRunning ? "default" : "outline"}
                  size="sm"
                  onClick={isRunning ? handleStop : handleStart}
                >
                  {isRunning ? (
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
                <Button onClick={handleStep} variant="outline" size="sm">
                  <SkipForward className="w-4 h-4 mr-2" />
                  Step
                </Button>
                <Button onClick={handleClear} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button
                  variant={guiEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleGui}
                >
                  {guiEnabled ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Hide Overlay
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Show Overlay
                    </>
                  )}
                </Button>
                <Button onClick={handleExportPNG} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FractalRenderer; 