// src/components/SwipeableNav.tsx
// Swipe navigation for mobile - swipe left/right to navigate between sections

'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeableNavProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;         // Minimum swipe distance (default: 50px)
  disabled?: boolean;
  showIndicators?: boolean;   // Show edge indicators
  leftLabel?: string;
  rightLabel?: string;
}

export function SwipeableNav({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  disabled = false,
  showIndicators = true,
  leftLabel,
  rightLabel
}: SwipeableNavProps) {
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const isHorizontalRef = useRef(false);

  // Touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = true;
    isHorizontalRef.current = false;
  }, [disabled]);

  // Touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwipingRef.current || disabled) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;
    
    // Determine swipe direction on first significant movement
    if (!isHorizontalRef.current && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
    }
    
    // Only process horizontal swipes
    if (isHorizontalRef.current) {
      e.preventDefault();
      
      // Apply resistance
      const resistance = 0.4;
      const distance = diffX * resistance;
      
      setSwipeDistance(distance);
      setSwipeDirection(distance > 0 ? 'right' : 'left');
    }
  }, [disabled]);

  // Touch end
  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current || disabled) return;
    
    isSwipingRef.current = false;
    
    const absDistance = Math.abs(swipeDistance);
    
    if (absDistance >= threshold) {
      if (swipeDirection === 'left' && onSwipeLeft) {
        onSwipeLeft();
      } else if (swipeDirection === 'right' && onSwipeRight) {
        onSwipeRight();
      }
    }
    
    // Reset
    setSwipeDistance(0);
    setSwipeDirection(null);
    isHorizontalRef.current = false;
  }, [swipeDistance, swipeDirection, threshold, onSwipeLeft, onSwipeRight, disabled]);

  // Add touch event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Calculate indicator opacity
  const leftIndicatorOpacity = swipeDirection === 'right' 
    ? Math.min(Math.abs(swipeDistance) / threshold, 1) 
    : 0;
  const rightIndicatorOpacity = swipeDirection === 'left' 
    ? Math.min(Math.abs(swipeDistance) / threshold, 1) 
    : 0;

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Left edge indicator (swipe right to go back) */}
      {showIndicators && onSwipeRight && (
        <div 
          className="
            absolute left-0 top-0 bottom-0 w-16 z-10
            bg-gradient-to-r from-green-500/30 to-transparent
            flex items-center justify-start pl-2
            pointer-events-none
            transition-opacity duration-150
          "
          style={{ opacity: leftIndicatorOpacity }}
        >
          <div className="flex items-center gap-1 text-white">
            <ChevronLeft className="w-5 h-5" />
            {leftLabel && <span className="text-xs font-medium">{leftLabel}</span>}
          </div>
        </div>
      )}

      {/* Right edge indicator (swipe left to go forward) */}
      {showIndicators && onSwipeLeft && (
        <div 
          className="
            absolute right-0 top-0 bottom-0 w-16 z-10
            bg-gradient-to-l from-green-500/30 to-transparent
            flex items-center justify-end pr-2
            pointer-events-none
            transition-opacity duration-150
          "
          style={{ opacity: rightIndicatorOpacity }}
        >
          <div className="flex items-center gap-1 text-white">
            {rightLabel && <span className="text-xs font-medium">{rightLabel}</span>}
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      )}

      {/* Content with swipe transform */}
      <div 
        style={{ 
          transform: `translateX(${swipeDistance}px)`,
          transition: isSwipingRef.current ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeableNav;
