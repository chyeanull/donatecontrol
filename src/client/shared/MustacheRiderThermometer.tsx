import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { mustacheRiderScale, mustacheRiderMotion } from '../../shared/mustacheRider';
import type { CampaignState } from '../../shared/models';
import { useGoogleFont } from './useGoogleFont';
import { useReducedMotion } from './motion';
import './mustacheRider.css';

const bun = new URL('./images/mustacherider/hotdog_bun_bg.svg', import.meta.url).href;
const mustard = new URL('./images/mustacherider/hotdog_mustard.svg', import.meta.url).href;
// Visible bounds measured from the supplied mustard paths, not the SVG canvas.
const mustardStart = 101.59188079833984;
const mustardWidth = 589.157958984375;
const mustardRadius = 33;
const maskPadding = mustardRadius + 2;

export function MustacheRiderThermometer({ campaign, animate = false, visible = true }: { campaign: Pick<CampaignState, 'raised' | 'goal' | 'currency'>; animate?: boolean; visible?: boolean }) {
  const hotdog = useRef<SVGGElement>(null);
  const active = useRef<Animation | null>(null);
  const reduce = useReducedMotion();
  useLayoutEffect(() => () => active.current?.cancel(), []);
  useLayoutEffect(() => {
    const element = hotdog.current;
    if (!element) return;
    const previous = active.current;
    const styles = getComputedStyle(element);
    const transform = previous ? styles.transform : 'translateY(110%)';
    const opacity = previous ? styles.opacity : '0';
    const ease = styles.getPropertyValue(visible ? '--ease-out' : '--ease-in-out').trim();
    previous?.cancel();
    if (!animate || (!visible && !previous)) {
      element.style.opacity = visible ? '1' : '0';
      element.style.transform = visible ? 'none' : 'translateY(110%)';
      active.current = null;
      return;
    }
    element.style.opacity = '0';
    active.current = element.animate(reduce ? [
      { opacity, transform: 'none' }, { opacity: visible ? 1 : 0, transform: 'none' },
    ] : visible ? [
      { offset: 0, transform, opacity: previous ? opacity : 1 },
      { offset: .62, transform: 'translateY(0) rotate(-.8deg)', opacity: 1 },
      { offset: .8, transform: 'translateY(1%) rotate(.5deg)', opacity: 1 },
      { offset: 1, transform: 'none', opacity: 1 },
    ] : [
      { transform, opacity: 1 }, { transform: 'translateY(110%)', opacity: 1 },
    ], { duration: reduce ? 200 : visible ? mustacheRiderMotion.hotdogInMs : mustacheRiderMotion.hotdogOutMs, easing: ease, fill: 'both' });
    // Funding updates only move the mustard mask; they never replay this entrance.
  }, [animate, visible, reduce]);
  const clipId = `mustard-${useId().replace(/:/g, '')}`;
  const { hasGoal, progress, labels } = mustacheRiderScale(campaign.raised, campaign.goal, campaign.currency);
  // Pad the fixed left edge so rounding only shapes the growing tip. At 100%,
  // move the cap beyond the artwork to retain the original mustard end.
  const maskWidth = progress === 0 ? 0 : maskPadding + mustardWidth * progress + (progress === 1 ? maskPadding : 0);
  useGoogleFont('Rubik Spray Paint');
  return <svg className={`mustacherider-art ${animate && visible ? 'is-animated' : ''}`} viewBox="0 0 769.47 277.43" aria-hidden="true" style={{ '--hotdog-in-duration': `${mustacheRiderMotion.hotdogInMs}ms`, '--mustard-in-duration': `${mustacheRiderMotion.mustardInMs}ms`, '--mustard-fill-width': `${maskWidth}px` } as CSSProperties}>
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect className="mustacherider-fill-mask" x={mustardStart - maskPadding} y="22" height={mustardRadius * 2} rx={mustardRadius} width={maskWidth}/></clipPath></defs>
    <g ref={hotdog} className="mustacherider-hotdog">
    <image href={bun} width="769.47" height="277.43"/>
    <g clipPath={`url(#${clipId})`}><image className="mustacherider-mustard-draw" href={mustard} width="769.47" height="277.43"/></g>
    <text className="mustacherider-labels" x={hasGoal ? 94 : 385} y="133" textAnchor={hasGoal ? 'start' : 'middle'} textLength={hasGoal ? 580 : undefined} lengthAdjust="spacingAndGlyphs">{hasGoal ? labels.join('\u2002|\u2002') : 'Goal not set'}</text>
    </g>
  </svg>;
}
