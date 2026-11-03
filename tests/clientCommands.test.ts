import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { send } from '../src/client/shared/nodecg';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('preserves serialized server validation messages for error toasts and cleans up request listeners', async () => {
  vi.useFakeTimers();
  const socket = new EventEmitter();
  vi.stubGlobal('nodecg', { socket, sendMessage: vi.fn().mockRejectedValue({ name: 'Error', message: 'Enter a valid donor name.' }) });
  await expect(send('resetDonation', { entryId: 'missing' })).rejects.toThrow('Enter a valid donor name.');
  expect(socket.listenerCount('disconnect')).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects commands on lost connections and releases their timeout and socket listener', async () => {
  vi.useFakeTimers();
  const socket = new EventEmitter();
  vi.stubGlobal('nodecg', { socket, sendMessage: () => new Promise(() => {}) });
  const pending = send('refresh', undefined);
  const rejected = expect(pending).rejects.toThrow('Connection to NodeCG lost.');
  socket.emit('disconnect');
  await rejected;
  expect(socket.listenerCount('disconnect')).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
