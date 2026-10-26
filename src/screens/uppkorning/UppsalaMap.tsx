import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HOTSPOT_STYLE, type Hotspot } from './data';

export function UppsalaMap(props: { hotspots: Hotspot[]; onSelect?: (h: Hotspot) => void; selected?: Hotspot }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef<Map<string, L.CircleMarker>>(new Map());

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, tap: false } as L.MapOptions).setView([59.885, 17.61], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    for (const h of props.hotspots) {
      const style = HOTSPOT_STYLE[h.type];
      const m = L.circleMarker([h.lat, h.lon], {
        radius: h.type === 'start' ? 10 : 8,
        color: '#111',
        weight: 1.5,
        fillColor: style.color,
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindTooltip(h.name, { direction: 'top', offset: [0, -8] });
      m.on('click', () => props.onSelect?.(h));
      markers.current.set(h.name, m);
    }
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.selected) return;
    map.flyTo([props.selected.lat, props.selected.lon], Math.max(map.getZoom(), 14), { duration: 0.6 });
    for (const [name, m] of markers.current) m.setStyle({ weight: name === props.selected.name ? 3 : 1.5, color: name === props.selected.name ? '#fff' : '#111' });
  }, [props.selected]);

  return <div ref={ref} class="map" role="img" aria-label="Karta över Uppsala med provrutter" />;
}
