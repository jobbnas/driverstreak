import type { ComponentChildren } from 'preact';
import { navigate } from '@/router';

export function BackHeader(props: { to?: string; onBack?: () => void; children?: ComponentChildren; title?: string }) {
  return (
    <header class="page-header">
      <button class="icon-btn" aria-label="Tillbaka" onClick={props.onBack ?? (() => navigate(props.to ?? '/'))}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      {props.title && <h2 style={{ fontSize: 18, fontWeight: 800 }}>{props.title}</h2>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>{props.children}</div>
    </header>
  );
}
