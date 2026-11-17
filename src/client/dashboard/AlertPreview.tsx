import { AlertGraphic } from '../shared/AlertGraphic';
import type { ClassicColors, CustomTheme, DonationAlert, OverlayAnimation, OverlayTheme } from '../../shared/models';

// Use the broadcast canvas for layout, then scale the actual card to fit the
// dashboard. Narrow preview cards must not shorten names or change line breaks.
export function AlertPreview({ alert, theme, animation, classicColors, customTheme, animationInMs, animationOutMs, animate = false }: { alert: DonationAlert; theme: OverlayTheme; animation: OverlayAnimation; classicColors?: ClassicColors; customTheme?: CustomTheme; animationInMs?: number; animationOutMs?: number; animate?: boolean }) {
  return <AlertGraphic preview animate={animate} alert={alert} theme={theme} animation={animation} classicColors={classicColors} customTheme={customTheme} animationInMs={animationInMs} animationOutMs={animationOutMs}/>;
}
