import { useState } from 'preact/hooks';

export function ReportButton(props: { qid: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    const text = `DriverStreak felrapport: ${props.qid}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button class="pill pill-small" style={{ marginTop: 10, opacity: 0.8 }} onClick={copy}>
      {done ? 'Fråge-id kopierat' : `Rapportera fel (${props.qid})`}
    </button>
  );
}
