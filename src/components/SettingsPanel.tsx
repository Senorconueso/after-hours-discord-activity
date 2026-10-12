import React from 'react';

export default function SettingsPanel({
  musicEnabled,
  sfxEnabled,
  musicVolume,
  sfxVolume,
  reducedMotion,
  onMusicEnabled,
  onSfxEnabled,
  onMusicVolume,
  onSfxVolume,
  onReducedMotion,
  onTestSound,
  onBack,
}) {
  return (
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-6">
      <div className="glass-panel w-full max-w-xl rounded-[2rem] p-6 md:p-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-pink-300">After Hours Control Booth</p>
            <h2 className="mt-2 text-3xl font-black text-white">Settings</h2>
            <p className="mt-1 text-sm text-slate-400">Tune the room without changing the game.</p>
          </div>
          <button onClick={onBack} className="club-small-button" aria-label="Return to main menu">← Back</button>
        </div>

        <SettingToggle label="Music" description="Procedural deep-house ambience generated in the browser." checked={musicEnabled} onChange={onMusicEnabled} />
        <VolumeControl label="Music volume" value={musicVolume} onChange={onMusicVolume} disabled={!musicEnabled} />

        <div className="my-5 h-px bg-white/10" />

        <SettingToggle label="Sound effects" description="Dice, movement ticks, card reveals, landings, and wins." checked={sfxEnabled} onChange={onSfxEnabled} />
        <VolumeControl label="SFX volume" value={sfxVolume} onChange={onSfxVolume} disabled={!sfxEnabled} />

        <div className="my-5 h-px bg-white/10" />

        <SettingToggle label="Reduced motion" description="Stops ambient movement and shortens board animations." checked={reducedMotion} onChange={onReducedMotion} />

        <button onClick={onTestSound} disabled={!sfxEnabled} className="mt-7 w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 font-bold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40">
          Test sound
        </button>
      </div>
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <span>
        <span className="block font-bold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-400">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-pink-500' : 'bg-slate-700'}`}>
        <input className="sr-only" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </label>
  );
}

function VolumeControl({ label, value, onChange, disabled }) {
  return (
    <label className={`mt-3 block rounded-2xl border border-white/10 bg-black/20 p-4 ${disabled ? 'opacity-40' : ''}`}>
      <span className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </span>
      <input
        className="accent-pink-500 w-full"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  );
}
