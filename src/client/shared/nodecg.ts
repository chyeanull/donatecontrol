import { useEffect, useState } from 'react';
import type NodeCG from 'nodecg/types';
import { BUNDLE, defaults, type Commands, type Replicants } from '../../shared/models';

const replicas = new Map<string, NodeCG.ClientReplicant<unknown>>();
export function useReplicant<K extends keyof Replicants>(name: K): Replicants[K] {
  const [value, setValue] = useState<Replicants[K]>(defaults[name]);
  useEffect(() => {
    let rep = replicas.get(name);
    if (!rep) { rep = nodecg.Replicant<unknown>(name); replicas.set(name, rep); }
    const update = (next: unknown) => {
      if (next !== undefined) setValue(JSON.parse(JSON.stringify(next)) as Replicants[K]);
    };
    rep.on('change', update);
    update(rep.value);
    return () => { rep.removeListener('change', update); };
  }, [name]);
  return value;
}
export async function send<K extends keyof Commands>(name: K, data: Commands[K]): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disconnected: () => void = () => {};
  try {
    await Promise.race([
      nodecg.sendMessage(name, data),
      new Promise<never>((_, reject) => {
        disconnected = () => reject(new Error('Connection to NodeCG lost. Check campaign status after reconnecting before retrying this command.'));
        nodecg.socket.on('disconnect', disconnected);
        timer = setTimeout(() => reject(new Error('NodeCG has not acknowledged the command yet. It may still be processing; check campaign status before retrying.')), 90000);
      }),
    ]);
  } catch (error: unknown) {
    // NodeCG serializes server Errors into plain objects over the socket.
    if (error instanceof Error) throw error;
    const message = typeof error === 'string' ? error
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message
      : 'The command could not be completed. Try again.';
    throw new Error(message);
  } finally { clearTimeout(timer); nodecg.socket.off('disconnect', disconnected); }
}
interface NodeCGWindow extends Window { token?: string; ncgConfig?: { login?: { enabled?: boolean } } }
export function graphicUrl(file: 'thermometer' | 'alert'): string {
  return authenticatedUrl(`/bundles/${BUNDLE}/graphics/${file}.html`);
}
export function authenticatedUrl(path: string): string {
  const url = new URL(path, window.location.origin);
  const current = window as NodeCGWindow;
  const parent = window.top as NodeCGWindow | null;
  if (current.ncgConfig?.login?.enabled || parent?.ncgConfig?.login?.enabled) {
    const cookie = document.cookie.split('; ').find((part) => part.startsWith('socketToken='))?.split('=').slice(1).join('=');
    const token = parent?.token || current.token || (cookie ? decodeURIComponent(cookie) : '') || new URLSearchParams(window.location.search).get('key');
    if (!token) return '';
    url.searchParams.set('key', token);
  }
  return url.href;
}
export function useSocketConnected() {
  const [connected, setConnected] = useState(nodecg.socket.connected);
  useEffect(() => {
    const online = () => setConnected(true);
    const offline = () => setConnected(false);
    nodecg.socket.on('connect', online); nodecg.socket.on('disconnect', offline);
    // The socket can connect between React's first render and this effect.
    setConnected(nodecg.socket.connected);
    return () => { nodecg.socket.off('connect', online); nodecg.socket.off('disconnect', offline); };
  }, []);
  return connected;
}

export function useCampaignConnected() {
  const status = useReplicant('connectionStatus');
  const campaign = useReplicant('campaign');
  const online = useSocketConnected();
  return online && status.state === 'connected' && campaign.connected && Boolean(campaign.id);
}
