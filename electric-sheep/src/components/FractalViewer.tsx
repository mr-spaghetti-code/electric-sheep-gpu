import React, { useEffect, useRef, useState } from 'react';
import './FractalViewer.css';

declare global {
  interface Window {
    flam3: any;
    config: any;
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
  const [animationSpeed, setAnimationSpeed] = useState('1.00');
  const [zoomLevel, setZoomLevel] = useState('0.7');
  const [isRunning, setIsRunning] = useState(true);
  const [guiEnabled, setGuiEnabled] = useState(true);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    // Add the XForm editor template to the document
    const template = document.createElement('template');
    template.id = 'xform-editor-template';
    template.innerHTML = `
      <style>
        .editor-element {
          display: block;
          margin-top: 0.2em;
        }
        .vector {
          vertical-align: middle;
          display: inline-block;
          border-color: black;
          border-style: solid;
          border-width: 0em 0.01em 0em 0.01em;
          border-radius: 0.3em;
        }
        .affine-transform {
          min-width: 200px;
        }
        .vector td {
          text-align: right;
        }
        .remove-button {
          text-align: center;
        }
      </style>
      <label class="editor-element">
        <i>Variation:</i>
        <select name="variation-selector">
        </select>
      </label>
      <label class="editor-element">
        <i>Color:</i>
        <input type="range" name="color" id="price" min="0" max="1" step="0.0001" value="0">
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
          if ((this.constructor as any).observedAttributes.includes(name)) {
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
          const initFunction = (window as any).init;
          if (initFunction) {
            const flam3 = await initFunction(canvasRef.current, true);
            window.flam3 = flam3;
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
    }
  };

  const handleClearAnimations = () => {
    if (window.flam3 && window.flam3.clearAnimations) {
      window.flam3.clearAnimations();
    }
  };

  const handleExportPNG = () => {
    if (window.flam3 && window.flam3.exportPNG) {
      window.flam3.exportPNG();
    }
  };

  const handleCmapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedCmap(value);
    if (window.flam3) {
      window.flam3.cmap = value;
    }
  };

  const handleAnimationSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setAnimationSpeed(value);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.animationSpeed = parseFloat(value);
      window.flam3.clear();
      window.flam3.updateParams();
    }
  };

  const handleZoomLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setZoomLevel(value);
    if (window.flam3 && window.flam3.config) {
      window.flam3.config.zoom = parseFloat(value);
      window.flam3.clear();
      window.flam3.updateParams();
    }
  };

  if (error) {
    return <div className="fractal-error">Error: {error}</div>;
  }

  return (
    <div className="fractal-viewer">
      {isLoading && <div className="fractal-loading">Loading WebGPU...</div>}
      
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="fractal-canvas"
        style={{ display: isLoading ? 'none' : 'block' }}
      />
      
      {!isLoading && (
        <div className="fractal-controls">
          <button onClick={handleStart} disabled={isRunning}>Start</button>
          <button onClick={handleStop} disabled={!isRunning}>Stop</button>
          <button onClick={handleStep}>Step</button>
          <button onClick={handleClear}>Clear</button>
          <button onClick={handleToggleGui}>Toggle GUI</button>
          <button onClick={handleRandomize}>Randomize</button>
          <button onClick={handleClearAnimations}>Clear Animations</button>
          <button onClick={handleExportPNG}>Export PNG</button>
          
          <select value={selectedCmap} onChange={handleCmapChange}>
            {window.cmaps && Object.keys(window.cmaps).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          <select value={animationSpeed} onChange={handleAnimationSpeedChange}>
            <option value="0.25">25% Speed</option>
            <option value="0.50">50% Speed</option>
            <option value="0.75">75% Speed</option>
            <option value="1.00">100% Speed</option>
          </select>
          
          <select value={zoomLevel} onChange={handleZoomLevelChange}>
            <option value="0.3">30% Zoom</option>
            <option value="0.5">50% Zoom</option>
            <option value="0.7">70% Zoom</option>
            <option value="1.0">100% Zoom</option>
            <option value="1.5">150% Zoom</option>
            <option value="2.0">200% Zoom</option>
            <option value="3.0">300% Zoom</option>
          </select>
          
          <div id="renderingbar"></div>
        </div>
      )}
      
      <div id="xforms" className="fractal-xforms">
        <button id="add-xform">Add XForm</button>
      </div>
    </div>
  );
};

export default FractalViewer;