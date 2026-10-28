import type { Gear } from '@/engine/parking/types';

export function Pedals(props: { gear: Gear; onGear: (g: Gear) => void; onPedal: (which: 'throttle' | 'brake', on: boolean) => void; onDone: () => void; canFinish: boolean }) {
  const hold = (which: 'throttle' | 'brake') => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      props.onPedal(which, true);
    },
    onPointerUp: () => props.onPedal(which, false),
    onPointerCancel: () => props.onPedal(which, false),
    onLostPointerCapture: () => props.onPedal(which, false),
  });
  return (
    <div class="pk-pedals">
      <div class="pk-gear" role="radiogroup" aria-label="Växel">
        {(['R', 'N', 'D'] as Gear[]).map((g) => (
          <button key={g} class={`pk-gear-btn${props.gear === g ? ' on' : ''}`} role="radio" aria-checked={props.gear === g} onClick={() => props.onGear(g)}>
            {g}
          </button>
        ))}
      </div>
      <div class="pk-pedal-row">
        <button class="pk-pedal brake" {...hold('brake')} aria-label="Broms">
          Broms
        </button>
        <button class="pk-pedal gas" {...hold('throttle')} aria-label="Gas">
          Gas
        </button>
      </div>
      <button class={`btn btn-primary pk-done${props.canFinish ? '' : ' disabled'}`} disabled={!props.canFinish} onClick={props.onDone}>
        Klar (P)
      </button>
    </div>
  );
}
