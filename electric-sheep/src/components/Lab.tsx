import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  TestTubes,
  Dna,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useFractalGallery, useFractalStorage, type FractalRecord } from '@/hooks/useFractalStorage';
import { useSEO, pageSEO } from '../hooks/useSEO';
import FractalRenderer from './FractalRenderer';
import type { FractalConfig, ExtendedFractalTransform } from '@/types/fractal';

// Particle animation component
interface ParticleAnimationProps {
  parent1ImageUrl: string;
  parent2ImageUrl: string;
  isAnimating: boolean;
  onAnimationComplete: () => void;
}

const ParticleAnimation: React.FC<ParticleAnimationProps> = ({
  parent1ImageUrl,
  parent2ImageUrl,
  isAnimating,
  onAnimationComplete
}) => {
  useEffect(() => {
    if (!isAnimating) return;

    const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Particle {
      x: number;
      y: number;
      originX: number;
      originY: number;
      targetX: number;
      targetY: number;
      size: number;
      color: string;
      velocity: { x: number; y: number };
      life: number;
      delay: number;
      opacity: number;
      angle: number;
      orbitRadius: number;
      orbitSpeed: number;

      constructor(x: number, y: number, targetX: number, targetY: number, color: string) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.size = Math.random() * 3 + 1;
        this.color = color;
        this.velocity = { x: 0, y: 0 };
        this.life = 1;
        this.delay = Math.random() * 0.3;
        this.opacity = 1;
        this.angle = Math.random() * Math.PI * 2;
        this.orbitRadius = 0;
        this.orbitSpeed = (Math.random() - 0.5) * 0.1 + 0.05; // Random spin direction
      }

      update(progress: number) {
        if (progress < this.delay) return;

        const adjustedProgress = (progress - this.delay) / (1 - this.delay);
        
        // Easing function for smooth motion
        const easeInOutQuart = (t: number) => {
          return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
        };

        const easedProgress = easeInOutQuart(Math.min(adjustedProgress * 1.2, 1));

        // Phase 1: Move towards center (0 to 0.6)
        // Phase 2: Swirl in center (0.6 to 1.0)
        const movePhase = Math.min(easedProgress / 0.6, 1);
        const swirlPhase = Math.max((easedProgress - 0.6) / 0.4, 0);

        if (movePhase < 1) {
          // Moving towards center
          const dx = this.targetX - this.originX;
          const dy = this.targetY - this.originY;
          
          this.x = this.originX + dx * movePhase;
          this.y = this.originY + dy * movePhase;
          
          // Start expanding orbit radius as we approach center
          this.orbitRadius = movePhase * 30 * (1 - movePhase);
        } else {
          // Swirling in center
          this.angle += this.orbitSpeed;
          this.orbitRadius = 50 * (1 - swirlPhase) * Math.sin(swirlPhase * Math.PI);
          
          this.x = this.targetX + Math.cos(this.angle) * this.orbitRadius;
          this.y = this.targetY + Math.sin(this.angle) * this.orbitRadius;
          
          // Fade out during swirl
          this.opacity = 1 - swirlPhase;
        }
        
        // Size changes
        if (easedProgress > 0.5) {
          this.size *= 0.98;
        } else {
          // Grow slightly as approaching center
          this.size = Math.min(this.size * 1.01, 5);
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const particles: Particle[] = [];
    let animationProgress = 0;
    let animationId: number;

    // Load images and create particles
    Promise.all([
      loadImage(parent1ImageUrl),
      loadImage(parent2ImageUrl)
    ]).then(([img1, img2]) => {
      // Get positions of parent slots
      const parent1Element = document.querySelector('[data-parent="1"]');
      const parent2Element = document.querySelector('[data-parent="2"]');
      
      if (!parent1Element || !parent2Element) return;

      const rect1 = parent1Element.getBoundingClientRect();
      const rect2 = parent2Element.getBoundingClientRect();

      // Calculate center point between the two parents
      const centerX = (rect1.left + rect1.width / 2 + rect2.left + rect2.width / 2) / 2;
      const centerY = (rect1.top + rect1.height / 2 + rect2.top + rect2.height / 2) / 2;

      // Create temporary canvases to sample colors
      const tempCanvas1 = document.createElement('canvas');
      const tempCtx1 = tempCanvas1.getContext('2d', { willReadFrequently: true });
      const tempCanvas2 = document.createElement('canvas');
      const tempCtx2 = tempCanvas2.getContext('2d', { willReadFrequently: true });

      if (!tempCtx1 || !tempCtx2) return;

      // Set reasonable sampling size
      const sampleSize = 100;
      tempCanvas1.width = tempCanvas2.width = sampleSize;
      tempCanvas1.height = tempCanvas2.height = sampleSize;

      tempCtx1.drawImage(img1, 0, 0, sampleSize, sampleSize);
      tempCtx2.drawImage(img2, 0, 0, sampleSize, sampleSize);

      const imageData1 = tempCtx1.getImageData(0, 0, sampleSize, sampleSize);
      const imageData2 = tempCtx2.getImageData(0, 0, sampleSize, sampleSize);

      // Create particles from parent 1 going to center
      const particleCount = 1600; // Increased from 800
      for (let i = 0; i < particleCount / 2; i++) {
        const x = Math.floor(Math.random() * sampleSize);
        const y = Math.floor(Math.random() * sampleSize);
        const pixelIndex = (y * sampleSize + x) * 4;
        
        const r = imageData1.data[pixelIndex];
        const g = imageData1.data[pixelIndex + 1];
        const b = imageData1.data[pixelIndex + 2];
        const a = imageData1.data[pixelIndex + 3];

        if (a > 0) {
          const color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          
          // Map to actual screen coordinates
          const startX = rect1.left + (x / sampleSize) * rect1.width;
          const startY = rect1.top + (y / sampleSize) * rect1.height;

          particles.push(new Particle(startX, startY, centerX, centerY, color));
        }
      }

      // Create particles from parent 2 going to center
      for (let i = 0; i < particleCount / 2; i++) {
        const x = Math.floor(Math.random() * sampleSize);
        const y = Math.floor(Math.random() * sampleSize);
        const pixelIndex = (y * sampleSize + x) * 4;
        
        const r = imageData2.data[pixelIndex];
        const g = imageData2.data[pixelIndex + 1];
        const b = imageData2.data[pixelIndex + 2];
        const a = imageData2.data[pixelIndex + 3];

        if (a > 0) {
          const color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          
          // Map to actual screen coordinates
          const startX = rect2.left + (x / sampleSize) * rect2.width;
          const startY = rect2.top + (y / sampleSize) * rect2.height;

          particles.push(new Particle(startX, startY, centerX, centerY, color));
        }
      }

      // Animation loop
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw particles
        particles.forEach(particle => {
          particle.update(animationProgress);
          particle.draw(ctx);
        });

        animationProgress += 0.004; // Slower animation - reduced from 0.008

        if (animationProgress < 1.2) {
          animationId = requestAnimationFrame(animate);
        } else {
          // Animation complete
          onAnimationComplete();
        }
      };

      animate();
    });

    function loadImage(url: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isAnimating, parent1ImageUrl, parent2ImageUrl, onAnimationComplete]);

  if (!isAnimating) return null;

  return (
    <canvas
      id="particle-canvas"
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ background: 'transparent' }}
    />
  );
};

// Genetic algorithm parameters
interface EvolutionParams {
  mutationRate: number;
  crossoverType: 'blend' | 'alternate' | 'weighted';
  transformMixRatio: number;
  colorBlendAmount: number;
  addNewTransform: boolean;
  removeTransform: boolean;
}

const Lab: React.FC = () => {
  // SEO
  useSEO({
    ...pageSEO.gallery,
    title: 'Fractal Evolution Lab | FractalMachine.xyz',
    description: 'Experiment with fractal genetics. Combine two fractals to create unique offspring with inherited traits and mutations.'
  });

  const { fetchFractals } = useFractalGallery();
  const { saveFractal, isSaving } = useFractalStorage();
  const [availableFractals, setAvailableFractals] = useState<FractalRecord[]>([]);
  const [parent1, setParent1] = useState<FractalRecord | null>(null);
  const [parent2, setParent2] = useState<FractalRecord | null>(null);
  const [offspring, setOffspring] = useState<Partial<FractalRecord> | null>(null);
  const [isEvolving, setIsEvolving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showParentSelector, setShowParentSelector] = useState<1 | 2 | null>(null);
  const [showParameters, setShowParameters] = useState(false);
  const [showParticleAnimation, setShowParticleAnimation] = useState(false);
  
  const [evolutionParams, setEvolutionParams] = useState<EvolutionParams>({
    mutationRate: 0.15,
    crossoverType: 'blend',
    transformMixRatio: 0.5,
    colorBlendAmount: 0.7,
    addNewTransform: false,
    removeTransform: false
  });

  // Load fractals for selection
  useEffect(() => {
    loadFractals();
  }, []);

  const loadFractals = async () => {
    const fractals = await fetchFractals(0, 50); // Load more for better selection
    setAvailableFractals(fractals);
  };

  // Genetic algorithm implementation with animation
  const evolveFractal = async () => {
    if (!parent1 || !parent2) return;
    
    setIsEvolving(true);
    setIsAnimating(true);
    setShowParticleAnimation(true);
  };

  const handleAnimationComplete = () => {
    if (!parent1 || !parent2) return;
    
    // Determine the higher generation
    const maxGeneration = Math.max(parent1.generation || 0, parent2.generation || 0);
    
    // Create evolved config
    const evolvedConfig = evolveConfig(parent1.config, parent2.config);
    
    // Create evolved transforms
    const evolvedTransforms = evolveTransforms(
      parent1.transforms,
      parent2.transforms
    );
    
    // Create evolved colormap - sometimes blend, sometimes pick one
    const evolvedColormap = Math.random() < 0.5 ? parent1.colormap : parent2.colormap;
    
    // Create offspring
    const newOffspring: Partial<FractalRecord> = {
      title: `${parent1.title} × ${parent2.title}`,
      description: `Generation ${maxGeneration + 1} offspring. Parents: ${parent1.title} and ${parent2.title}`,
      config: evolvedConfig,
      transforms: evolvedTransforms,
      colormap: evolvedColormap,
      width: Math.max(parent1.width, parent2.width),
      height: Math.max(parent1.height, parent2.height),
      generation: maxGeneration + 1,
      parents: [parent1.id, parent2.id]
    };
    
    setOffspring(newOffspring);
    setIsAnimating(false);
    setIsEvolving(false);
    setShowParticleAnimation(false);
    
    // Scroll to the bottom to show the evolved fractal
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const evolveConfig = (config1: FractalConfig, config2: FractalConfig): FractalConfig => {
    const blend = (a: number, b: number, ratio: number = evolutionParams.transformMixRatio) => {
      const value = a * ratio + b * (1 - ratio);
      // Apply mutation
      if (Math.random() < evolutionParams.mutationRate) {
        const mutation = (Math.random() - 0.5) * 0.4; // ±20% mutation
        return value * (1 + mutation);
      }
      return value;
    };
    
    return {
      x: blend(config1.x || 0, config2.x || 0),
      y: blend(config1.y || 0, config2.y || 0),
      animationSpeed: blend(config1.animationSpeed, config2.animationSpeed),
      zoom: blend(config1.zoom, config2.zoom),
      rotation: blend(config1.rotation, config2.rotation),
      mirrorX: Math.random() < evolutionParams.transformMixRatio ? config1.mirrorX : config2.mirrorX,
      mirrorY: Math.random() < evolutionParams.transformMixRatio ? config1.mirrorY : config2.mirrorY,
      gamma: blend(config1.gamma, config2.gamma),
      hueShift: blend(config1.hueShift, config2.hueShift),
      satShift: blend(config1.satShift, config2.satShift),
      lightShift: blend(config1.lightShift, config2.lightShift),
      final: Math.random() < 0.5 ? config1.final : config2.final,
      cfinal: Math.random() < 0.5 ? config1.cfinal : config2.cfinal,
      numPoints: Math.round(blend(config1.numPoints, config2.numPoints)),
      seed: Math.floor(Math.random() * 1000000) // New random seed
    };
  };

  const evolveTransforms = (
    transforms1: ExtendedFractalTransform[],
    transforms2: ExtendedFractalTransform[]
  ): ExtendedFractalTransform[] => {
    const evolved: ExtendedFractalTransform[] = [];
    
    switch (evolutionParams.crossoverType) {
      case 'blend': {
        // Blend corresponding transforms
        const maxLength = Math.max(transforms1.length, transforms2.length);
        for (let i = 0; i < maxLength; i++) {
          const t1 = transforms1[i];
          const t2 = transforms2[i];
          
          if (t1 && t2) {
            // Both exist, blend them
            evolved.push(blendTransforms(t1, t2));
          } else if (t1 || t2) {
            // Only one exists, maybe include it
            if (Math.random() < 0.7) {
              evolved.push(mutateTransform(t1 || t2));
            }
          }
        }
        break;
      }
        
      case 'alternate': {
        // Alternate between parents
        const totalLength = Math.max(transforms1.length, transforms2.length);
        for (let i = 0; i < totalLength; i++) {
          const useFirst = i % 2 === 0;
          const transform = useFirst ? transforms1[i] : transforms2[i];
          if (transform) {
            evolved.push(mutateTransform(transform));
          }
        }
        break;
      }
        
      case 'weighted': {
        // Weighted selection based on position
        const avgLength = Math.floor((transforms1.length + transforms2.length) / 2);
        for (let i = 0; i < avgLength; i++) {
          const weight = i / avgLength; // 0 to 1
          const useFirst = Math.random() < (1 - weight); // Favor first parent early, second parent later
          const t1 = transforms1[i];
          const t2 = transforms2[i];
          
          if (useFirst && t1) {
            evolved.push(mutateTransform(t1));
          } else if (!useFirst && t2) {
            evolved.push(mutateTransform(t2));
          } else if (t1 || t2) {
            evolved.push(mutateTransform(t1 || t2));
          }
        }
        break;
      }
    }
    
    // Maybe add a new random transform
    if (evolutionParams.addNewTransform && Math.random() < evolutionParams.mutationRate) {
      evolved.push(createRandomTransform());
    }
    
    // Maybe remove a transform
    if (evolutionParams.removeTransform && evolved.length > 1 && Math.random() < evolutionParams.mutationRate) {
      const removeIndex = Math.floor(Math.random() * evolved.length);
      evolved.splice(removeIndex, 1);
    }
    
    return evolved;
  };

  const blendTransforms = (t1: ExtendedFractalTransform, t2: ExtendedFractalTransform): ExtendedFractalTransform => {
    const blend = (a: number, b: number) => {
      const ratio = evolutionParams.transformMixRatio;
      return a * ratio + b * (1 - ratio);
    };
    
    return {
      variation: Math.random() < 0.5 ? t1.variation : t2.variation,
      animateX: Math.random() < 0.5 ? t1.animateX : t2.animateX,
      animateY: Math.random() < 0.5 ? t1.animateY : t2.animateY,
      color: blend(t1.color || 0, t2.color || 0),
      a: blend(t1.a, t2.a),
      b: blend(t1.b, t2.b),
      c: blend(t1.c, t2.c),
      d: blend(t1.d, t2.d),
      e: blend(t1.e, t2.e),
      f: blend(t1.f, t2.f)
    };
  };

  const mutateTransform = (transform: ExtendedFractalTransform): ExtendedFractalTransform => {
    const mutate = (value: number) => {
      if (Math.random() < evolutionParams.mutationRate) {
        const mutation = (Math.random() - 0.5) * 0.4;
        return value * (1 + mutation);
      }
      return value;
    };
    
    return {
      ...transform,
      a: mutate(transform.a),
      b: mutate(transform.b),
      c: mutate(transform.c),
      d: mutate(transform.d),
      e: mutate(transform.e),
      f: mutate(transform.f),
      color: Math.random() < evolutionParams.mutationRate 
        ? Math.random() 
        : (transform.color || 0)
    };
  };

  const createRandomTransform = (): ExtendedFractalTransform => {
    const variations = ['Linear', 'Sinusoidal', 'Spherical', 'Swirl', 'Horseshoe', 'Polar', 'Disc', 'Spiral'];
    
    return {
      variation: variations[Math.floor(Math.random() * variations.length)],
      animateX: Math.random() < 0.3,
      animateY: Math.random() < 0.3,
      color: Math.random(),
      a: Math.random() * 2 - 1,
      b: Math.random() * 2 - 1,
      c: Math.random() * 2 - 1,
      d: Math.random() * 2 - 1,
      e: Math.random() * 2 - 1,
      f: Math.random() * 2 - 1
    };
  };

  const selectParent = (fractal: FractalRecord, parentNum: 1 | 2) => {
    if (parentNum === 1) {
      setParent1(fractal);
    } else {
      setParent2(fractal);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Particle Animation */}
      {parent1 && parent2 && parent1.thumbnail_url && parent2.thumbnail_url && (
        <ParticleAnimation
          parent1ImageUrl={parent1.thumbnail_url}
          parent2ImageUrl={parent2.thumbnail_url}
          isAnimating={showParticleAnimation}
          onAnimationComplete={handleAnimationComplete}
        />
      )}

      <div className="space-y-8">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3">
              <TestTubes className="w-8 h-8" />
              Fractal Evolution Lab
            </CardTitle>
            <CardDescription>
              Combine two fractals to create unique offspring. Experiment with genetic algorithms 
              to evolve new fractal patterns through crossover and mutation.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Parent Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dna className="w-5 h-5" />
              Select Parent Fractals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Parent Slots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              {/* Parent 1 Slot */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center">Parent 1</h3>
                <div 
                  data-parent="1"
                  className="relative"
                >
                  {parent1 ? (
                    <Card className={isAnimating ? 'opacity-50 transition-opacity duration-500' : ''}>
                      <CardContent className="p-4">
                        <div className="relative aspect-square bg-muted rounded-lg mb-3 overflow-hidden max-w-[400px] max-h-[400px] mx-auto">
                          {parent1.thumbnail_url && (
                            <img
                              src={parent1.thumbnail_url}
                              alt={parent1.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Text overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-3">
                            <h4 className="text-white font-semibold text-sm truncate mb-1">{parent1.title}</h4>
                            <p className="text-white/80 text-xs">
                              Gen {parent1.generation || 0} • {parent1.transforms.length} transforms
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setParent1(null)}
                        >
                          Change
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card 
                      className="border-dashed border-2 border-muted-foreground/30 bg-muted/20 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                      onClick={() => setShowParentSelector(1)}
                    >
                      <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Click to select Parent 1</p>
                        <p className="text-xs text-muted-foreground mt-1">Choose a fractal to evolve</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Parent 2 Slot */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center">Parent 2</h3>
                <div 
                  data-parent="2"
                  className="relative"
                >
                  {parent2 ? (
                    <Card className={isAnimating ? 'opacity-50 transition-opacity duration-500' : ''}>
                      <CardContent className="p-4">
                        <div className="relative aspect-square bg-muted rounded-lg mb-3 overflow-hidden max-w-[400px] max-h-[400px] mx-auto">
                          {parent2.thumbnail_url && (
                            <img
                              src={parent2.thumbnail_url}
                              alt={parent2.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Text overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-3">
                            <h4 className="text-white font-semibold text-sm truncate mb-1">{parent2.title}</h4>
                            <p className="text-white/80 text-xs">
                              Gen {parent2.generation || 0} • {parent2.transforms.length} transforms
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setParent2(null)}
                        >
                          Change
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card 
                      className="border-dashed border-2 border-muted-foreground/30 bg-muted/20 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                      onClick={() => setShowParentSelector(2)}
                    >
                      <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Click to select Parent 2</p>
                        <p className="text-xs text-muted-foreground mt-1">Choose a fractal to evolve</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>

              {/* Fractal Selection Modal */}
              {showParentSelector && (
                <Card className="mb-6 border-2 border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Select Parent {showParentSelector}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowParentSelector(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-80 overflow-y-auto">
                      {availableFractals
                        .filter(fractal => {
                          // Filter out the other parent
                          if (showParentSelector === 1) return fractal.id !== parent2?.id;
                          return fractal.id !== parent1?.id;
                        })
                        .map((fractal) => (
                        <Card
                          key={fractal.id}
                          className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
                          onClick={() => {
                            selectParent(fractal, showParentSelector);
                            setShowParentSelector(null);
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="aspect-square bg-muted rounded mb-2 overflow-hidden max-w-[400px] max-h-[400px] mx-auto">
                              {fractal.thumbnail_url && (
                                <img
                                  src={fractal.thumbnail_url}
                                  alt={fractal.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <p className="text-sm font-medium truncate">{fractal.title}</p>
                            <p className="text-xs text-muted-foreground">Gen {fractal.generation || 0}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

        {/* Evolution Controls */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowParameters(!showParameters)}
          >
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Evolution Parameters
              </div>
              {showParameters ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </CardTitle>
          </CardHeader>
          
          {showParameters && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mutation Rate: {(evolutionParams.mutationRate * 100).toFixed(0)}%</Label>
                <Slider
                  value={[evolutionParams.mutationRate]}
                  onValueChange={([value]) => setEvolutionParams(prev => ({ ...prev, mutationRate: value }))}
                  min={0}
                  max={0.5}
                  step={0.05}
                />
              </div>

              <div className="space-y-2">
                <Label>Crossover Type</Label>
                <div className="grid grid-cols-1 gap-2">
                  {(['blend', 'alternate', 'weighted'] as const).map((type) => (
                    <Button
                      key={type}
                      variant={evolutionParams.crossoverType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEvolutionParams(prev => ({ ...prev, crossoverType: type }))}
                      className="justify-start"
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transform Mix Ratio: {(evolutionParams.transformMixRatio * 100).toFixed(0)}%</Label>
                <Slider
                  value={[evolutionParams.transformMixRatio]}
                  onValueChange={([value]) => setEvolutionParams(prev => ({ ...prev, transformMixRatio: value }))}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            </CardContent>
          )}
          
          {/* Evolve Button - Always Visible */}
          <CardContent className="pt-0">
            <Button
              className="w-full"
              onClick={evolveFractal}
              disabled={!parent1 || !parent2 || isEvolving}
            >
              {isEvolving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evolving...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Evolve Fractal
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Evolution Result */}
        {offspring && (
          <Card>
            <CardHeader>
              <CardTitle>Evolution Result</CardTitle>
              <CardDescription>
                Generation {offspring.generation} offspring ready for viewing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Fractal Preview */}
                {offspring.config && offspring.transforms && (
                  <div data-offspring-fractal>
                    <FractalRenderer
                      fractalData={{
                        id: 'temp-offspring',
                        title: offspring.title || 'Evolved Fractal',
                        description: offspring.description,
                        config: offspring.config,
                        transforms: offspring.transforms,
                        colormap: offspring.colormap || 'gnuplot',
                        width: offspring.width || 600,
                        height: offspring.height || 600,
                        view_count: 0,
                        created_at: new Date().toISOString(),
                        generation: offspring.generation,
                        parents: offspring.parents
                      } as FractalRecord}
                      width={400}
                      height={400}
                      className="mx-auto"
                    />
                  </div>
                )}

                <div className="text-center space-y-4">
                  <h4 className="text-xl font-semibold">{offspring.title}</h4>
                  <p className="text-muted-foreground">{offspring.description}</p>
                  
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="secondary">
                      {offspring.transforms?.length} transforms
                    </Badge>
                    <Badge variant="secondary">
                      {offspring.colormap}
                    </Badge>
                    <Badge variant="outline">
                      Generation {offspring.generation}
                    </Badge>
                  </div>

                  <Button
                    size="lg"
                    onClick={async () => {
                      if (!offspring.config || !offspring.transforms) return;
                      
                      // Try to get the canvas from the offspring fractal renderer
                      const offspringSection = document.querySelector('[data-offspring-fractal]');
                      const canvas = offspringSection?.querySelector('canvas') as HTMLCanvasElement;
                      
                      const result = await saveFractal({
                        title: offspring.title || 'Evolved Fractal',
                        description: offspring.description,
                        config: offspring.config,
                        transforms: offspring.transforms,
                        colormap: offspring.colormap || 'gnuplot',
                                width: offspring.width || 1024,
        height: offspring.height || 1024,
                        generation: offspring.generation,
                        parents: offspring.parents,
                        canvas: canvas || undefined // Pass canvas for thumbnail generation
                      });
                      
                      if (result.success) {
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 3000);
                        // Reload fractals to include the newly saved one
                        loadFractals();
                      }
                    }}
                    disabled={isSaving}
                    className="min-w-[150px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      'Saved!'
                    ) : (
                      'Save to Gallery'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Lab; 