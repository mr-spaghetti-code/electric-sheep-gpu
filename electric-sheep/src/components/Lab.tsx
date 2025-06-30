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
    
    // Wait for collision animation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
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
                  className={`relative transition-all duration-500 ${
                    isAnimating ? 'transform translate-x-12 scale-110' : ''
                  }`}
                >
                  {parent1 ? (
                    <Card>
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
                  className={`relative transition-all duration-500 ${
                    isAnimating ? 'transform -translate-x-12 scale-110' : ''
                  }`}
                >
                  {parent2 ? (
                    <Card>
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
                        width: offspring.width || 900,
                        height: offspring.height || 900,
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