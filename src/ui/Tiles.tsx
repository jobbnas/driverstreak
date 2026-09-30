import type { Prompt } from '@/types';
import { signUrl } from '@/content';
import type { Feedback } from '@/engine/streakGame';

type Layout = 'circle' | 'square' | 'list';

export function layoutFor(prompt: Prompt): Layout {
  if (prompt.options.every((o) => o.image)) return 'circle';
  const longest = Math.max(...prompt.options.map((o) => o.label.length));
  return longest <= 28 ? 'square' : 'list';
}

export function Tiles(props: { prompt: Prompt; feedback?: Feedback; onAnswer: (i: number) => void }) {
  const layout = layoutFor(props.prompt);
  const fb = props.feedback;
  const cls = (i: number) => {
    const classes = ['tile'];
    if (layout === 'square') classes.push('tile-square');
    if (layout === 'list') classes.push('tile-row');
    if (fb) {
      if (i === props.prompt.correctIndex) classes.push('correct');
      else if (i === fb.chosen) classes.push('wrong');
      else classes.push('dim');
    }
    return classes.join(' ');
  };
  return (
    <div class={layout === 'list' ? 'tiles-list' : 'tiles'}>
      {props.prompt.options.map((o, i) => (
        <button
          key={`${props.prompt.qid}-${i}`}
          type="button"
          class={cls(i)}
          aria-label={o.label}
          disabled={!!fb}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            props.onAnswer(i);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') props.onAnswer(i);
          }}
        >
          <span class="tile-inner">
            {o.image ? <img src={signUrl(o.image)} alt="" draggable={false} decoding="async" /> : o.label}
          </span>
        </button>
      ))}
    </div>
  );
}
