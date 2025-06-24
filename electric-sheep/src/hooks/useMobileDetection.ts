import { useState, useEffect } from 'react';

interface MobileDetectionResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useMobileDetection(): MobileDetectionResult {
  const [detection, setDetection] = useState<MobileDetectionResult>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const screenWidth = window.innerWidth;
      
      // Check for mobile user agents
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const tabletRegex = /iPad|Android(?=.*\bTablet\b)|(?=.*\bAndroid\b)(?=.*\b(?:Tablet|Tab)\b)/i;
      
      // Check user agent
      const isMobileUA = mobileRegex.test(userAgent);
      const isTabletUA = tabletRegex.test(userAgent);
      
      // Check screen size (fallback)
      const isMobileScreen = screenWidth < 768;
      const isTabletScreen = screenWidth >= 768 && screenWidth < 1024;
      
      // Combine checks
      const isMobile = (isMobileUA && !isTabletUA) || (isMobileScreen && !isTabletScreen);
      const isTablet = isTabletUA || isTabletScreen;
      const isDesktop = !isMobile && !isTablet;

      setDetection({
        isMobile,
        isTablet,
        isDesktop,
      });
    };

    // Check on mount
    checkDevice();

    // Check on resize
    window.addEventListener('resize', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return detection;
} 