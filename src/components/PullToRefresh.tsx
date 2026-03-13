// src/components/PullToRefresh.tsx
// Pull-to-refresh functionality for mobile users

'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;  // Pull distance to trigger refresh (default: 80px)
  maxPull?: number;    // Maximum pull distance (default: 150px)
  disabled?: boolean;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  maxPull = 150,
  disabled = false
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);

  // Check if at top of page
  const isAtTop = useCallback(() => {
    if (containerRef.current) {
      return containerRef.current.scrollTop <= 0;
    }
    return window.scrollY <= 0;
  }, []);

  // Touch start handler
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || !isAtTop()) return;
    
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, [disabled, isRefreshing, isAtTop]);

  // Touch move handler
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;
    
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    
    // Only pull down, not up
    if (diff > 0 && isAtTop()) {
      // Apply resistance (diminishing returns as pull increases)
      const resistance = 0.4;
      const pull = Math.min(diff * resistance, maxPull);
      
      setPullDistance(pull);
      setIsReady(pull >= threshold);
      
      // Prevent default scroll when pulling
      if (pull > 10) {
        e.preventDefault();
      }
    }
  }, [disabled, isRefreshing, isAtTop, threshold, maxPull]);

  // Touch end handler
  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled) return;
    
    isPullingRef.current = false;
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60); // Keep some distance while refreshing
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsReady(false);
      }
    } else {
      // Snap back
      setPullDistance(0);
      setIsReady(false);
    }
    
    startYRef.current = 0;
    currentYRef.current = 0;
  }, [pullDistance, threshold, isRefreshing, disabled, onRefresh]);

  // Add touch event listeners
  useEffect(() => {
    const container = containerRef.current || document;
    
    container.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
    container.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
    container.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart as EventListener);
      container.removeEventListener('touchmove', handleTouchMove as EventListener);
      container.removeEventListener('touchend', handleTouchEnd as EventListener);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Progress for visual feedback (0 to 1)
  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div 
      ref={containerRef}
      className="relative overflow-auto"
      style={{ touchAction: pullDistance > 0 ? 'none' : 'auto' }}
    >
      {/* Pull indicator */}
      <div 
        className={`
          absolute left-0 right-0 top-0
          flex items-center justify-center
          transition-opacity duration-200
          ${pullDistance > 10 ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ 
          height: pullDistance,
          transform: `translateY(${-60 + pullDistance}px)`
        }}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Icon */}
          <div 
            className={`
              w-10 h-10 rounded-full
              ${isReady || isRefreshing ? 'bg-green-500' : 'bg-gray-700'}
              flex items-center justify-center
              transition-colors duration-200
            `}
            style={{
              transform: `rotate(${progress * 180}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.1s'
            }}
          >
            {isRefreshing ? (
              <RefreshCw className="w-5 h-5 text-white animate-spin" />
            ) : (
              <ChevronDown 
                className={`w-5 h-5 ${isReady ? 'text-white' : 'text-gray-400'}`} 
              />
            )}
          </div>
          
          {/* Text */}
          <span className={`
            text-xs font-medium transition-colors duration-200
            ${isRefreshing ? 'text-green-400' : isReady ? 'text-white' : 'text-gray-500'}
          `}>
            {isRefreshing 
              ? 'Refreshing...' 
              : isReady 
                ? 'Release to refresh' 
                : 'Pull to refresh'
            }
          </span>
        </div>
      </div>

      {/* Content with pull transform */}
      <div 
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
