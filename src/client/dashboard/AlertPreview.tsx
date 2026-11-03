import { AlertCanvas } from '../shared/AlertCanvas';
import { AlertCard } from '../shared/Graphics';
import type { ClassicColors, CustomTheme, DonationAlert, OverlayAnimation, OverlayTheme } from '../../shared/models';

// Use the broadcast canvas for layout, then scale the actual card to fit the
// dashboard. Narrow preview cards must not shorten names or change line breaks.
export function AlertPreview({ alert, theme, animation, classicColors, customTheme, animationInMs, animationOutMs }: { alert: DonationAlert; theme: OverlayTheme; animation: OverlayAnimation; classicColors?: ClassicColors; customTheme?: CustomTheme; animationInMs?: number; animationOutMs?: number }) {
  return <AlertCanvas className="mini-alert" maxScale={.84} padding={24}><AlertCard alert={alert} theme={theme} animation={animation} classicColors={classicColors} customTheme={customTheme} animationInMs={animationInMs} animationOutMs={animationOutMs}/></AlertCanvas>;
}
