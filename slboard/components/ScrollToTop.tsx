'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function scrollWindowToTop() {
  window.scrollTo(0, 0);
}

/** Nach SPA-Route: Fenster oben (letztes `<body>`-Kind, damit es nach dem App-Router läuft). Zurück/Vor: einmal überspringen. */
export function ScrollToTop() {
  const pathname = usePathname();
  const skipScrollRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      skipScrollRef.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useLayoutEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    scrollWindowToTop();
    const raf = window.requestAnimationFrame(() => {
      scrollWindowToTop();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
