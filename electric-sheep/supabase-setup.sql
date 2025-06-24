-- Complete Supabase setup for Electric Sheep GPU
-- Run this in your Supabase SQL Editor

-- 1. Create the fractals table
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

-- 2. Create indexes for performance
CREATE INDEX idx_fractals_created_at ON public.fractals(created_at DESC);
CREATE INDEX idx_fractals_view_count ON public.fractals(view_count DESC);
CREATE INDEX idx_fractals_config_gin ON public.fractals USING GIN (config);
CREATE INDEX idx_fractals_transforms_gin ON public.fractals USING GIN (transforms);
CREATE INDEX idx_fractals_colormap ON public.fractals(colormap);

-- 3. Disable RLS for public access
ALTER TABLE public.fractals DISABLE ROW LEVEL SECURITY;

-- 4. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES 
  ('fractal-thumbnails', 'fractal-thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/png']), -- 5MB limit
  ('fractal-images', 'fractal-images', true, 52428800, ARRAY['image/jpeg', 'image/png']), -- 50MB limit
  ('fractal-gifs', 'fractal-gifs', true, 104857600, ARRAY['image/gif']); -- 100MB limit

-- 5. Create storage policies for public access
-- Policy for viewing images (anyone can view)
CREATE POLICY "Anyone can view fractal images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('fractal-thumbnails', 'fractal-images', 'fractal-gifs'));

-- Policy for uploading images (anyone can upload)
CREATE POLICY "Anyone can upload fractal images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('fractal-thumbnails', 'fractal-images', 'fractal-gifs')
  );

-- Policy for updating images (anyone can update their own uploads)
CREATE POLICY "Anyone can update fractal images" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('fractal-thumbnails', 'fractal-images', 'fractal-gifs')
  );

-- Policy for deleting images (anyone can delete)
CREATE POLICY "Anyone can delete fractal images" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('fractal-thumbnails', 'fractal-images', 'fractal-gifs')
  );

-- 6. Sample data (optional - remove if you don't want test data)
-- INSERT INTO public.fractals (title, description, config, transforms, colormap, width, height) VALUES
-- (
--   'Sample Fractal',
--   'A beautiful test fractal',
--   '{"x": 0, "y": 0, "zoom": 0.7, "rotation": 1, "mirrorX": false, "mirrorY": false, "gamma": 2.2, "hueShift": 0, "satShift": 0, "lightShift": 0, "final": -1, "cfinal": -1, "numPoints": 30000, "animationSpeed": 0.1}',
--   '[{"variation": "Linear", "animateX": false, "animateY": false, "a": 1, "b": 0, "c": 0, "d": 1, "e": 0, "f": 0}]',
--   'gnuplot',
--   900,
--   900
-- ); 