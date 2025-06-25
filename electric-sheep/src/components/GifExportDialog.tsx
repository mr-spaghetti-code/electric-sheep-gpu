import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Film, X, Loader2 } from 'lucide-react';

interface GifExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: { duration: number; quality: number; fps: number; size: number }) => void;
  isExporting: boolean;
  exportProgress: { current: number; total: number; status: string };
}

const GifExportDialog: React.FC<GifExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  isExporting,
  exportProgress
}) => {
  const [duration, setDuration] = useState(4); // seconds
  const [quality, setQuality] = useState(0.3); // 0-1 range (low quality default)
  const [size, setSize] = useState(512); // pixels
  const [fps, setFps] = useState(24); // Default to 24fps

  const totalFrames = duration * fps;

  const sizeOptions = [
    { value: 256, label: '256x256' },
    { value: 512, label: '512x512' },
    { value: 1024, label: '1024x1024' }
  ];

  const fpsOptions = [
    { value: 12, label: '12 FPS' },
    { value: 24, label: '24 FPS' },
    { value: 30, label: '30 FPS' }
  ];

  const handleExport = () => {
    onExport({ duration, quality, fps, size });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Film className="w-5 h-5" />
              Export Animated GIF
            </CardTitle>
            <CardDescription>
              Configure your GIF export settings
            </CardDescription>
          </div>
          {!isExporting && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!isExporting ? (
            <>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Duration</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[duration]}
                      onValueChange={(value) => setDuration(value[0])}
                      min={1}
                      max={10}
                      step={0.5}
                      className="flex-1"
                    />
                    <Badge variant="secondary" className="min-w-[60px] text-center">
                      {duration}s
                    </Badge>
                  </div>
                </div>

                                 <div className="space-y-2">
                   <Label className="text-sm font-medium">Quality</Label>
                   <div className="flex items-center gap-4">
                     <Slider
                       value={[quality]}
                       onValueChange={(value) => setQuality(value[0])}
                       min={0.1}
                       max={1}
                       step={0.1}
                       className="flex-1"
                     />
                     <Badge variant="secondary" className="min-w-[60px] text-center">
                       {Math.round(quality * 100)}%
                     </Badge>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <Label className="text-sm font-medium">Size</Label>
                   <Select value={size.toString()} onValueChange={(value) => setSize(parseInt(value, 10))}>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       {sizeOptions.map(option => (
                         <SelectItem key={option.value} value={option.value.toString()}>
                           {option.label}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>

                 <div className="space-y-2">
                   <Label className="text-sm font-medium">Frame Rate</Label>
                   <Select value={fps.toString()} onValueChange={(value) => setFps(parseInt(value, 10))}>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       {fpsOptions.map(option => (
                         <SelectItem key={option.value} value={option.value.toString()}>
                           {option.label}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total Frames:</span>
                  <span>{totalFrames}</span>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleExport} className="flex-1">
                  <Film className="w-4 h-4 mr-2" />
                  Export GIF
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">{exportProgress.status}</p>
                  {exportProgress.total > 0 && (
                    <div className="space-y-1">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-200" 
                          style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {exportProgress.current} / {exportProgress.total}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  This may take a few minutes. Please wait...
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GifExportDialog; 