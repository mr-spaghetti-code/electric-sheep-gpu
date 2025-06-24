import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { FractalConfig, ExtendedFractalTransform } from '@/types/fractal';

export interface SaveFractalData {
  title: string;
  description?: string;
  config: FractalConfig;
  transforms: ExtendedFractalTransform[];
  colormap: string;
  width: number;
  height: number;
  canvas?: HTMLCanvasElement; // Add canvas for thumbnail generation
}

export interface FractalRecord {
  id: string;
  title: string;
  description?: string;
  config: FractalConfig;
  transforms: ExtendedFractalTransform[];
  colormap: string;
  width: number;
  height: number;
  thumbnail_url?: string;
  full_image_url?: string;
  gif_url?: string;
  view_count: number;
  created_at: string;
}

// Helper function to generate thumbnail from WebGPU canvas
const generateThumbnail = (canvas: HTMLCanvasElement, maxSize: number = 256): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // For WebGPU canvas, we need to use the same approach as PNG export
    // Temporarily disable GUI if it's enabled
    const flam3Instance = (window as typeof window & { flam3?: { gui: boolean; step: () => void } }).flam3;
    const wasGuiEnabled = flam3Instance?.gui;
    
    try {
      if (flam3Instance) {
        flam3Instance.gui = false;
        // Render one frame without GUI to capture current state
        flam3Instance.step();
      }

      // Use the WebGPU canvas directly since it supports toBlob
      canvas.toBlob((fullBlob) => {
        // Restore GUI state
        if (flam3Instance && wasGuiEnabled !== undefined) {
          flam3Instance.gui = wasGuiEnabled;
        }

        if (!fullBlob) {
          reject(new Error('Failed to capture canvas content'));
          return;
        }

        // Create thumbnail by resizing the captured image
        const img = new Image();
        img.onload = () => {
          try {
            // Create temporary canvas for resizing
            const thumbCanvas = document.createElement('canvas');
            const thumbCtx = thumbCanvas.getContext('2d');
            
            if (!thumbCtx) {
              reject(new Error('Failed to get thumbnail canvas context'));
              return;
            }

            // Calculate thumbnail dimensions maintaining aspect ratio
            const aspectRatio = img.width / img.height;
            let thumbWidth = maxSize;
            let thumbHeight = maxSize;
            
            if (aspectRatio > 1) {
              thumbHeight = Math.round(maxSize / aspectRatio);
            } else {
              thumbWidth = Math.round(maxSize * aspectRatio);
            }

            thumbCanvas.width = thumbWidth;
            thumbCanvas.height = thumbHeight;

            // Draw scaled image
            thumbCtx.drawImage(img, 0, 0, thumbWidth, thumbHeight);

            // Convert to blob
            thumbCanvas.toBlob((thumbBlob) => {
              URL.revokeObjectURL(img.src);
              if (thumbBlob) {
                resolve(thumbBlob);
              } else {
                reject(new Error('Failed to generate thumbnail blob'));
              }
            }, 'image/jpeg', 0.8);

          } catch (error) {
            URL.revokeObjectURL(img.src);
            reject(error);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          reject(new Error('Failed to load captured image'));
        };

        img.src = URL.createObjectURL(fullBlob);
      }, 'image/png');

    } catch (error) {
      // Restore GUI state on error
      if (flam3Instance && wasGuiEnabled !== undefined) {
        flam3Instance.gui = wasGuiEnabled;
      }
      reject(error);
    }
  });
};

export const useFractalStorage = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveFractal = async (data: SaveFractalData) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      let thumbnailUrl: string | null = null;

      // Generate and upload thumbnail if canvas is provided
      if (data.canvas) {
        try {
          const thumbnailBlob = await generateThumbnail(data.canvas);
          const fileName = `thumbnail_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('fractal-thumbnails')
            .upload(fileName, thumbnailBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
            });

          if (uploadError) {
            console.warn('Failed to upload thumbnail:', uploadError);
            // Continue without thumbnail rather than failing the entire save
          } else if (uploadData) {
            // Get the public URL
            const { data: urlData } = supabase.storage
              .from('fractal-thumbnails')
              .getPublicUrl(uploadData.path);
            
            thumbnailUrl = urlData.publicUrl;
          }
        } catch (thumbnailError) {
          console.warn('Thumbnail generation failed:', thumbnailError);
          // Continue without thumbnail
        }
      }

      const { error } = await supabase
        .from('fractals')
        .insert({
          title: data.title,
          description: data.description || null,
          config: data.config,
          transforms: data.transforms,
          colormap: data.colormap,
          width: data.width,
          height: data.height,
          thumbnail_url: thumbnailUrl,
        });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save fractal';
      setSaveError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    saveFractal,
    isSaving,
    saveError,
  };
};

export const useFractalGallery = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFractals = async (page: number = 0, limit: number = 10): Promise<FractalRecord[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('fractals')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch fractals';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFractalById = async (id: string): Promise<FractalRecord | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('fractals')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch fractal';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const incrementViewCount = async (id: string) => {
    try {
      const { error } = await supabase.rpc('increment_view_count', {
        fractal_id: id
      });

      if (error) {
        console.warn('Failed to increment view count:', error);
      }
    } catch (err) {
      console.warn('Failed to increment view count:', err);
    }
  };

  return {
    fetchFractals,
    fetchFractalById,
    incrementViewCount,
    isLoading,
    error,
  };
}; 