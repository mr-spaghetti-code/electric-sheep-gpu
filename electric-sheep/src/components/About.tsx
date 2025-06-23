import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Zap, 
  Palette, 
  Download, 
  Globe,
  Monitor,
  Cpu
} from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Electric Sheep</h1>
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <p className="text-xl text-muted-foreground">
            Real-time WebGPU Fractal Flame Renderer
          </p>
        </div>

        {/* Project Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              About the Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Electric Sheep is a cutting-edge web application that brings the mesmerizing world of 
              fractal flames to your browser using WebGPU technology. Inspired by the original 
              Electric Sheep screensaver, this project renders beautiful, ever-evolving fractal 
              patterns in real-time with hardware acceleration.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              The application uses advanced mathematical algorithms to generate complex, organic-looking 
              patterns that seem to dance and flow across your screen. Each fractal is unique and can 
              be customized through various parameters including transforms, color palettes, and animation settings.
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Key Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Monitor className="w-5 h-5 mt-0.5 text-primary" />
                <div>
                  <h3 className="font-semibold">WebGPU Acceleration</h3>
                  <p className="text-sm text-muted-foreground">
                    Hardware-accelerated rendering for smooth, real-time performance
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 mt-0.5 text-primary" />
                <div>
                  <h3 className="font-semibold">Dynamic Color Palettes</h3>
                  <p className="text-sm text-muted-foreground">
                    Multiple color schemes with real-time adjustments
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 mt-0.5 text-primary" />
                <div>
                  <h3 className="font-semibold">Interactive Controls</h3>
                  <p className="text-sm text-muted-foreground">
                    Fine-tune parameters and watch changes in real-time
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 mt-0.5 text-primary" />
                <div>
                  <h3 className="font-semibold">Export Capabilities</h3>
                  <p className="text-sm text-muted-foreground">
                    Save your creations as PNG images or animated GIFs
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technology Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Technology Stack
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">React</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">WebGPU</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
              <Badge variant="secondary">Vite</Badge>
              <Badge variant="secondary">Radix UI</Badge>
              <Badge variant="secondary">Lucide Icons</Badge>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Fractal Flames Work</CardTitle>
            <CardDescription>
              Understanding the mathematics behind the beauty
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Fractal flames are a type of iterated function system that creates complex, 
              organic-looking images through mathematical transformations. The algorithm works by:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
              <li>Starting with a random point in 2D space</li>
              <li>Applying a series of mathematical transformations (functions)</li>
              <li>Collecting millions of these transformed points</li>
              <li>Mapping the density of points to colors and brightness</li>
              <li>Rendering the final image with smooth gradients and vibrant colors</li>
            </ol>
            <p className="text-muted-foreground leading-relaxed">
              The "flame" aspect comes from the way colors flow and blend, creating patterns 
              that resemble flames, organic growth, or flowing water.
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Built with ❤️ using modern web technologies • 
            WebGPU required for optimal performance
          </p>
        </div>
      </div>
    </div>
  );
};

export default About; 