import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { Sheet } from '@/ui/Sheet';
import { navigate } from '@/router';
import { store } from '@/store';
import { fmt, fmtClock, haptic } from '@/format';
import { recordParkingAttempt } from '@/storage/stats';
import type { Scenario, SimState } from '@/engine/parking/types';
import { DEFAULT_CAR, wheelPositions } from '@/engine/parking/car';
import { runScript } from '@/engine/parking/script';
import { nextScenario } from '@/engine/parking/scenarios';
import { badgesEarned } from '@/engine/parking/feedback';
import { SceneHost } from './three/scene';
import { buildCar } from './three/carMesh';
import { buildWorld, buildGhost } from './three/world';
import { CameraRig, type View } from './three/cameras';
import { MirrorRig } from './three/mirrors';
import { useParkingSim, type Finish } from './useParkingSim';
import { SteeringWheel } from './SteeringWheel';
import { Pedals } from './Pedals';
import { ReportCard } from './ReportCard';

const VIEWS: View[] = ['chase', 'driver', 'top'];
const VIEW_LABEL: Record<View, string> = { chase: 'Bakom', driver: 'Förarvy', top: 'Ovanifrån' };

export function ParkeringSim(props: { scenario: Scenario }) {
  const sc = props.scenario;
  const settings = store.stats.value.settings;
  const [coaching, setCoaching] = useState(sc.rules.coachingAvailable);
  const [view, setView] = useState<View>(settings.parkingView);
  const [intro, setIntro] = useState(true);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [seed] = useState(() => Date.now() & 0xffff);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const coarse = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches, []);
  const [showTouch, setShowTouch] = useState(coarse);
  const recorded = useRef(false);

  const onFinish = (f: Finish, s: SimState) => {
    if (recorded.current) return;
    recorded.current = true;
    const stats = store.stats.value;
    const curbOk = f.outcome.pose?.curbDist !== undefined && sc.target?.curb ? f.outcome.pose.curbDist >= 0.1 && f.outcome.pose.curbDist <= 0.3 && f.stars >= 1 : undefined;
    const curbStreak = curbOk === undefined ? stats.parking.curbStreak : curbOk ? stats.parking.curbStreak + 1 : 0;
    const badges = badgesEarned({ scenarioId: sc.id, stars: f.stars, outcome: f.outcome, coaching, curbStreak, damageTotal: stats.parking.damageKr + f.damageKr }, stats.parking.badges);
    setNewBadges(badges);
    store.update((st) =>
      recordParkingAttempt(st, {
        scenarioId: sc.id,
        stars: f.stars,
        moves: s.moves,
        timeMs: f.outcome.timeMs,
        scratches: s.collisions.length,
        damageKr: f.damageKr,
        newBadges: badges,
        curbOk,
      }),
    );
    store.flush();
    if (f.stars === 3 && settings.haptics) haptic(12);
  };

  const api = useParkingSim(sc, coaching, onFinish);

  // --- three.js lifecycle ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const host = new SceneHost(canvas);
    const world = buildWorld(sc);
    host.scene.add(world.group);
    const car = buildCar(DEFAULT_CAR, 0x5dc98f, true);
    host.scene.add(car.group);
    const rig = new CameraRig();
    rig.view = view;
    const mirrors = new MirrorRig();
    let ghost: THREE.Group | undefined;
    const ghostPath = sc.script.length ? runScript(sc).path : [];
    const setGhost = (on: boolean) => {
      if (ghost) {
        world.ghost.remove(ghost);
        ghost = undefined;
      }
      if (on && ghostPath.length > 1) {
        ghost = buildGhost(ghostPath);
        world.ghost.add(ghost);
      }
    };
    setGhost(coaching);

    // tyre tracks
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.35, depthWrite: false });
    const tracks = new THREE.Group();
    host.scene.add(tracks);
    let lastTrack: { l: THREE.Vector2; r: THREE.Vector2 } | undefined;
    const trackMeshes: THREE.Mesh[] = [];

    let raf = 0;
    let last = performance.now();
    let cssW = 1;
    let cssH = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = Math.max(1, r.width);
      cssH = Math.max(1, r.height);
      host.resize(cssW, cssH);
      rig.setAspect(cssW / cssH);
      mirrors.layout(cssW, cssH);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const elapsed = now - last;
      last = now;
      const s = api.tick(elapsed, now);
      // car pose
      car.group.position.set(s.pose.x, 0, -s.pose.y);
      car.group.rotation.y = s.pose.heading;
      for (const w of car.frontWheels) w.rotation.y = s.steer;
      const spin = s.distance / 0.32;
      for (const w of car.wheels) w.rotation.z = -spin * Math.sign(s.v || 1);
      if (car.steeringWheel) car.steeringWheel.rotation.z = (-api.wheelDeg.current * Math.PI) / 180;
      car.brakeLights.emissive.setHex(api.input.current.brake ? 0xff2222 : 0x000000);
      car.brakeLights.emissiveIntensity = api.input.current.brake ? 1.2 : 0;
      car.reverseLights.emissive.setHex(s.gear === 'R' ? 0xffffff : 0x000000);
      car.reverseLights.emissiveIntensity = s.gear === 'R' ? 1.0 : 0;
      // tracks
      const wp = wheelPositions(s.pose, DEFAULT_CAR);
      const l = new THREE.Vector2(wp.rl.x, wp.rl.y);
      const r = new THREE.Vector2(wp.rr.x, wp.rr.y);
      if (!lastTrack) lastTrack = { l, r };
      else if (l.distanceTo(lastTrack.l) > 0.12) {
        for (const [a, b] of [[lastTrack.l, l], [lastTrack.r, r]] as [THREE.Vector2, THREE.Vector2][]) {
          const len = a.distanceTo(b);
          const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.004, 0.2), trackMat);
          m.position.set((a.x + b.x) / 2, 0.006, -(a.y + b.y) / 2);
          m.rotation.y = Math.atan2(b.y - a.y, b.x - a.x);
          tracks.add(m);
          trackMeshes.push(m);
        }
        while (trackMeshes.length > 1200) {
          const old = trackMeshes.shift() as THREE.Mesh;
          tracks.remove(old);
          old.geometry.dispose();
        }
        lastTrack = { l, r };
      }
      // cameras and shadows
      rig.view = viewRef.current;
      rig.lookBack = api.keys.current.has('b');
      rig.glance = api.keys.current.has('q') ? 1 : api.keys.current.has('e') ? -1 : 0;
      rig.overview = api.keys.current.has('c') || overviewRef.current;
      rig.update(s.pose, s.v, elapsed / 1000, { x: sc.world.w / 2, y: sc.world.h / 2 - 2 }, cssW / cssH);
      host.focusShadow(s.pose.x, -s.pose.y);
      if (shakeRef.current > 0) {
        rig.shake = shakeRef.current;
        shakeRef.current = 0;
      }
      if (rig.view === 'driver') {
        mirrors.showRear = s.gear === 'R';
        mirrors.layout(cssW, cssH);
        mirrors.update(s.pose);
        mirrors.render(host.renderer, host.scene, car.group);
      }
      host.renderer.render(host.scene, rig.active);
      if (rig.view === 'driver') mirrors.renderOverlay(host.renderer);
      host.noteFrame(now, cssW, cssH);
    };
    raf = requestAnimationFrame(frame);
    if (import.meta.env.DEV) (window as unknown as { __pk?: unknown }).__pk = api;

    const onVis = () => {
      if (document.visibilityState === 'visible') last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    const prevent = (e: Event) => e.preventDefault();
    root.addEventListener('touchmove', prevent, { passive: false });
    root.addEventListener('gesturestart', prevent);
    const unlock = () => api.audio.unlock();
    root.addEventListener('pointerdown', unlock);
    ghostSetter.current = setGhost;
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      root.removeEventListener('touchmove', prevent);
      root.removeEventListener('gesturestart', prevent);
      root.removeEventListener('pointerdown', unlock);
      mirrors.dispose();
      host.dispose();
    };
  }, [sc.id]);

  const viewRef = useRef<View>(view);
  viewRef.current = view;
  const overviewRef = useRef(false);
  const shakeRef = useRef(0);
  const ghostSetter = useRef<(on: boolean) => void>(() => undefined);

  useEffect(() => {
    ghostSetter.current(coaching);
  }, [coaching]);

  // collisions -> camera shake
  useEffect(() => {
    const t = api.toasts.value;
    if (t.length && t[t.length - 1]?.kind === 'bad' && store.stats.value.settings.reducedMotion !== 'on') shakeRef.current = 1;
  }, [api.toasts.value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'v') cycleView();
      if (k === 'm') toggleSound();
      if (k === 'h' && sc.rules.coachingAvailable) setCoaching((c) => !c);
      if (k === 'escape') navigate('/uppkorning/parkering');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  const cycleView = () => {
    const next = VIEWS[(VIEWS.indexOf(viewRef.current) + 1) % VIEWS.length] as View;
    setView(next);
    store.update((s) => ({ ...s, settings: { ...s.settings, parkingView: next } }));
  };
  const toggleSound = () => store.update((s) => ({ ...s, settings: { ...s.settings, sound: !s.settings.sound } }));

  const hud = api.hud.value;
  const finish = api.finish.value;
  const sound = store.stats.value.settings.sound;
  const next = nextScenario(sc.id);

  const again = () => {
    recorded.current = false;
    setNewBadges([]);
    api.reset();
  };

  return (
    <Sheet onClose={() => navigate('/uppkorning/parkering')} label={sc.title}>
      <div class={`pk-root${showTouch ? ' touch' : ''} view-${view}`} ref={rootRef} onPointerDown={(e) => { if (e.pointerType === 'touch' && !showTouch) setShowTouch(true); }}>
        <canvas class="pk-canvas" ref={canvasRef} />
        <div class="pk-top">
        <div class="pk-hud">
          <div class="pk-hud-left">
            <span class="pk-title">{sc.title}</span>
            <span class="pk-chip">{hud.gear}</span>
            <span class="pk-chip">{Math.round(hud.speedKmh)} km/h</span>
            <span class="pk-chip">Drag {hud.moves}{sc.rules.parMoves ? `/${sc.rules.parMoves}` : ''}</span>
            {hud.damageKr > 0 && <span class="pk-chip bad">{fmt(hud.damageKr)} kr</span>}
            <span class="pk-chip">{fmtClock(hud.clock * 1000)}</span>
          </div>
          <div class="pk-hud-right">
            <button class="pk-icon" onClick={cycleView} title="Vy (V)">{VIEW_LABEL[view]}</button>
            <button class="pk-icon" onPointerDown={() => (overviewRef.current = true)} onPointerUp={() => (overviewRef.current = false)} onPointerCancel={() => (overviewRef.current = false)} title="Kolla runt (C)">👀</button>
            <button class="pk-icon" onClick={toggleSound} title="Ljud (M)">{sound ? '🔊' : '🔇'}</button>
            {sc.rules.coachingAvailable && (
              <button class={`pk-icon${coaching ? ' on' : ''}`} onClick={() => setCoaching((c) => !c)} title="Coach (H)">Coach</button>
            )}
            <button class="pk-icon" onClick={again} title="Börja om (Backspace)">↺</button>
          </div>
        </div>
        {api.cue.value && coaching && <div class="pk-cue">{api.cue.value.text}</div>}
        </div>
        <div class="pk-sensors" aria-hidden="true">
          {hud.nearest < 1.2 && <span class={`pk-sensor ${hud.nearest < 0.4 ? 'red' : hud.nearest < 0.8 ? 'amber' : 'green'}`}>{hud.nearest.toFixed(1).replace('.', ',')} m</span>}
        </div>
        <div class="pk-toasts">
          {api.toasts.value.map((t) => (
            <div key={t.id} class={`pk-toast ${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
        {!showTouch && (
          <div class="pk-keys">
            <span>← → styr</span>
            <span>↑ gas · ↓/mellanslag broms</span>
            <span>R N D växel · X räta upp</span>
            <span>V vy · B titta bakåt · C överblick</span>
            <span>P klar · Backspace om</span>
          </div>
        )}
        {showTouch && (
          <div class="pk-controls">
            <SteeringWheel deg={hud.wheelDeg} onChange={(d) => api.setWheelDeg(d)} />
            <Pedals gear={hud.gear} onGear={api.setGear} onPedal={api.setTouchPedal} onDone={api.declareDone} canFinish={hud.stationary && hud.gear !== 'N' ? true : hud.stationary} />
          </div>
        )}
        {!showTouch && (
          <button class={`btn btn-primary pk-done-desktop${hud.stationary ? '' : ' hidden'}`} onClick={api.declareDone}>
            Klar (P)
          </button>
        )}
        {intro && (
          <div class="pk-intro" onClick={() => setIntro(false)}>
            <div class="pk-intro-card" onClick={(e) => e.stopPropagation()}>
              <p class="muted" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Övning {sc.order}</p>
              <h2 class="pk-report-title">{sc.emoji} {sc.title}</h2>
              <p class="uk-text">{sc.intro}</p>
              {sc.rules.coachingAvailable && (
                <label class="pk-check">
                  <input type="checkbox" checked={coaching} onChange={(e) => setCoaching((e.target as HTMLInputElement).checked)} /> Coach på (visar den ideala vägen och säger till när du ska svänga)
                </label>
              )}
              <p class="muted" style={{ fontSize: 13, marginTop: 10 }}>
                {coarse ? 'Dra i ratten, håll gas/broms, välj växel. Tryck Klar när du står still.' : 'Piltangenter styr och gasar, R/N/D växlar, X rätar upp ratten, P när du är klar. V byter vy.'}
              </p>
              <button class="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setIntro(false); api.audio.unlock(); }}>
                Kör
              </button>
            </div>
          </div>
        )}
        {finish && (
          <ReportCard scenario={sc} finish={finish} newBadges={newBadges} seed={seed} onAgain={again} onNext={next ? () => navigate(`/uppkorning/parkering/${next.id}`) : undefined} onList={() => navigate('/uppkorning/parkering')} />
        )}
      </div>
    </Sheet>
  );
}
