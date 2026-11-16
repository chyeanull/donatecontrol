import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function InfoTooltip({ label, text }: { label: string; text: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const keepOpen = () => { clearTimeout(timer.current); setOpen(true); };
  const leave = () => {
    clearTimeout(timer.current);
    if (document.activeElement !== trigger.current) timer.current = setTimeout(() => setOpen(false), 120);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current!.getBoundingClientRect();
      const box = tip.current!.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > innerHeight) { setOpen(false); return; }
      setPosition({
        left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - box.width / 2, innerWidth - box.width - 8)),
        top: Math.max(8, Math.min(anchor.top >= box.height + 16 ? anchor.top - box.height - 8 : anchor.bottom + 8, innerHeight - box.height - 8)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, text]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !tip.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="info-tooltip-trigger" aria-label={`About ${label.toLowerCase()}`} aria-describedby={open ? id : undefined}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') keepOpen(); }} onPointerLeave={leave}
      onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) keepOpen(); }} onBlur={() => setOpen(false)}
      onClick={() => { clearTimeout(timer.current); setOpen((value) => !value); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>
    </button>
    {open && createPortal(<div ref={tip} id={id} role="tooltip" className="info-tooltip" style={position} onPointerEnter={keepOpen} onPointerLeave={leave}>{text}</div>, document.body)}
  </>;
}
