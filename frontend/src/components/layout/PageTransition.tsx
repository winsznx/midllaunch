'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Next.js scroll restoration gets confused by the unmount/mount page-enter CSS animation. 
    // This explicitly forces the scroll to top when the route changes.
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
