import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Sheet(props: { onClose?: () => void; children: ComponentChildren; label?: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={props.label}>
      {props.onClose && (
        <button class="icon-btn sheet-close" aria-label="Stäng" onClick={props.onClose}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      {props.children}
    </div>
  );
}
