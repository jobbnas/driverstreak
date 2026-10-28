import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { Gear, Scenario, SimEvent, SimInput, SimState } from '@/engine/parking/types';
import { createSim, advance, cornersInsideChalk, type Sim } from '@/engine/parking/sim';
import { createCoach, coachStep, type CoachState, type Cue } from '@/engine/parking/coach';
import { outcomeOf, stars as starsOf, type Outcome } from '@/engine/parking/scoring';
import { damageOf } from '@/engine/parking/feedback';
import { haptic } from '@/format';
import { store } from '@/store';
import { ParkingAudio } from './audio';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'warn' | 'bad';
}

export interface Finish {
  outcome: Outcome;
  stars: 0 | 1 | 2 | 3;
  damageKr: number;
}

const WHEEL_MAX_DEG = 450;
const WHEEL_KEY_RATE = 420; // deg/s

export function useParkingSim(scenario: Scenario, coachingOn: boolean, onFinish: (f: Finish, state: SimState) => void) {
  const sim = useRef<Sim>(createSim(scenario));
  const coach = useRef<CoachState | undefined>(coachingOn && scenario.coach !== 'none' ? createCoach(scenario) : undefined);
  const audio = useMemo(() => new ParkingAudio(), []);
  const input = useRef<SimInput>({ steer: 0, throttle: 0, brake: 0, gear: 'N' });
  const wheelDeg = useRef(0);
  const keys = useRef<Set<string>>(new Set());
  const finished = useRef(false);

  const state = useSignal<SimState>(sim.current.state);
  const cue = useSignal<Cue | undefined>(undefined);
  const toasts = useSignal<Toast[]>([]);
  const finish = useSignal<Finish | undefined>(undefined);
  const hud = useSignal({ speedKmh: 0, gear: 'N' as Gear, moves: 0, damageKr: 0, clock: 0, wheelDeg: 0, stationary: true, nearest: Infinity });
  const toastId = useRef(0);
  const lastHud = useRef(0);

  const pushToast = (text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    toasts.value = [...toasts.value.slice(-1), { id, text, kind }];
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 2800);
  };

  const handleEvents = (events: SimEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case 'collision': {
          const hard = e.hit.severity === 'bumper';
          audio.crunch(hard);
          if (store.stats.value.settings.haptics) haptic(hard ? [40, 30, 60] : [30, 40, 30]);
          const name = e.hit.kind === 'curb' ? 'kantstenen' : e.hit.kind === 'cone' ? 'en kon' : e.hit.kind === 'cart' ? 'kundvagnen' : 'grannbilen';
          const cost = e.hit.kind === 'cone' && !scenario.rules.coneIsScratch ? '' : hard ? ' · 9 000 kr' : ' · 3 500 kr';
          pushToast(`Kontakt med ${name}${cost}`, 'bad');
          break;
        }
        case 'gearRefused':
          pushToast('Stanna innan du växlar.', 'warn');
          break;
        case 'overspeed':
          pushToast('Parkering, inte Mantorp. Sakta ner.', 'warn');
          break;
        case 'fail':
          pushToast('Tre kontakter – försöket avbryts.', 'bad');
          break;
        default:
          break;
      }
    }
  };

  const endAttempt = (asFinished: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const s = sim.current.state;
    s.finishedAt = s.t;
    if (scenario.rules.coneStars && asFinished && !cornersInsideChalk(sim.current)) asFinished = false;
    const outcome = outcomeOf(s, scenario, sim.current.spec, asFinished);
    const st = starsOf(outcome, scenario);
    const f: Finish = { outcome, stars: st, damageKr: damageOf(s.collisions, scenario) };
    finish.value = f;
    if (st === 3) audio.chime();
    onFinish(f, s);
  };

  /** "Klar (P)" pressed. */
  const declareDone = () => {
    const s = sim.current.state;
    if (Math.abs(s.v) > 0.05) return;
    if (scenario.target && !s.inTarget) {
      pushToast('Inte riktigt där än. Fortsätt.', 'warn');
      return;
    }
    if (scenario.rules.coneStars && !cornersInsideChalk(sim.current)) {
      pushToast('Hela bilen ska stå i kritrutan.', 'warn');
      return;
    }
    endAttempt(true);
  };

  const setGear = (g: Gear) => {
    input.current.gear = g;
  };
  const setWheelDeg = (d: number) => {
    wheelDeg.current = Math.max(-WHEEL_MAX_DEG, Math.min(WHEEL_MAX_DEG, d));
    input.current.steer = -wheelDeg.current / WHEEL_MAX_DEG; // wheel clockwise (+) = steer right (engine negative)
  };
  const setPedal = (which: 'throttle' | 'brake', on: boolean) => {
    input.current[which] = on ? 1 : 0;
  };

  const reset = () => {
    sim.current = createSim(scenario);
    coach.current = coachingOn && scenario.coach !== 'none' ? createCoach(scenario) : undefined;
    finished.current = false;
    finish.value = undefined;
    cue.value = undefined;
    input.current = { steer: 0, throttle: 0, brake: 0, gear: 'N' };
    wheelDeg.current = 0;
    state.value = sim.current.state;
  };

  /** Called once per animation frame by the renderer. Returns true if a physics step happened. */
  const tick = (elapsedMs: number, now: number): SimState => {
    // keyboard steering ramp
    const dtS = Math.min(elapsedMs, 100) / 1000;
    const k = keys.current;
    if (k.has('ArrowLeft')) setWheelDeg(wheelDeg.current - WHEEL_KEY_RATE * dtS);
    if (k.has('ArrowRight')) setWheelDeg(wheelDeg.current + WHEEL_KEY_RATE * dtS);
    input.current.throttle = pedalTouch.current.throttle || k.has('ArrowUp') || k.has('w') ? 1 : 0;
    input.current.brake = pedalTouch.current.brake || k.has('ArrowDown') || k.has('s') || k.has(' ') ? 1 : 0;

    if (!finished.current) {
      const events = advance(sim.current, input.current, elapsedMs);
      if (events.length) handleEvents(events);
      if (coach.current) {
        const c = coachStep(coach.current, sim.current);
        coach.current = c.state;
        if (c.cue) {
          cue.value = c.cue;
          if (store.stats.value.settings.haptics) haptic(8);
        }
        if (c.warning) pushToast(c.warning, 'warn');
      }
      if (sim.current.state.failed) endAttempt(false);
    }
    const s = sim.current.state;
    const travelDir = s.v > 0.02 ? 'front' : s.v < -0.02 ? 'rear' : undefined;
    const nearest = travelDir ? s.sensors[travelDir].d : Math.min(s.sensors.front.d, s.sensors.rear.d, s.sensors.left.d, s.sensors.right.d);
    audio.proximity(travelDir ? nearest : Infinity, now);
    if (now - lastHud.current > 100) {
      lastHud.current = now;
      hud.value = {
        speedKmh: Math.abs(s.v) * 3.6,
        gear: s.gear,
        moves: s.moves,
        damageKr: damageOf(s.collisions, scenario),
        clock: s.startedMoving === undefined ? 0 : (s.finishedAt ?? s.t) - s.startedMoving,
        wheelDeg: wheelDeg.current,
        stationary: Math.abs(s.v) < 0.05,
        nearest,
      };
      state.value = s;
    }
    return s;
  };

  const pedalTouch = useRef({ throttle: false, brake: false });
  const setTouchPedal = (which: 'throttle' | 'brake', on: boolean) => {
    pedalTouch.current[which] = on;
    if (which === 'throttle') input.current.throttle = on ? 1 : 0;
    else input.current.brake = on ? 1 : 0;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) e.preventDefault();
      keys.current.add(key);
      audio.unlock();
      if (key === 'r') setGear('R');
      if (key === 'n') setGear('N');
      if (key === 'd') setGear('D');
      if (key === 'x') setWheelDeg(0);
      if (key === 'Enter' || key === 'p') declareDone();
      if (key === 'Backspace') reset();
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current.delete(key);
    };
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      audio.dispose();
    };
  }, []);

  useEffect(() => {
    audio.setMuted(!store.stats.value.settings.sound);
  }, [store.stats.value.settings.sound]);

  return { sim, state, hud, cue, toasts, finish, tick, setGear, setWheelDeg, setPedal, setTouchPedal, declareDone, reset, audio, keys, wheelDeg, input };
}

export type ParkingSimApi = ReturnType<typeof useParkingSim>;
