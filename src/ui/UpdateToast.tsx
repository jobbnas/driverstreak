import { applyUpdate, updateAvailable } from '@/pwa';

export function UpdateToast() {
  if (!updateAvailable.value) return null;
  return (
    <div class="toast" role="status">
      Ny version finns
      <button class="pill pill-small" style={{ background: 'var(--green)', color: 'var(--green-ink)' }} onClick={applyUpdate}>
        Uppdatera
      </button>
    </div>
  );
}
