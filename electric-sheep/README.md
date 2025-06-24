# Electric Sheep GPU

A WebGPU-powered fractal flame generator with a public gallery.

## Features

- Real-time fractal flame generation using WebGPU
- Interactive controls for fractal parameters
- Color palette selection
- Animation support
- Export to PNG and GIF
- Public gallery for sharing creations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your Supabase credentials:
```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

3. Set up your Supabase database with the schema provided in the project documentation.

4. Start the development server:
```bash
npm run dev
```

## Supabase Schema

Create the following table in your Supabase project:

```sql
-- Fractals table - simple storage for fractal configurations
CREATE TABLE public.fractals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Fractal',
  description TEXT,
  
  -- Fractal configuration (from FractalConfig interface)
  config JSONB NOT NULL,
  
  -- Transform data (from Fractal class)
  transforms JSONB NOT NULL,
  
  -- Visual properties
  colormap TEXT NOT NULL DEFAULT 'gnuplot',
  width INTEGER NOT NULL DEFAULT 900,
  height INTEGER NOT NULL DEFAULT 900,
  
  -- Generated image data
  thumbnail_url TEXT,
  full_image_url TEXT,
  gif_url TEXT,
  
  -- Simple metadata
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for gallery browsing
CREATE INDEX idx_fractals_created_at ON public.fractals(created_at DESC);
CREATE INDEX idx_fractals_view_count ON public.fractals(view_count DESC);

-- GIN indexes for searching fractal parameters
CREATE INDEX idx_fractals_config_gin ON public.fractals USING GIN (config);
CREATE INDEX idx_fractals_transforms_gin ON public.fractals USING GIN (transforms);
CREATE INDEX idx_fractals_colormap ON public.fractals(colormap);

-- Disable RLS for public access
ALTER TABLE public.fractals DISABLE ROW LEVEL SECURITY;
```

## Usage

1. **Generate Fractals**: Use the controls panel to adjust parameters and create unique fractal patterns
2. **Save to Gallery**: Click "Add to Gallery" to save your creation to the public database
3. **Export**: Save your fractals as PNG images or animated GIFs

## Technology Stack

- React + TypeScript
- WebGPU for real-time rendering
- Supabase for data storage
- Vite for build tooling
- Tailwind CSS + shadcn/ui for styling
