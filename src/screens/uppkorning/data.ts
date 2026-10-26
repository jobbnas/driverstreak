import sakRaw from '../../../content/uppkorning/sakerhetskontroll.json';
import uppsalaRaw from '../../../content/uppkorning/uppsala.json';
import provetRaw from '../../../content/uppkorning/provet.json';

export interface SakItem {
  id: string;
  group: string;
  title: string;
  how: string;
  why: string;
  fault: string;
}

export interface Hotspot {
  name: string;
  lat: number;
  lon: number;
  type: 'start' | 'rondell' | 'motorvag' | 'jarnvag' | 'parkering' | 'landsvag' | 'vandning' | 'tatort' | 'hogerregel';
  note: string;
}

export interface Loop {
  id: string;
  title: string;
  share: string;
  steps: string[];
  watch: string[];
}

export interface UppsalaGuide {
  office: { name: string; address: string; district: string; lat: number; lon: number; hours: string; notes: string[] };
  stats: { passRate: string; theory: string };
  start: { title: string; items: string[] };
  loops: Loop[];
  hotspots: Hotspot[];
  hazards: { title: string; text: string }[];
  tips: string[];
  sources: string[];
}

export interface Provet {
  intro: string;
  parts: { title: string; text: string }[];
  moments: { title: string; text: string }[];
  verdict: string[];
}

export const sakItems = sakRaw as SakItem[];
export const uppsala = uppsalaRaw as UppsalaGuide;
export const provet = provetRaw as Provet;

export const HOTSPOT_STYLE: Record<Hotspot['type'], { color: string; label: string }> = {
  start: { color: '#5dc98f', label: 'Start/mål' },
  rondell: { color: '#f5b942', label: 'Cirkulationsplats' },
  motorvag: { color: '#60a5fa', label: 'Påfart/trafikplats' },
  jarnvag: { color: '#ef4444', label: 'Järnvägskorsning' },
  parkering: { color: '#c084fc', label: 'Parkering/manöver' },
  landsvag: { color: '#a3e635', label: 'Landsväg' },
  vandning: { color: '#fb923c', label: 'Vändplats' },
  tatort: { color: '#f472b6', label: 'Tätort' },
  hogerregel: { color: '#facc15', label: 'Högerregel' },
};
