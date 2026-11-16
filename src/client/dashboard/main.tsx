import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Dashboard } from './Dashboard';
import { DashboardToasts } from './notifications';
import './dashboard.css';
// The initial navigation must exist before the browser captures a page transition.
flushSync(() => createRoot(document.getElementById('root')!).render(<><Dashboard /><DashboardToasts /></>));
