import { useEffect, useRef } from 'preact/hooks';
import type { CountdownTimer } from '@/engine/timer';

/** Progress bar driven directly from the timer on each animation frame (no re-render). */
export function ProgressBar(props: { timer: CountdownTimer; active: boolean; tick?: (fraction: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const f = props.timer.hasStarted ? props.timer.fraction() : 1;
      const el = ref.current;
      if (el) {
        el.style.transform = `scaleX(${f})`;
        el.classList.toggle('low', f < 0.34 && f >= 0.15);
        el.classList.toggle('critical', f < 0.15);
      }
      props.tick?.(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [props.timer, props.active]);
  return (
    <div class="progress" role="progressbar" aria-label="Tid kvar">
      <div class="progress-fill" ref={ref} />
    </div>
  );
}
