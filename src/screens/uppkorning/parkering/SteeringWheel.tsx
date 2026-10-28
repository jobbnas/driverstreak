import { useRef } from 'preact/hooks';
import { haptic } from '@/format';

const MAX = 450;

/** Draggable steering wheel: holds its angle on release, snaps to lock with a tick. Double tap centres. */
export function SteeringWheel(props: { deg: number; onChange: (deg: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; lastAng: number } | null>(null);
  const lastTap = useRef(0);

  const angleAt = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, lastAng: angleAt(e) };
    const now = performance.now();
    if (now - lastTap.current < 300) props.onChange(0);
    lastTap.current = now;
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const a = angleAt(e);
    let delta = a - drag.current.lastAng;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.current.lastAng = a;
    const next = Math.max(-MAX, Math.min(MAX, props.deg + delta));
    if ((next === MAX || next === -MAX) && Math.abs(props.deg) < MAX) haptic(8);
    props.onChange(next);
  };
  const onUp = (e: PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const label = Math.abs(props.deg) < 8 ? 'Rakt' : `${Math.abs(Math.round((props.deg / MAX) * 35))}° ${props.deg > 0 ? 'höger' : 'vänster'}${Math.abs(props.deg) >= MAX - 1 ? ' (fullt)' : ''}`;
  return (
    <div class="pk-wheel-wrap">
      <div class="pk-wheel" ref={ref} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="slider" aria-label="Ratt" aria-valuenow={Math.round(props.deg)}>
        <svg viewBox="0 0 100 100" style={{ transform: `rotate(${props.deg}deg)` }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="#2b2c2e" stroke-width="11" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#5a5c60" stroke-width="2" />
          <path d="M50 50 L50 10 M50 50 L16 72 M50 50 L84 72" stroke="#3a3b3d" stroke-width="9" stroke-linecap="round" />
          <circle cx="50" cy="50" r="12" fill="#3a3b3d" />
          <circle cx="50" cy="12" r="4" fill="#5dc98f" />
        </svg>
      </div>
      <p class="pk-wheel-label">{label}</p>
    </div>
  );
}
