import { createStore } from '@/storage/store';

export const store = createStore();

export function applyMotionSetting(): void {
  const m = store.stats.value.settings.reducedMotion;
  document.documentElement.dataset.motion = m;
}
