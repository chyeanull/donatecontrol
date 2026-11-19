import { useLayoutEffect, useRef, useState } from 'react';
import type { DonationAlert } from '../../shared/models';
import { formatCurrency } from '../../shared/format';
import { mustacheRiderHoldMs, mustacheRiderMotion as timing } from '../../shared/mustacheRider';
import { useReducedMotion } from './motion';
import './mustacheRider.css';

const logo = new URL('./images/mustacherider/Mustachio_SVG.svg', import.meta.url).href;
const canvas = { width: 1920, height: 1080, margin: 48, paperWidth: 640 };
const barcodeWidths = [2, 1, 3, 1, 1, 2, 4, 1, 2, 2, 1, 3, 1, 1, 4, 2, 1, 3, 2, 1, 1, 4, 1, 2, 3, 1, 2, 1, 4, 1, 1, 2, 3, 2, 1, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1];
const barcodeBars = barcodeWidths.map((width, index) => ({ width, x: barcodeWidths.slice(0, index).reduce((sum, value) => sum + value, 0), ink: index % 2 === 0 }));
const barcodeWidth = barcodeWidths.reduce((sum, width) => sum + width, 0);

export function MustacheRiderReceipt({ alert, animate = true }: { alert: DonationAlert; animate?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const messageWindow = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLDivElement>(null);
  const active = useRef<Animation | null>(null);
  const reduce = useReducedMotion();
  const [layout, setLayout] = useState({ canvasScale: 1, width: canvas.paperWidth, height: 640, messageOverflow: 0, messageHeight: 0, ready: false });
  const id = alert.donation?.id;
  const holdMs = alert.playback?.holdMs ?? mustacheRiderHoldMs(alert.donation?.message);

  useLayoutEffect(() => {
    if (!viewport.current || !paper.current) return;
    const measure = () => {
      const host = viewport.current!;
      const height = paper.current!.offsetHeight;
      // Only fit the full broadcast canvas to its preview. The paper and type
      // keep their size; additional message lines grow the paper up to its cap.
      setLayout({ canvasScale: Math.min(host.clientWidth / canvas.width, host.clientHeight / canvas.height),
        width: canvas.paperWidth, height,
        messageOverflow: Math.max(0, (message.current?.offsetHeight ?? 0) - (messageWindow.current?.clientHeight ?? 0)),
        messageHeight: messageWindow.current?.clientHeight ?? 0, ready: true });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current); observer.observe(paper.current);
    if (messageWindow.current) observer.observe(messageWindow.current);
    if (message.current) observer.observe(message.current);
    measure();
    return () => observer.disconnect();
  }, [id]);

  useLayoutEffect(() => () => active.current?.cancel(), []);
  useLayoutEffect(() => {
    const element = motion.current;
    if (!element || !id) { active.current?.cancel(); active.current = null; return; }
    if (!layout.ready) return;
    const currentTransform = getComputedStyle(element).transform;
    const currentOpacity = getComputedStyle(element).opacity;
    const waitingForChime = active.current?.effect?.getTiming().delay === timing.cashLeadInMs
      && Number(active.current?.currentTime ?? Infinity) < timing.cashLeadInMs;
    active.current?.cancel();
    if (!alert.visible && waitingForChime) {
      active.current = null; element.style.opacity = '0'; return;
    }
    if (!animate) {
      element.style.opacity = alert.visible ? '1' : '0';
      element.style.transform = 'none';
      return;
    }
    element.style.opacity = '0';
    const styles = getComputedStyle(element);
    const easeOut = styles.getPropertyValue('--ease-out').trim();
    const easeInOut = styles.getPropertyValue('--ease-in-out').trim();
    if (reduce) {
      active.current = element.animate([{ opacity: alert.visible ? 0 : currentOpacity, transform: 'none' }, { opacity: alert.visible ? 1 : 0, transform: 'none' }], { delay: alert.visible ? timing.cashLeadInMs : 0, duration: 200, easing: easeOut, fill: 'both' });
      return;
    }
    if (alert.visible) {
      // At -90°, the paper's height becomes its horizontal feed length.
      // End printing exactly at the right canvas edge, then tear clear of it.
      const hiddenX = canvas.margin + (layout.width + layout.height) / 2;
      const printedX = canvas.margin + (layout.width - layout.height) / 2;
      const feedY = (layout.height - layout.width) / 2;
      const printEnd = timing.printMs / timing.receiptInMs;
      const tearEnd = (timing.printMs + timing.tearMs) / timing.receiptInMs;
      active.current = element.animate([
        { offset: 0, transform: `translate(${hiddenX}px, ${feedY}px) rotate(-90deg)`, opacity: 1, easing: 'steps(12, end)' },
        { offset: printEnd, transform: `translate(${printedX}px, ${feedY}px) rotate(-90deg)`, opacity: 1, easing: easeOut },
        { offset: (timing.printMs + timing.tearMs / 2) / timing.receiptInMs, transform: `translate(${printedX - 14}px, ${feedY - 10}px) rotate(-94deg)`, opacity: 1, easing: easeOut },
        { offset: tearEnd, transform: `translate(${printedX - 52}px, ${feedY + 12}px) rotate(-86deg)`, opacity: 1, easing: easeInOut },
        { offset: .95, transform: 'translate(-8px, -6px) rotate(4deg)', opacity: 1, easing: easeOut },
        { offset: 1, transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      ], { delay: timing.cashLeadInMs, duration: timing.receiptInMs, fill: 'both' });
    } else {
      // Read the current pose before cancelling so an early dismissal never jumps.
      active.current = element.animate([
        { offset: 0, transform: currentTransform, opacity: currentOpacity, easing: easeInOut },
        { offset: .4, transform: `translate(-28px, ${layout.height * .28}px) rotate(-7deg)`, opacity: 1, easing: easeInOut },
        { offset: .75, transform: `translate(14px, ${layout.height * .72}px) rotate(7deg)`, opacity: 1, easing: easeInOut },
        { offset: 1, transform: `translate(-18px, ${layout.height + 120}px) rotate(-10deg)`, opacity: 0 },
      ], { duration: timing.alertOutMs, fill: 'both' });
    }
  }, [id, alert.visible, animate, reduce, layout.ready, layout.width, layout.height]);

  useLayoutEffect(() => {
    const element = message.current;
    if (!element || !alert.visible || !layout.ready) return;
    element.style.transform = 'none';
    if (messageWindow.current) messageWindow.current.scrollTop = 0;
    if (!animate || layout.messageOverflow <= 0) return;
    // Give the viewer a full second after the paper settles, then use the
    // message's reading budget instead of squeezing every length into 8 seconds.
    // Reduced motion turns pages instantly rather than continuously scrolling.
    const pages = Math.max(1, Math.ceil(layout.messageOverflow / Math.max(1, layout.messageHeight)));
    const scrollMs = holdMs - 2 * timing.messagePauseMs;
    const animation = element.animate([
      { transform: 'translateY(0)' },
      { transform: `translateY(-${layout.messageOverflow}px)` },
    ], {
      delay: timing.alertInMs + timing.messagePauseMs,
      // Give the final reduced-motion page an equal reading interval too.
      duration: reduce ? scrollMs * pages / (pages + 1) : scrollMs,
      easing: reduce ? `steps(${pages}, end)` : 'linear', fill: 'both',
    });
    return () => {
      // Freeze the message in place while the paper floats away.
      element.style.transform = getComputedStyle(element).transform;
      animation.cancel();
    };
  }, [id, alert.visible, animate, reduce, layout.ready, layout.messageOverflow, layout.messageHeight, holdMs]);

  if (!alert.donation) return null;
  const donation = alert.donation;
  return <div ref={viewport} className="receipt-viewport" data-theme="mustacherider">
    <div className="receipt-stage" style={{ transform: `translate(-50%, -50%) scale(${layout.canvasScale})` }}>
      <div ref={motion} className="receipt-motion" data-visible={alert.visible} style={{ width: layout.width, height: layout.height }} aria-hidden={!alert.visible}>
          <article ref={paper} className="receipt-paper" style={{ maxHeight: canvas.height - canvas.margin * 2 }} aria-label={`Donation receipt from ${donation.donorName}`}>
            <img className="receipt-logo" src={logo} alt="MustacheRider logo" width="112" height="112"/>
            <div className="receipt-donation"><span className="receipt-name">{donation.donorName}</span><strong className="receipt-amount">{formatCurrency(donation.amount, donation.currency)}</strong></div>
            {donation.message?.trim() && <><div className="receipt-rule"/><div ref={messageWindow} className={`receipt-message-window${animate ? ' is-playing' : ''}`} tabIndex={!animate && layout.messageOverflow > 0 ? 0 : undefined} role="region" aria-label="Donation message"><div ref={message} className="receipt-message">{donation.message.trim()}</div></div></>}
            <div className="receipt-rule"/>
            <div className="receipt-thanks">THANK YOU FOR YOUR SUPPORT!</div>
            {donation.test && <div className="receipt-test">TEST PRINT</div>}
            <svg className="receipt-barcode" viewBox={`0 0 ${barcodeWidth} 32`} preserveAspectRatio="none" aria-hidden="true">{barcodeBars.filter(bar => bar.ink).map(bar => <rect key={bar.x} x={bar.x} width={bar.width} height="32"/>)}</svg>
          </article>
      </div>
    </div>
  </div>;
}
