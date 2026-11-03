// NodeCG alphabetizes native workspace labels. Keep the sort prefixes and the
// standalone navigation in one ordered definition so Main always comes first.
export const dashboardPages = [
  { id: 'main', panel: 'control', order: '01', label: 'Main', title: 'Campaign overview', description: 'Monitor your campaign and connect your provider.' },
  { id: 'overlays', panel: 'overlays', order: '02', label: 'Your overlays', title: 'Your overlays', description: 'Choose a theme, preview your graphics, and get your broadcast ready.' },
  { id: 'alerts', panel: 'alerts', order: '03', label: 'Alert Settings', title: 'Alert Settings', description: 'Manage the queue. Dial in the timing. Make every donation heard.' },
  { id: 'donations', panel: 'donations', order: '04', label: 'Donation List & Alerts', title: 'Donation List & Alerts', description: 'Review every donation, edit its alert text, and choose when it goes on screen.' },
] as const;
export type DashboardPage = typeof dashboardPages[number]['id'];
