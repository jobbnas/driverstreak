const SHAPES = [
  { d: 'M24 6 L44 42 L4 42 Z' },
  { d: 'M24 4 A20 20 0 1 1 23.9 4 Z' },
  { d: 'M16 4 H32 L44 16 V32 L32 44 H16 L4 32 V16 Z' },
  { d: 'M24 4 L44 24 L24 44 L4 24 Z' },
  { d: 'M8 8 H40 V40 H8 Z' },
  { d: 'M24 44 L44 8 L4 8 Z' },
  { d: 'M24 8 A16 16 0 1 1 23.9 8 Z' },
  { d: 'M6 12 H42 V36 H6 Z' },
  { d: 'M10 6 H38 V42 H10 Z' },
  { d: 'M24 6 L44 42 L4 42 Z' },
];

const POS = [
  [14, 20], [32, 12], [56, 10], [78, 22], [86, 44], [72, 72], [50, 82], [28, 76], [10, 56], [40, 38],
];

export function FloatingShapes() {
  return (
    <div class="shapes" aria-hidden="true">
      {SHAPES.map((s, i) => {
        const [x, y] = POS[i] as [number, number];
        const style = {
          left: `${x}%`,
          top: `${y}%`,
          width: `${34 + ((i * 13) % 26)}px`,
          height: `${34 + ((i * 13) % 26)}px`,
          '--dx': `${((i % 3) - 1) * 14}px`,
          '--dy': `${((i % 4) - 2) * 10}px`,
          '--r0': `${(i * 23) % 40 - 20}deg`,
          '--r1': `${(i * 37) % 60 - 30}deg`,
          '--dur': `${3200 + ((i * 431) % 1800)}ms`,
          '--delay': `${-((i * 557) % 3000)}ms`,
        } as Record<string, string>;
        return (
          <svg key={i} class="shape" viewBox="0 0 48 48" style={style} fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">
            <path d={s.d} />
          </svg>
        );
      })}
    </div>
  );
}

export function Countdown(props: { n: number }) {
  return (
    <div class="countdown">
      <FloatingShapes />
      <p class="countdown-label">Gör dig redo!</p>
      <div class="countdown-number" key={props.n}>
        {props.n > 0 ? props.n : ''}
      </div>
    </div>
  );
}
