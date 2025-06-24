import { createClient } from '@supabase/supabase-js';
import type { FractalConfig, ExtendedFractalTransform } from '@/types/fractal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      fractals: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          config: FractalConfig;
          transforms: ExtendedFractalTransform[];
          colormap: string;
          width: number;
          height: number;
          thumbnail_url: string | null;
          full_image_url: string | null;
          gif_url: string | null;
          view_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          config: FractalConfig;
          transforms: ExtendedFractalTransform[];
          colormap: string;
          width: number;
          height: number;
          thumbnail_url?: string | null;
          full_image_url?: string | null;
          gif_url?: string | null;
          view_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          config?: FractalConfig;
          transforms?: ExtendedFractalTransform[];
          colormap?: string;
          width?: number;
          height?: number;
          thumbnail_url?: string | null;
          full_image_url?: string | null;
          gif_url?: string | null;
          view_count?: number;
          created_at?: string;
        };
      };
    };
  };
}; 