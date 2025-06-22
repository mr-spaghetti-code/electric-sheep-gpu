# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electric Sheep GPU is a WebGPU implementation of Fractal Flame rendering with a React-based interface. The application generates visually striking fractal artwork in real-time using GPU acceleration through the WebGPU API.

## Architecture

The project has evolved from a pure JavaScript implementation to a modern React application:

### Core Components
- **WebGPU Rendering Engine**: `/electric-sheep/public/main.js` - Handles GPU-accelerated fractal computation using WebGPU compute shaders
- **Fractal Mathematics**: `/electric-sheep/public/fractal_functions.js` - Implements weighted variation system with transformations like Linear, Sinusoidal, Spherical, etc.
- **Color System**: `/electric-sheep/public/colourmaps.js` - Pre-defined color palettes for fractal rendering
- **React UI**: `/electric-sheep/src/components/FractalViewer.tsx` - Main component integrating WebGPU with React controls

### Tech Stack
- **Frontend**: React 19.1.0 + TypeScript
- **Build Tool**: Vite 6.3.5
- **UI Components**: Radix UI primitives (shadcn/ui pattern)
- **Styling**: Tailwind CSS v4
- **GPU**: WebGPU API with WGSL shaders

## Development Commands

Navigate to the React app directory first:
```bash
cd electric-sheep
```

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npm run typecheck
```

## Project Structure

```
/electric-sheep/               # React application directory
  /public/                     # Static assets and WebGPU implementation
    main.js                    # Core WebGPU rendering engine
    fractal_functions.js       # Fractal transformation functions
    colourmaps.js             # Color palette definitions
  /src/
    /components/              # React components
      FractalViewer.tsx       # Main fractal viewer component
      ui/                     # Reusable UI components (shadcn/ui)
    main.tsx                  # React app entry point
```

## Key Implementation Details

- The WebGPU implementation uses compute shaders written in WGSL for parallel fractal point calculation
- The "chaos game" algorithm is implemented to generate fractal patterns
- Real-time parameter updates are handled through React state management
- The UI provides controls for transforms, color maps, post-processing effects, and animation
- Browser must support WebGPU (Chrome 113+, Edge 113+, or browsers with WebGPU flags enabled)