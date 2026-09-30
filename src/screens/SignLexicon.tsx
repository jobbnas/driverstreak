import { useMemo, useState } from 'preact/hooks';
import { BackHeader } from '@/ui/BackHeader';
import { signs, signUrl } from '@/content';
import { SIGN_CATEGORY_LABEL, type Sign, type SignCategory } from '@/types';

const ORDER: SignCategory[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'M', 'T', 'X', 'P', 'S'];

export function SignLexicon() {
  const [cat, setCat] = useState<SignCategory | 'alla'>('alla');
  const [qtext, setQ] = useState('');
  const [open, setOpen] = useState<Sign | undefined>();
  const present = useMemo(() => ORDER.filter((c) => signs.some((s) => s.category === c)), []);
  const list = useMemo(() => {
    const t = qtext.trim().toLowerCase();
    return signs.filter((s) => s.files.length > 0 && (cat === 'alla' || s.category === cat) && (!t || s.name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t)));
  }, [cat, qtext]);
  return (
    <div class="page">
      <BackHeader />
      <h1 class="page-title">Skyltlexikon</h1>
      <p class="page-subtitle">{signs.length} vägmärken och anordningar.</p>
      <input class="search" style={{ marginTop: 18 }} placeholder="Sök namn eller kod…" value={qtext} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="pill-row">
        <button class="pill pill-small" aria-pressed={cat === 'alla'} onClick={() => setCat('alla')}>Alla</button>
        {present.map((c) => (
          <button key={c} class="pill pill-small" aria-pressed={cat === c} onClick={() => setCat(c)}>{c} · {SIGN_CATEGORY_LABEL[c]}</button>
        ))}
      </div>
      <div class="sign-list" style={{ marginTop: 10 }}>
        {list.map((s) => (
          <button key={s.code} class="sign-card" onClick={() => setOpen(s)}>
            <img src={signUrl(s.files[0] as string)} alt="" loading="lazy" />
            <div class="name">{s.name}</div>
            <div class="code">{s.code}</div>
          </button>
        ))}
      </div>
      {open && (
        <div class="modal" onClick={() => setOpen(undefined)}>
          <div class="modal-card center" onClick={(e) => e.stopPropagation()}>
            <img src={signUrl(open.files[0] as string)} alt="" style={{ width: 140, height: 140, objectFit: 'contain' }} />
            <h3 style={{ marginTop: 10 }}>{open.name}</h3>
            <p class="muted" style={{ fontSize: 13 }}>{open.code} · {SIGN_CATEGORY_LABEL[open.category]}</p>
            <p style={{ marginTop: 12, lineHeight: 1.5 }}>{open.explanation}</p>
            <button class="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setOpen(undefined)}>Stäng</button>
          </div>
        </div>
      )}
    </div>
  );
}
