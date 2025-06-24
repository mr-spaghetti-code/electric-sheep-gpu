import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Smartphone, AlertTriangle } from 'lucide-react';

const MobileWarning: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Monitor className="w-16 h-16 text-primary" />
              <AlertTriangle className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2">Desktop Experience Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-muted-foreground space-y-3">
            <p>
              FractalMachine.xyz is designed as a desktop experience with advanced WebGPU fractal rendering and complex controls.
            </p>
            <p>
              For the best experience, please visit us on a desktop or laptop computer.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h3 className="font-semibold flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4" />
              Why Desktop Only?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 text-left">
              <li>• Complex fractal parameter controls</li>
              <li>• WebGPU intensive rendering</li>
              <li>• Hand tracking features</li>
              <li>• High-resolution canvas output</li>
            </ul>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Bookmark this page and return when you're on desktop!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileWarning; 