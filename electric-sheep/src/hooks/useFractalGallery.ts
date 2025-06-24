import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type FractalRow = Database['public']['Tables']['fractals']['Row'];

export const useFractalGallery = (page: number = 0, pageSize: number = 10) => {
  const [fractals, setFractals] = useState<FractalRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFractals = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error, count } = await supabase
        .from('fractals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      setFractals(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching fractals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch fractals');
    } finally {
      setIsLoading(false);
    }
  };

  const incrementViewCount = async (fractalId: string, currentCount: number) => {
    try {
      await supabase
        .from('fractals')
        .update({ view_count: currentCount + 1 })
        .eq('id', fractalId);
      
      // Update local state
      setFractals(prev => prev.map(f => 
        f.id === fractalId ? { ...f, view_count: f.view_count + 1 } : f
      ));
    } catch (err) {
      console.error('Error updating view count:', err);
    }
  };

  useEffect(() => {
    fetchFractals();
  }, [page, pageSize]);

  return {
    fractals,
    totalCount,
    isLoading,
    error,
    refetch: fetchFractals,
    incrementViewCount
  };
}; 