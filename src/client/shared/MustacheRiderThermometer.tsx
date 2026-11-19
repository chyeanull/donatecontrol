import { useId, type CSSProperties } from 'react';
import { mustacheRiderScale, mustacheRiderMotion } from '../../shared/mustacheRider';
import type { CampaignState } from '../../shared/models';
import { useGoogleFont } from './useGoogleFont';
import './mustacheRider.css';

const bun = new URL('./images/mustacherider/hotdog_bun_bg.svg', import.meta.url).href;
const mustard = new URL('./images/mustacherider/hotdog_mustard.svg', import.meta.url).href;
// Visible bounds measured from the supplied mustard paths, not the SVG canvas.
const mustardStart = 101.59188079833984;
const mustardWidth = 589.157958984375;
const mustardRadius = 33;
const maskPadding = mustardRadius + 2;

export function MustacheRiderThermometer({ campaign, animate = false }: { campaign: Pick<CampaignState, 'raised' | 'goal' | 'currency'>; animate?: boolean }) {
  const clipId = `mustard-${useId().replace(/:/g, '')}`;
  const { hasGoal, progress, labels } = mustacheRiderScale(campaign.raised, campaign.goal, campaign.currency);
  // Pad the fixed left edge so rounding only shapes the growing tip. At 100%,
  // move the cap beyond the artwork to retain the original mustard end.
  const maskWidth = progress === 0 ? 0 : maskPadding + mustardWidth * progress + (progress === 1 ? maskPadding : 0);
  useGoogleFont('Rubik Spray Paint');
  return <svg className={`mustacherider-art ${animate ? 'is-animated' : ''}`} viewBox="0 0 769.47 277.43" aria-hidden="true" style={{ '--hotdog-in-duration': `${mustacheRiderMotion.hotdogInMs}ms`, '--mustard-in-duration': `${mustacheRiderMotion.mustardInMs}ms`, '--mustard-fill-width': `${maskWidth}px` } as CSSProperties}>
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect className="mustacherider-fill-mask" x={mustardStart - maskPadding} y="22" height={mustardRadius * 2} rx={mustardRadius} width={maskWidth}/></clipPath></defs>
    <g className="mustacherider-hotdog">
    <image href={bun} width="769.47" height="277.43"/>
    <g clipPath={`url(#${clipId})`}><image className="mustacherider-mustard-draw" href={mustard} width="769.47" height="277.43"/></g>
    <text className="mustacherider-labels" x={hasGoal ? 94 : 385} y="133" textAnchor={hasGoal ? 'start' : 'middle'} textLength={hasGoal ? 580 : undefined} lengthAdjust="spacingAndGlyphs">{hasGoal ? labels.join('\u2002|\u2002') : 'Goal not set'}</text>
    </g>
  </svg>;
}
