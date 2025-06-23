import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Globe,
  FileText,
  ExternalLink,
  Users
} from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">FractalMachine.xyz</h1>
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
              FractalMachine.xyz is a web application that brings the mesmerizing world of 
              fractal flames to your browser using WebGPU. Inspired by the original 
              Electric Sheep screensaver created by Scott Draves, this project renders beautiful, 
              ever-evolving fractal patterns in real-time with hardware acceleration.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Unlike traditional fractals, fractal flames are a kind of digital artwork that is grown, 
              not drawn. Each flame is defined entirely by its rule set, so a tiny preset can render 
              a wall-sized image or an infinite HD animation without losing detail.
            </p>
          </CardContent>
        </Card>

        {/* What's a Fractal Flame */}
        <Card>
          <CardHeader>
            <CardTitle>What's a "Fractal Flame"?</CardTitle>
            <CardDescription>
              Understanding the mathematics behind the beauty
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              A fractal flame is a kind of digital artwork grown, not drawn. It starts with a handful 
              of simple math rules—little formulas that bend, twist, and stretch points in 2-D space. 
              A computer plays a "chaos game," tossing a random dart into the plane, running it through 
              one of those rules, plotting the new location, then repeating millions of times. Over time 
              the dots settle onto a delicate, self-repeating shape called an <em>attractor</em>.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-4">Three clever twists that make flames glow</h3>
            
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <h4 className="font-semibold text-primary">1. Wild (non-linear) moves</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Instead of sticking to straight-line transforms, the algorithm mixes in dozens of 
                  non-linear "variations" like <em>swirl</em>, <em>spherical</em>, or <em>popcorn</em>. 
                  Each variation warps the attractor in its own signature way, producing everything 
                  from feathery wisps to crystalline webs.
                </p>
              </div>
              
              <div className="border-l-4 border-primary pl-4">
                <h4 className="font-semibold text-primary">2. Log-density brightness</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Every time a pixel is hit, the algorithm increments a counter. Taking the 
                  <em>logarithm</em> of those counts turns a huge range of hit-counts into smooth 
                  brightness levels, revealing fine structure that would otherwise be blown out 
                  or lost in shadow.
                </p>
              </div>
              
              <div className="border-l-4 border-primary pl-4">
                <h4 className="font-semibold text-primary">3. Structural coloring</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A hidden color coordinate rides along with each point. As different rules fire, 
                  the color blends and eventually lands on the canvas with the point, so hues trace 
                  the geometry of the flame instead of just painting it afterward.
                </p>
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg mt-6">
              <h4 className="font-semibold mb-2">The result</h4>
              <p className="text-sm text-muted-foreground">
                Combine those twists with a touch of anti-aliasing and motion blur, and the computer 
                "grows" luminous, smoke-like patterns that feel both organic and other-worldly—what 
                artist/creator Scott Draves dubbed <em>fractal flames</em>.
              </p>
            </div>
          </CardContent>
        </Card>



        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Learn More
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a 
                href="/flame_draves.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <FileText className="w-4 h-4" />
                The Fractal Flame Algorithm (PDF)
                <ExternalLink className="w-3 h-3" />
              </a>
              <a 
                href="https://en.wikipedia.org/wiki/Fractal_flame" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Globe className="w-4 h-4" />
                Fractal Flame on Wikipedia
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Credits & Acknowledgments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">Scott Draves</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  Creator of the fractal flame algorithm and the original Electric Sheep screensaver
                </p>
                <a 
                  href="https://scottdraves.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  Visit Scott's website
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold">Ignacio Esteban Losiggio</h3>
                <p className="text-sm text-muted-foreground">
                  Original prototype implementation using WebGPU
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold">Project Developer</h3>
                <a 
                  href="https://github.com/mr-spaghetti-code/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  GitHub Profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Built with love by{' '}
            <a 
              href="https://www.joao.contact" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              João Fiadeiro Wenzel
            </a>
            {' '}•{' '}
            <a 
              href="https://www.x.com/jay_wooow" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @jay_wooow
            </a>
            {' '}• WebGPU required for optimal performance
          </p>
        </div>
      </div>
    </div>
  );
};

export default About; 