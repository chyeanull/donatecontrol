import { useState, type ReactNode } from 'react';
import { BrandIcon } from './BrandIcon';
import { DashboardNavigation } from './DashboardNavigation';
import { send, useCampaignConnected, useReplicant, useSocketConnected } from '../shared/nodecg';
import { providerNames, type Commands } from '../../shared/models';
import { dashboardPages, type DashboardPage } from '../../shared/dashboard';
import { commandConfirmation, notify } from './notifications';

export function Icon({ name }: { name: 'copy' | 'external' | 'play' | 'refresh' | 'link' | 'activity' | 'monitor' }) {
  const paths = {
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/></>,
    external: <><path d="M14 3h7v7M21 3 10 14"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
    play: <path d="m8 4 12 8-12 8Z"/>,
    refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
    link: <><path d="m9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 0-6-6L7 5" transform="translate(2 2)"/></>,
    activity: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function SectionTitle({ step, title, children }: { step: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><h2><span className="step">{step}</span>{title}</h2>{children}</div>;
}

export function useControls() {
  const status = useReplicant('connectionStatus');
  const settings = useReplicant('settings');
  const online = useSocketConnected();
  const connected = useCampaignConnected();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <K extends keyof Commands>(name: K, data: Commands[K], success?: string) => {
    setBusy(name);
    try { await send(name, data); notify.success(success ?? commandConfirmation(name)); return true; }
    catch (error: unknown) { notify.error(error instanceof Error ? error.message : 'The command could not be completed. Try again.'); return false; }
    finally { setBusy(null); }
  };
  return { status, settings, online, connected, busy, setBusy, run, disabled: Boolean(busy) || !online };
}
export function PanelLayout({ page, controls, children }: { page: DashboardPage; controls: ReturnType<typeof useControls>; children: ReactNode }) {
  const { status, online, connected } = controls;
  const campaign = useReplicant('campaign');
  const standalone = window.self === window.top;
  const currentPage = dashboardPages.find((item) => item.id === page)!;
  const connectionLabel = !online ? 'Server offline'
    : status.state === 'disconnected' ? 'No provider connected'
    : `${providerNames[status.provider]} · ${status.state === 'error' ? 'Connection error' : status.state}`;
  return <>
    <header className="connection-bar" aria-label="Campaign connection">
      {connected && <span className="connection-bar-title" title={campaign.title}>{campaign.title}</span>}
      <span className={`status-pill ${online ? status.state : 'error'}`} role="status"><i aria-hidden="true"/>{connectionLabel}</span>
    </header>
    <main className={`app page-${page}`} id="overview" aria-label={currentPage.title}>
    {standalone && <DashboardNavigation page={page}/>}
    {children}
    <footer className="app-footer">
      <a className="brand" href="#overview"><span className="brand-symbol"><BrandIcon/></span><span>DONATECONTROL</span></a>
      <small className="footer-credit">made by <a href="https://roberthilsky.com" target="_blank" rel="noopener noreferrer">roberthilsky.com</a></small>
    </footer>
    </main>
  </>;
}
