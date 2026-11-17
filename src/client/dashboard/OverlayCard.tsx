import type { ReactNode } from 'react';
import { graphicUrl } from '../shared/nodecg';
import { Icon } from './PanelLayout';
import { notify } from './notifications';

export function OverlayCard({ type, children, thermometerHeight = 180, fullHdAlert = false }: { type: 'thermometer' | 'alert'; children: ReactNode; thermometerHeight?: number; fullHdAlert?: boolean }) {
  const url = graphicUrl(type);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); notify.success(`${type === 'thermometer' ? 'Thermometer' : 'Donation alert'} URL copied.`); }
    catch { notify.error('Clipboard access is unavailable. Select the Browser Source URL and copy it manually.'); }
  };
  return <article className="overlay-card">
    <div className={`overlay-preview checkerboard ${type}-preview`} aria-label={`${type} preview`}>{children}<span className="preview-label">PREVIEW</span></div>
    <div className="overlay-info"><div className="overlay-heading"><h3>{type === 'thermometer' ? 'Fundraising Thermometer' : 'Donation Alerts'}</h3><span className="dimension">{type === 'thermometer' ? `1000 × ${thermometerHeight}` : fullHdAlert ? '1920 × 1080' : '1000 × 250'}</span></div>
      <label className="sr-only" htmlFor={`${type}-url`}>Browser Source URL for {type}</label>
      <input id={`${type}-url`} className="url-input" readOnly value={url} onFocus={(event) => event.target.select()} />
      {!url && <p className="error-text">Copy an authenticated URL from NodeCG’s Graphics tab.</p>}
      <div className="button-row"><button className="secondary" disabled={!url} onClick={() => void copy()}><Icon name="copy"/>Copy URL</button>
        {url && <a className="text-button" href={url} target="_blank" rel="noreferrer">Open Preview <Icon name="external"/></a>}
      </div>
    </div>
  </article>;
}
