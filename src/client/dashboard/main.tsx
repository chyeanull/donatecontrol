import { createRoot } from 'react-dom/client';
import { Dashboard } from './Dashboard';
import { DashboardToasts } from './notifications';
import './dashboard.css';
createRoot(document.getElementById('root')!).render(<><Dashboard /><DashboardToasts /></>);
