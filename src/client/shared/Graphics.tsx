import { formatCurrency } from '../../shared/format';
import type { CampaignState, DonationAlert, OverlayTheme, OverlayAnimation, ClassicColors, CustomTheme } from '../../shared/models';
import { customThemeStyle, overlayMotionStyle, overlayIcon, overlayGoogleFont } from './appearance';
import { DonationIcon } from './DonationIcon';
import { useCountUp, useOverlayEntrance } from './motion';
import './graphics.css';
import { useGoogleFont } from './useGoogleFont';
import { CounterStrikeChicken } from './CounterStrikeChicken';
import { MustacheRiderThermometer } from './MustacheRiderThermometer';

export function Heart({ className = '' }: { className?: string }) {
  return <DonationIcon className={className} name="heart"/>;
}
type AppearanceProps = { theme?: OverlayTheme; animation?: OverlayAnimation; classicColors?: ClassicColors; customTheme?: CustomTheme; animationInMs?: number; animationOutMs?: number };
export function Thermometer({ campaign, theme = 'classic', animation = 'draw-left', classicColors, customTheme, animationInMs, animateEntrance = true }: Omit<AppearanceProps, 'animationOutMs'> & { campaign: CampaignState; animateEntrance?: boolean }) {
  const raised = useCountUp(campaign.raised);
  // This persistent graphic enters only on mount. Donation totals and appearance
  // updates must never hide it or restart its entrance.
  const entered = useOverlayEntrance(true, 'thermometer');
  const progress = Math.min(100, Math.max(0, campaign.percent));
  const icon = overlayIcon(customTheme);
  useGoogleFont(overlayGoogleFont(theme, customTheme));
  return <section className={`thermometer ${theme === 'mustacherider' ? '' : 'overlay-motion'} ${entered ? 'is-visible' : ''}`} data-theme={theme} data-animation={animation} style={{ ...customThemeStyle(theme, classicColors, customTheme), ...overlayMotionStyle(animationInMs, 0) }} aria-label={`${campaign.title}: ${formatCurrency(campaign.raised, campaign.currency)} raised${campaign.goal > 0 ? ` of ${formatCurrency(campaign.goal, campaign.currency)} goal, ${campaign.percent}%` : ', goal not set'}`}>
    {theme === 'mustacherider' ? <MustacheRiderThermometer campaign={campaign} animate={animateEntrance}/> : <>
    {theme === 'cs2' && <CounterStrikeChicken/>}
    <div className="thermo-heading">{icon && <span className="graphic-mark"><DonationIcon name={icon}/></span>}<span className="thermo-title">{campaign.title}</span><span className="thermo-tag">TOGETHER, WE CAN.</span></div>
    <div className="thermo-amounts"><div><strong>{formatCurrency(raised, campaign.currency, false)}</strong><span> raised</span></div><div className="thermo-goal">{campaign.goal > 0 ? <><strong>{formatCurrency(campaign.goal, campaign.currency, Boolean(campaign.goalOverridden) && !Number.isInteger(campaign.goal))}</strong><span> goal</span></> : <span>Every donation makes a difference</span>}</div></div>
    <div className="thermo-bottom"><div className="thermo-track"><div className="thermo-fill" style={{ transform: `scaleX(${progress / 100})` }} /></div><strong className="thermo-percent">{campaign.goal > 0 ? `${Math.round(campaign.percent)}%` : '—'}</strong></div>
    </>}
  </section>;
}
export function AlertCard({ alert, theme = 'classic', animation = 'draw-left', classicColors, customTheme, animationInMs, animationOutMs }: AppearanceProps & { alert: DonationAlert }) {
  const entered = useOverlayEntrance(alert.visible, `${animation}:${alert.donation?.id ?? ''}`);
  const message = alert.donation?.message?.trim();
  const icon = overlayIcon(customTheme);
  useGoogleFont(overlayGoogleFont(theme, customTheme));
  return <section className={`donation-card overlay-motion ${icon ? 'has-icon' : ''} ${message ? 'has-message' : ''} ${entered ? 'is-visible' : ''}`} data-theme={theme} data-animation={animation} style={{ ...customThemeStyle(theme, classicColors, customTheme), ...overlayMotionStyle(animationInMs, animationOutMs) }} aria-hidden={!alert.visible}>
    {theme === 'cs2' && <CounterStrikeChicken/>}
    {icon && <div className="alert-symbol"><DonationIcon name={icon}/></div>}
    <div className="alert-eyebrow">NEW DONATION {alert.donation?.test && <span>(TEST)</span>}</div>
    <div className="alert-donation-line"><span className="alert-donor">{alert.donation?.donorName ?? ''}</span><span className="alert-amount">donated <strong>{alert.donation ? formatCurrency(alert.donation.amount, alert.donation.currency) : ''}</strong></span></div>
    {message && <div className="alert-message">{message}</div>}
  </section>;
}
