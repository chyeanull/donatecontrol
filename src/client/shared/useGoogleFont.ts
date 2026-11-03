import { useEffect } from 'react';
import type { OverlayFont } from '../../shared/fonts';

// Each document loads only the selected family. Multiple previews share a link;
// switching themes never removes a stylesheet another preview is still using.
const fonts = new Map<OverlayFont, { link: HTMLLinkElement; users: number }>();
export function useGoogleFont(font: OverlayFont | undefined) {
  useEffect(() => {
    if (!font) return;
    let entry = fonts.get(font);
    if (!entry) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;700&display=swap`;
      link.dataset.overlayFont = font;
      document.head.append(link);
      entry = { link, users: 0 };
      fonts.set(font, entry);
    }
    entry.users += 1;
    return () => {
      entry.users -= 1;
      if (!entry.users) { entry.link.remove(); fonts.delete(font); }
    };
  }, [font]);
}
