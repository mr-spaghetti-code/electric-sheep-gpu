import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOData {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

const defaultSEO: SEOData = {
  title: 'FractalMachine.xyz - Real-time WebGPU Fractal Flame Generator',
  description: 'Create stunning fractal flame art in real-time with WebGPU. Interactive fractal generator with gallery, animation, GIF export, and public sharing.',
  keywords: 'fractal flame, fractal generator, WebGPU, fractal art, digital art, generative art, chaos game, attractor, electric sheep, Scott Draves, mathematical art, procedural art, real-time rendering',
  image: 'https://fractalmachine.xyz/example.gif',
  url: 'https://fractalmachine.xyz/'
};

export const useSEO = (seoData?: SEOData) => {
  const location = useLocation();

  useEffect(() => {
    const finalSEO = { ...defaultSEO, ...seoData };
    
    // Update title
    if (finalSEO.title) {
      document.title = finalSEO.title;
    }

    // Update meta tags
    const updateMetaTag = (name: string, content: string) => {
      let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    const updatePropertyTag = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // Update standard meta tags
    if (finalSEO.description) {
      updateMetaTag('description', finalSEO.description);
    }
    if (finalSEO.keywords) {
      updateMetaTag('keywords', finalSEO.keywords);
    }

    // Update Open Graph tags
    if (finalSEO.title) {
      updatePropertyTag('og:title', finalSEO.title);
      updateMetaTag('twitter:title', finalSEO.title);
    }
    if (finalSEO.description) {
      updatePropertyTag('og:description', finalSEO.description);
      updateMetaTag('twitter:description', finalSEO.description);
    }
    if (finalSEO.image) {
      updatePropertyTag('og:image', finalSEO.image);
      updateMetaTag('twitter:image', finalSEO.image);
    }

    // Update URL
    const currentUrl = `https://fractalmachine.xyz${location.pathname}`;
    updatePropertyTag('og:url', currentUrl);
    updateMetaTag('twitter:url', currentUrl);

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = currentUrl;

  }, [seoData, location]);
};

// Page-specific SEO configurations
export const pageSEO = {
  home: {
    title: 'FractalMachine.xyz - Real-time WebGPU Fractal Flame Generator',
    description: 'Create stunning fractal flame art in real-time with WebGPU. Interactive fractal generator with gallery, animation, GIF export, and public sharing. Inspired by Electric Sheep.',
    keywords: 'fractal flame, fractal generator, WebGPU, fractal art, digital art, generative art, chaos game, attractor, electric sheep, Scott Draves, mathematical art, procedural art, real-time rendering'
  },
  gallery: {
    title: 'Fractal Gallery - FractalMachine.xyz',
    description: 'Browse beautiful fractal flame creations from the community. Discover stunning digital art generated with WebGPU fractal flame algorithms.',
    keywords: 'fractal gallery, fractal art gallery, digital art, fractal flame gallery, generative art, mathematical art, community art'
  },
  about: {
    title: 'About Fractal Flames - FractalMachine.xyz',
    description: 'Learn about fractal flame algorithms, the mathematics behind the beauty, and the history of Electric Sheep. Understand how chaos game creates stunning digital art.',
    keywords: 'fractal flame algorithm, Scott Draves, Electric Sheep, chaos game, attractor, mathematical art, digital art theory, fractal mathematics'
  },
  fullscreen: {
    title: 'Fullscreen Fractal Viewer - FractalMachine.xyz',
    description: 'Experience fractal flames in immersive fullscreen mode. Perfect for meditation, presentations, or just enjoying the mesmerizing patterns.',
    keywords: 'fullscreen fractal, fractal viewer, immersive fractal, fractal screensaver, meditative art, generative art viewer'
  }
}; 