export function fmt(n: number): string {
  return Math.round(n).toLocaleString('sv-SE');
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function haptic(pattern: number | number[] = 10): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
