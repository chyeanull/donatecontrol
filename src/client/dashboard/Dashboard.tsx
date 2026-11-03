import { MainPanel } from './MainPanel';
import { OverlaysPanel } from './OverlaysPanel';
import { AlertsPanel } from './AlertsPanel';
import { DonationsPanel } from './DonationsPanel';

export function Dashboard() {
  const file = window.location.pathname.split('/').pop();
  return file === 'overlays.html' ? <OverlaysPanel /> : file === 'alerts.html' ? <AlertsPanel /> : file === 'donations.html' ? <DonationsPanel /> : <MainPanel />;
}
