import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Images,
  Eye,
  Calendar,
  Loader2,
  AlertCircle,
  Filter
} from 'lucide-react';
import { useFractalGallery, type FractalRecord } from '@/hooks/useFractalStorage';
import { useSEO, pageSEO } from '../hooks/useSEO';
import FractalRenderer from './FractalRenderer';

const Gallery: React.FC = () => {
  // SEO
  useSEO(pageSEO.gallery);
  
  const { fetchFractals, incrementViewCount, isLoading, error } = useFractalGallery();
  const [fractals, setFractals] = useState<FractalRecord[]>([]);
  const [filteredFractals, setFilteredFractals] = useState<FractalRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedFractal, setSelectedFractal] = useState<FractalRecord | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<string>('all');

  const ITEMS_PER_PAGE = 10;

  // Load initial fractals
  useEffect(() => {
    loadFractals(0, true);
  }, []);

  const loadFractals = async (page: number, reset: boolean = false) => {
    try {
      setLoadingMore(true);
      const newFractals = await fetchFractals(page, ITEMS_PER_PAGE);
      
      if (reset) {
        setFractals(newFractals);
      } else {
        setFractals(prev => [...prev, ...newFractals]);
      }
      
      setHasMore(newFractals.length === ITEMS_PER_PAGE);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error loading fractals:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Update filtered fractals when fractals or selected generation changes
  useEffect(() => {
    let filtered: FractalRecord[];
    if (selectedGeneration === 'all') {
      filtered = fractals;
    } else {
      const genNumber = parseInt(selectedGeneration);
      filtered = fractals.filter(fractal => (fractal.generation || 0) === genNumber);
    }
    setFilteredFractals(filtered);
  }, [fractals, selectedGeneration]);

  // Get available generations for filter dropdown
  const availableGenerations = useMemo(() => {
    const generations = new Set<number>();
    fractals.forEach(fractal => {
      generations.add(fractal.generation || 0);
    });
    return Array.from(generations).sort((a, b) => a - b);
  }, [fractals]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadFractals(currentPage + 1, false);
    }
  };

  const handleThumbnailClick = async (fractal: FractalRecord) => {
    setSelectedFractal(fractal);
    
    // Increment view count
    try {
      await incrementViewCount(fractal.id);
      // Update local state to reflect the incremented view count
      setFractals(prev => 
        prev.map(f => 
          f.id === fractal.id 
            ? { ...f, view_count: f.view_count + 1 }
            : f
        )
      );
    } catch (err) {
      console.warn('Failed to increment view count:', err);
    }
  };

  const handleCloseFractal = () => {
    setSelectedFractal(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (selectedFractal) {
    return (
      <div className="container mx-auto px-4 py-8">
        <FractalRenderer
          fractalData={selectedFractal}
          width={800}
          height={800}
          onClose={handleCloseFractal}
          className="max-w-4xl mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3">
              <Images className="w-8 h-8" />
              Fractal Gallery
            </CardTitle>
            <CardDescription>
              Explore beautiful fractal flames created by our community. Click on any fractal to view and interact with it.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span>Error loading fractals: {error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && fractals.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                  <p className="text-lg">Loading fractals...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gallery Grid */}
        {fractals.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-xl">
                  Fractal Collection ({filteredFractals.length} of {fractals.length} fractal{fractals.length !== 1 ? 's' : ''})
                </CardTitle>
                
                {/* Generation Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={selectedGeneration} onValueChange={setSelectedGeneration}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Generation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Gen</SelectItem>
                      {availableGenerations.map((gen) => (
                        <SelectItem key={gen} value={gen.toString()}>
                          Gen {gen}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {filteredFractals.map((fractal) => (
                  <Card 
                    key={fractal.id}
                    className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
                    onClick={() => handleThumbnailClick(fractal)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                          {fractal.thumbnail_url ? (
                            <img
                              src={fractal.thumbnail_url}
                              alt={fractal.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                              onError={(e) => {
                                // Fallback if thumbnail fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400">
                                    <Images class="w-12 h-12 text-white opacity-50" />
                                  </div>
                                `;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400">
                              <Images className="w-12 h-12 text-white opacity-50" />
                            </div>
                          )}
                        </div>

                        {/* Fractal Info */}
                        <div className="space-y-2">
                          <div>
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                              {fractal.title}
                            </h3>
                            {fractal.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {fractal.description}
                              </p>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {fractal.colormap}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {fractal.width}×{fractal.height}
                            </Badge>
                            {fractal.generation !== undefined && (
                              <Badge variant="default" className="text-xs">
                                Gen {fractal.generation}
                              </Badge>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {fractal.view_count}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(fractal.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* No filtered results */}
              {filteredFractals.length === 0 && fractals.length > 0 && (
                <div className="text-center py-12">
                  <Filter className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No fractals found</h3>
                  <p className="text-muted-foreground mb-4">
                    No fractals match the selected generation filter.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedGeneration('all')}
                  >
                    Show All Generations
                  </Button>
                </div>
              )}

              {/* Load More Button - only show if we have filtered results */}
              {hasMore && filteredFractals.length > 0 && (
                <div className="mt-8 text-center">
                  <Button 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    variant="outline"
                    size="lg"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Fractals
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* End of Results */}
              {!hasMore && filteredFractals.length > 0 && (
                <div className="mt-8 text-center">
                  <Separator className="mb-4" />
                  <p className="text-muted-foreground">
                    You've reached the end of the gallery
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && fractals.length === 0 && !error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Images className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No fractals found</h3>
                <p className="text-muted-foreground mb-6">
                  Be the first to share your beautiful fractal creations!
                </p>
                <Button asChild>
                  <a href="/">Create Your First Fractal</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Gallery; 