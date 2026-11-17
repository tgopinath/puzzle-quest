import { useEffect, useState } from 'react';
import { sfx, speak } from '../audio';
import type { ChoiceData } from '../core/generators';
import { ItemView } from '../ui/ui';
import type { GameApi } from './shared';

/** Multiple-choice rounds: used by Pattern, Number and Logic puzzles. */
export default function Choice({ data, api, audio }: { data: ChoiceData; api: GameApi; audio: boolean }) {
  const [round, setRound] = useState(0);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const [right, setRight] = useState<string | null>(null);
  const r = data.rounds[round];

  useEffect(() => {
    if (!audio) return;
    const math = r.prompt.includes('=');
    speak(math ? r.prompt.replace(/\?/g, 'what').replace('=', 'equals').replace('−', 'minus').replace('×', 'times') : r.prompt);
  }, [r, audio]);

  useEffect(() => {
    if (!api.hintTick) return;
    const wrongOpts = r.options.filter((o) => o.key !== r.answer && !eliminated.has(o.key) && !wrong.has(o.key));
    if (wrongOpts.length > 0) setEliminated((e) => new Set(e).add(wrongOpts[0].key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.hintTick]);

  const choose = (key: string) => {
    if (api.paused || right) return;
    if (key === r.answer) {
      sfx.place();
      setRight(key);
      api.progress(round + 1, data.rounds.length);
      setTimeout(() => {
        if (round + 1 >= data.rounds.length) api.solved();
        else { setRound(round + 1); setWrong(new Set()); setEliminated(new Set()); setRight(null); }
      }, r.explain ? 1500 : 800);
    } else {
      sfx.wrong();
      api.mistake();
      setWrong((w) => new Set(w).add(key));
    }
  };

  const answerItem = r.options.find((o) => o.key === r.answer)!;
  return (
    <div className="choice">
      <div className="choice-round subtle">Puzzle {round + 1} of {data.rounds.length}</div>
      <h2 className="choice-prompt">{r.prompt}</h2>
      {r.sequence && (
        <div className="choice-seq" aria-label="Sequence">
          {r.sequence.map((it, i) => (
            <div key={i} className={`seq-cell${it ? '' : ' hole'}${!it && right ? ' filled' : ''}`}>
              {it ? <ItemView item={it} /> : right ? <ItemView item={answerItem} /> : <span className="q">?</span>}
            </div>
          ))}
        </div>
      )}
      {r.visual && (
        <div className="choice-visual" aria-label="Picture">
          {r.visual.map((it) => <span key={it.key} className="vis-item"><ItemView item={it} size={it.text ? 40 : 52} /></span>)}
        </div>
      )}
      <div className="choice-opts">
        {r.options.map((o) => (
          <button
            key={o.key}
            className={`opt${wrong.has(o.key) ? ' wrong shake' : ''}${right === o.key ? ' right' : ''}${eliminated.has(o.key) ? ' gone' : ''}`}
            onClick={() => choose(o.key)}
            disabled={wrong.has(o.key) || eliminated.has(o.key)}
            aria-label={o.label}
          >
            <ItemView item={o} size={o.text && o.text.length > 3 ? 44 : 60} />
          </button>
        ))}
      </div>
      {right && r.explain && <p className="choice-explain">💡 {r.explain}</p>}
      {api.guidance === 'strong' && !right && wrong.size > 0 && <p className="choice-explain">Try another one — you can do it!</p>}
    </div>
  );
}
