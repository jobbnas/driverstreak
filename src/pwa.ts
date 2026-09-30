import { registerSW } from 'virtual:pwa-register';
import { signal } from '@preact/signals';

export const updateAvailable = signal(false);
let doUpdate: ((reload?: boolean) => Promise<void>) | undefined;

export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  doUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable.value = true;
    },
  });
}

export function applyUpdate(): void {
  void doUpdate?.(true);
}
