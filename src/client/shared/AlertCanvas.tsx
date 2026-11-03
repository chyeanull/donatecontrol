import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Measure the untransformed card, then fit the complete alert inside the available
// canvas. Long names/messages, font loads, and thick borders must not crop text.
export function AlertCanvas({ children, className = '', maxScale = 1, padding = 12 }: {
  children: ReactNode; className?: string; maxScale?: number; padding?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);
  useLayoutEffect(() => {
    const container = host.current!;
    const card = content.current!.querySelector<HTMLElement>('.donation-card')!;
    const update = () => setScale(Math.max(.01, Math.min(maxScale,
      Math.max(1, container.clientWidth - padding * 2) / card.offsetWidth,
      Math.max(1, container.clientHeight - padding * 2) / card.offsetHeight)));
    const observer = new ResizeObserver(update);
    observer.observe(container); observer.observe(card); update();
    return () => observer.disconnect();
  }, [maxScale, padding]);
  return <div ref={host} className={`alert-canvas ${className}`}>
    <div ref={content} className="alert-canvas-content" style={{ transform: `scale(${scale})` }}>{children}</div>
  </div>;
}
