import { useEffect, useRef, type KeyboardEvent } from 'react';
import { dashboardPages, type DashboardPage } from '../../shared/dashboard';

export function DashboardNavigation({ page }: { page: DashboardPage }) {
  const keyboard = useRef(false);

  useEffect(() => {
    const skipKeyboardMotion = (event: PageSwapEvent) => {
      if (keyboard.current) event.viewTransition?.skipTransition();
    };
    window.addEventListener('pageswap', skipKeyboardMotion);
    return () => window.removeEventListener('pageswap', skipKeyboardMotion);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    keyboard.current = true;
    const links = [...event.currentTarget.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    const next = event.key === 'ArrowRight' ? (index + 1) % links.length
      : event.key === 'ArrowLeft' ? (index + links.length - 1) % links.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    links[next].focus();
  };

  return <nav className="panel-nav" aria-label="Control panel pages" onKeyDown={handleKeyDown} onPointerDown={() => { keyboard.current = false; }}>
    {dashboardPages.map((item) => <a key={item.id} href={`./${item.panel}.html?standalone=true`} aria-current={page === item.id ? 'page' : undefined}>
      {page === item.id && <span className="panel-nav-selection" aria-hidden="true"/>}
      {item.label}
    </a>)}
  </nav>;
}
