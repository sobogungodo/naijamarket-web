// src/components/BottomNavigation.tsx
// Mobile bottom navigation with active state and haptic feedback

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Bell, User, TrendingUp } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/prices', label: 'Prices', icon: Search },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/account', label: 'Account', icon: User },
];

interface BottomNavigationProps {
  alertCount?: number;
}

export function BottomNavigation({ alertCount = 0 }: BottomNavigationProps) {
  const pathname = usePathname();
  
  // Haptic feedback on tap (if supported)
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };
  
  // Check if current path matches nav item
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav 
      className="
        fixed bottom-0 left-0 right-0 z-40
        bg-gray-900/98 backdrop-blur-lg
        border-t border-gray-800
        pb-[env(safe-area-inset-bottom)]
        lg:hidden
      "
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const showBadge = item.href === '/alerts' && alertCount > 0;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={triggerHaptic}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[64px] py-2 px-3
                transition-colors duration-200
                ${active 
                  ? 'text-green-400' 
                  : 'text-gray-500 hover:text-gray-300 active:text-green-400'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              {/* Icon with optional badge */}
              <div className="relative">
                <Icon 
                  className={`
                    w-6 h-6 transition-transform duration-200
                    ${active ? 'scale-110' : ''}
                  `} 
                />
                
                {/* Notification badge */}
                {showBadge && (
                  <span 
                    className="
                      absolute -top-1 -right-1
                      min-w-[18px] h-[18px]
                      bg-red-500 text-white
                      text-[10px] font-bold
                      rounded-full
                      flex items-center justify-center
                      px-1
                    "
                  >
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </div>
              
              {/* Label */}
              <span 
                className={`
                  mt-1 text-[10px] font-medium
                  transition-colors duration-200
                  ${active ? 'text-green-400' : ''}
                `}
              >
                {item.label}
              </span>
              
              {/* Active indicator dot */}
              {active && (
                <span 
                  className="
                    absolute top-0 left-1/2 -translate-x-1/2
                    w-1 h-1 bg-green-400 rounded-full
                  "
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
