import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, X, Check } from 'lucide-react';
import { useFractalStorage, type SaveFractalData } from '@/hooks/useFractalStorage';
import type { FractalConfig, ExtendedFractalTransform } from '@/types/fractal';

interface SaveFractalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  getCurrentFractalData: () => {
    config: FractalConfig;
    transforms: ExtendedFractalTransform[];
    colormap: string;
    width: number;
    height: number;
  };
  canvas?: HTMLCanvasElement;
}

const SaveFractalDialog: React.FC<SaveFractalDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  getCurrentFractalData,
  canvas,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const { saveFractal, isSaving, saveError } = useFractalStorage();

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    try {
      const fractalData = getCurrentFractalData();
      
      const saveData: SaveFractalData = {
        title: title.trim(),
        description: description.trim() || undefined,
        ...fractalData,
        canvas, // Pass the canvas for thumbnail generation
      };

      const result = await saveFractal(saveData);
      
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          handleClose();
          onSuccess?.();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to save fractal:', error);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setShowSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Save to Gallery
              </CardTitle>
              <CardDescription>
                Share your fractal creation with others. A thumbnail will be automatically generated.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Fractal Saved Successfully!
              </h3>
              <p className="text-sm text-green-700">
                Your creation has been added to the gallery.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <input
                  id="title"
                  type="text"
                  placeholder="Enter a title for your fractal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <textarea
                  id="description"
                  placeholder="Describe your fractal..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{saveError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1"
                  disabled={isSaving || !title.trim()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SaveFractalDialog; 