import { useEffect, useRef, type CSSProperties } from 'react';
import { Toaster, toast } from 'sonner';
import { useReplicant } from '../shared/nodecg';
import type { Commands } from '../../shared/models';
import './notifications.css';

export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message, { id: `error:${message}`, duration: 8000 }),
};

const confirmations: Record<keyof Commands, string> = {
  connect: 'Campaign connected.', refresh: 'Campaign refreshed.', disconnect: 'Campaign disconnected.',
  saveSettings: 'Broadcast settings saved.', testAlert: 'Test alert queued.', clearQueue: 'Playback queue cleared.',
  dismissAlert: 'Current alert dismissed.', resendDonation: 'Donation alert queued again.', sendDonation: 'Donation alert queued for screen.',
  editDonation: 'Donation text saved.', resetDonation: 'Original donation name and text restored.',
  setManualAlertControl: 'Alert delivery mode updated.', saveAlertSound: 'Sound settings saved.',
  saveOverlayAppearance: 'Overlay appearance saved.', editMock: 'Demo campaign updated.',
  addMockDonation: 'Demo donation added.', resetMock: 'Demo campaign reset.',
};
export const commandConfirmation = (name: keyof Commands) => confirmations[name];

/** One notification host per dashboard document, including native NodeCG frames. */
export function DashboardToasts() {
  const connection = useReplicant('connectionStatus');
  const previousError = useRef('');
  useEffect(() => {
    const message = connection.state === 'error' ? connection.message : '';
    if (message && message !== previousError.current) notify.error(message);
    if (connection.state === 'connected' && previousError.current) notify.success('Campaign connection restored.');
    previousError.current = message;
  }, [connection.state, connection.message]);

  useEffect(() => {
    let disconnected = false;
    const offline = () => {
      disconnected = true;
      toast.error('Connection to NodeCG lost.', { id: 'nodecg-connection', duration: Infinity,
        description: 'Controls will return when the server reconnects. Campaign data is hidden while disconnected.' });
    };
    const online = () => {
      if (disconnected) toast.success('Connection to NodeCG restored.', { id: 'nodecg-connection', duration: 5000, description: 'Dashboard controls are available again.' });
      disconnected = false;
    };
    nodecg.socket.on('disconnect', offline);
    nodecg.socket.on('connect', online);
    return () => { nodecg.socket.off('disconnect', offline); nodecg.socket.off('connect', online); };
  }, []);

  return <Toaster className="dashboard-toaster" theme="dark" position="top-center" richColors closeButton
    duration={5000} visibleToasts={3} offset={24} mobileOffset={16}
    style={{ '--border-radius': '4px' } as CSSProperties}
    toastOptions={{ style: { fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', lineHeight: '1.5' } }} />;
}
