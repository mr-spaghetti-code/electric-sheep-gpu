export interface FractalConfig {
  x?: number;
  y?: number;
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
  seed: number;
}

export interface FractalTransform {
  variation: string;
  animateX: boolean;
  animateY: boolean;
  color: number;
}

export interface ExtendedFractalTransform extends FractalTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface FractalInstance {
  config: FractalConfig;
  fractal: { 
    length: number; 
    [key: number]: FractalTransform;
    add: (transform: ExtendedFractalTransform) => void;
  };
  exportPNG?: () => void;
  exportGIF?: (progressCallback: (current: number, total: number, status?: string) => void) => Promise<void>;
  randomize: () => void;
  toggleAnimations: (enabled?: boolean) => boolean;
  hasActiveAnimations: () => boolean;
  gui: boolean;
  cmap: string;
  start: () => void;
  stop: () => void;
  step?: () => void;
  clear: () => void;
  updateParams: () => void;
  updateUIControls?: () => void;
}

 