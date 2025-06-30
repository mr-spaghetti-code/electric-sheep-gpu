-- Migration: Add generation and parents fields for fractal evolution
-- Run this in your Supabase SQL Editor after the initial setup

-- Add generation field (defaults to 0 for existing fractals)
ALTER TABLE public.fractals 
ADD COLUMN generation INT8 DEFAULT 0;

-- Add parents field to store UUIDs of parent fractals
ALTER TABLE public.fractals 
ADD COLUMN parents UUID[] DEFAULT NULL;

-- Create indexes for the new fields
CREATE INDEX idx_fractals_generation ON public.fractals(generation);
CREATE INDEX idx_fractals_parents ON public.fractals USING GIN (parents);

-- Add a comment to explain the fields
COMMENT ON COLUMN public.fractals.generation IS 'The generation number of the fractal (0 for original, 1+ for evolved)';
COMMENT ON COLUMN public.fractals.parents IS 'Array of parent fractal UUIDs (null for generation 0, 2 UUIDs for evolved fractals)';

-- Optional: Create a view for finding family trees
CREATE OR REPLACE VIEW fractal_families AS
SELECT 
  f.id,
  f.title,
  f.generation,
  f.parents,
  f.created_at,
  p1.title as parent1_title,
  p2.title as parent2_title
FROM public.fractals f
LEFT JOIN public.fractals p1 ON f.parents[1] = p1.id
LEFT JOIN public.fractals p2 ON f.parents[2] = p2.id
ORDER BY f.generation DESC, f.created_at DESC; 