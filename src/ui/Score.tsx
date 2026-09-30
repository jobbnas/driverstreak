import { useMemo } from 'preact/hooks';
import { fmt } from '@/format';

export function Score(props: { value: number; label?: string }) {
  const text = fmt(props.value);
  const chars = text.split('');
  const styles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        '--fx': `${(Math.sin(i * 1.7) * 1.2).toFixed(2)}px`,
        '--fy': `${(Math.cos(i * 2.3) * 2.2).toFixed(2)}px`,
        '--fr': `${(Math.sin(i * 0.9) * 0.6).toFixed(2)}deg`,
        '--dur': `${1800 + ((i * 137) % 700)}ms`,
        '--delay': `${(i * 211) % 900}ms`,
      })),
    [],
  );
  return (
    <div class="score" aria-live="off">
      <div class="score-digits" aria-label={`${text} ${props.label ?? 'poäng'}`}>
        {chars.map((c, i) => (
          <span class="score-digit" key={`${i}-${chars.length}`} style={styles[i % styles.length] as Record<string, string>}>
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </div>
      <p class="score-label">{props.label ?? 'poäng'}</p>
    </div>
  );
}
