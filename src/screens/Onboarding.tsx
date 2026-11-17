import { useState } from 'react';
import { actions } from '../core/db';
import { AGE_GROUPS } from '../core/difficulty';
import type { AgeGroup } from '../core/types';
import { STARTER_AVATARS } from '../core/worlds';
import { Avatar, useDB } from '../ui/ui';

export function ChildForm({ onDone, submitLabel = 'Next' }: { onDone: (name: string, age: AgeGroup) => void; submitLabel?: string }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState<AgeGroup | null>(null);
  return (
    <form className="col" style={{ gap: 18 }} onSubmit={(e) => { e.preventDefault(); if (name.trim() && age) onDone(name.trim(), age); }}>
      <div className="field">
        <label htmlFor="cname">Child’s first name or nickname</label>
        <input id="cname" className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav" autoComplete="off" />
        <span className="subtle">Only a first name or nickname — no surnames needed.</span>
      </div>
      <div className="field">
        <label>Age group</label>
        <div className="age-grid">
          {AGE_GROUPS.map((g) => (
            <button type="button" key={g.id} className={`age-card${age === g.id ? ' on' : ''}`} onClick={() => setAge(g.id)} aria-pressed={age === g.id}>
              <span style={{ fontSize: 40 }}>{g.emoji}</span>
              <b>{g.name}</b>
              <span className="subtle">{g.ages}</span>
            </button>
          ))}
        </div>
        <span className="subtle">This sets the starting point. Puzzles then adapt to how your child actually plays.</span>
      </div>
      <button className="btn purple lg block" disabled={!name.trim() || !age}>{submitLabel}</button>
    </form>
  );
}

export function AvatarPicker({ value, options, onPick }: { value: string | null; options: string[]; onPick: (a: string) => void }) {
  return (
    <div className="avatar-grid">
      {options.map((a) => (
        <button key={a} className={`avatar-opt${value === a ? ' on' : ''}`} onClick={() => onPick(a)} aria-label={`Avatar ${a}`} aria-pressed={value === a}>
          <Avatar face={a} size={72} />
        </button>
      ))}
    </div>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const db = useDB();
  const [step, setStep] = useState<'welcome' | 'parent' | 'child' | 'avatar'>(db.parent ? 'child' : 'welcome');
  const [p, setP] = useState({ name: '', email: '', pin: '', pin2: '' });
  const [child, setChild] = useState<{ name: string; age: AgeGroup } | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email);
  const pinOk = /^\d{4}$/.test(p.pin) && p.pin === p.pin2;

  return (
    <div className="page narrow onboard">
      {step === 'welcome' && (
        <div className="col center-text" style={{ gap: 20, paddingTop: '6vh' }}>
          <div className="logo-big" aria-hidden>🧩</div>
          <h1>Puzzle Quest</h1>
          <p className="muted" style={{ fontSize: 18 }}>An adventure of puzzles that grows with your child — jigsaws, shapes, numbers, memory, logic, patterns, stories and mazes.</p>
          <div className="card col" style={{ textAlign: 'left' }}>
            <div className="row"><span style={{ fontSize: 28 }}>🧠</span><span>Puzzles get easier or harder on their own, for each puzzle type.</span></div>
            <div className="row"><span style={{ fontSize: 28 }}>🔒</span><span>No ads, no chat, no links out. A grown-up PIN protects the settings.</span></div>
            <div className="row"><span style={{ fontSize: 28 }}>📈</span><span>See what your child is great at and what to practise.</span></div>
          </div>
          <button className="btn purple lg block" onClick={() => setStep('parent')}>Grown-up: let’s set up</button>
        </div>
      )}

      {step === 'parent' && (
        <div className="card pad-lg col" style={{ gap: 18 }}>
          <div><span className="chip purple">Step 1 of 3 · For grown-ups</span><h2 style={{ marginTop: 10 }}>Create your parent account</h2></div>
          <form className="col" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); if (p.name && emailOk && pinOk) { actions.signup(p.name.trim(), p.email.trim(), p.pin); setStep('child'); } }}>
            <div className="field"><label htmlFor="pname">Your name</label><input id="pname" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoComplete="name" /></div>
            <div className="field"><label htmlFor="pemail">Email</label><input id="pemail" type="email" className="input" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} autoComplete="email" /></div>
            <div className="row wrap" style={{ alignItems: 'flex-start' }}>
              <div className="field grow"><label htmlFor="pin1">Parent PIN (4 digits)</label><input id="pin1" className="input" inputMode="numeric" type="password" maxLength={4} value={p.pin} onChange={(e) => setP({ ...p, pin: e.target.value.replace(/\D/g, '') })} autoComplete="new-password" /></div>
              <div className="field grow"><label htmlFor="pin2">Repeat PIN</label><input id="pin2" className="input" inputMode="numeric" type="password" maxLength={4} value={p.pin2} onChange={(e) => setP({ ...p, pin2: e.target.value.replace(/\D/g, '') })} autoComplete="new-password" /></div>
            </div>
            {p.pin2.length === 4 && !pinOk && <span className="chip coral">PINs don’t match</span>}
            <p className="subtle">The PIN keeps the parent dashboard and settings away from little hands. Data stays on this device.</p>
            <button className="btn purple lg block" disabled={!p.name || !emailOk || !pinOk}>Continue</button>
          </form>
        </div>
      )}

      {step === 'child' && (
        <div className="card pad-lg col" style={{ gap: 18 }}>
          <div><span className="chip purple">Step 2 of 3</span><h2 style={{ marginTop: 10 }}>Add your child</h2></div>
          <ChildForm onDone={(name, age) => { setChild({ name, age }); setStep('avatar'); }} />
        </div>
      )}

      {step === 'avatar' && child && (
        <div className="card pad-lg col center-text" style={{ gap: 18 }}>
          <div><span className="chip purple">Step 3 of 3 · Hand the device to {child.name}</span><h2 style={{ marginTop: 10 }}>Hi {child.name}! Pick your buddy</h2></div>
          <AvatarPicker value={avatar} options={STARTER_AVATARS} onPick={setAvatar} />
          <button className="btn green lg block" disabled={!avatar} onClick={() => { actions.addChild(child.name, child.age, avatar!); onDone(); }}>Start the adventure! 🚀</button>
        </div>
      )}
    </div>
  );
}
