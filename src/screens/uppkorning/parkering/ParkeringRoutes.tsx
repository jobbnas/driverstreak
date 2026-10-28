import { lazy, Suspense } from 'preact/compat';
import { route } from '@/router';
import { scenarioById } from '@/engine/parking/scenarios';
import { ParkeringList } from './ParkeringList';
import '@/styles/parkering.css';

const ParkeringSim = lazy(() => import('./ParkeringSim').then((m) => ({ default: m.ParkeringSim })));

export function ParkeringRoutes() {
  const id = route.value.parts[2];
  const sc = id ? scenarioById(id) : undefined;
  if (!sc) return <ParkeringList />;
  return (
    <Suspense fallback={<div class="page"><p class="empty">Laddar simulatorn…</p></div>}>
      <ParkeringSim scenario={sc} key={sc.id} />
    </Suspense>
  );
}
