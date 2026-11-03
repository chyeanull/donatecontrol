import type { ReactNode } from 'react';
import type { DonationIconName } from '../../shared/models';

// A local set of donation symbols, drawn on the same 24px canvas and stroke.
const icons: Record<DonationIconName, ReactNode> = {
  heart: <path d="M20.5 5.5c-2-2-5.2-1.7-7.1.3L12 7.3l-1.4-1.5c-1.9-2-5.1-2.3-7.1-.3s-2 5.2.1 7.3L12 21l8.4-8.2c2.1-2.1 2.1-5.3.1-7.3Z"/>,
  smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14c1 4 7 4 8 0M8 8.5v1M16 8.5v1"/></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8.5A2.5 2.5 0 1 1 11 5.5L12 8Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5L12 8Z"/></>,
  'praying-hands': <><path d="m2 18 4 3 3-4-4-3-3 4Zm20 0-4 3-3-4 4-3 3 4ZM6 14l2-4 2-6c.5-1.5 2-1 2 .5V13l-3 4M18 14l-2-4-2-6c-.5-1.5-2-1-2 .5V13l3 4"/><path d="M8 11v3M16 11v3"/></>,
  'hand-heart': <><path d="m12 9-3-3a2.2 2.2 0 0 1 3-3.2A2.2 2.2 0 0 1 15 6l-3 3Z"/><path d="M2 13h4v8H2zM6 14l3-2h5a2 2 0 0 1 0 4h-3M6 20h9l6-5a1.7 1.7 0 0 0-2-2.5L15 15"/></>,
  handshake: <><path d="m2 8 3-3 5 2h4l5-2 3 3-3 7-2-1M5 5l4 5M19 5l-4 5-2-2-3 3a2 2 0 0 1-3-2l3-2M5 15l5 5a2 2 0 0 0 3 0l6-6M2 8l3 7 2-1M10 15l4 4M13 12l4 4"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
  ribbon: <><path d="M8 8c0-7 8-7 8 0 0 4-7 10-10 13l-1-5c4-3 10-7 10-10M9 6c0 4 6 8 10 10l-1 5c-3-3-10-9-10-13"/><path d="M9 5h6"/></>,
  coin: <><circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v12"/></>,
  sprout: <><path d="M12 21v-8M12 14C5 15 3 11 3 6c6 0 9 3 9 8ZM12 11c0-6 3-8 9-8 0 6-3 9-9 8ZM8 21h8"/></>,
};

export function DonationIcon({ name = 'heart', className = '' }: { name?: DonationIconName; className?: string }) {
  return <svg className={className} data-donation-icon={name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
