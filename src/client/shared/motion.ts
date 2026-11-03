import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Commit the hidden style before entering. Transitions can then retarget smoothly
// when an alert is dismissed early; pending frames never revive a hidden alert.
export function useOverlayEntrance(visible: boolean, identity: string) {
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    setEntered(false);
    if (!visible) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setEntered(true)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [visible, identity]);
  return entered && visible;
}

export function useReducedMotion() {
  const [reduce, setReduce] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduce(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return reduce;
}
export function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || target <= current.current) { current.current = target; setValue(target); return; }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      current.current = from + (target - from) * (1 - (1 - t) ** 3);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce]);
  return value;
}
