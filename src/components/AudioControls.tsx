// src/components/AudioControls.tsx

import React from 'react';
import { Volume2, VolumeX, Music, ShieldAlert, Sparkles, Settings } from 'lucide-react';

interface AudioControlsProps {
  musicOn: boolean;
  sfxOn: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  isMature: boolean;
  onOpenSettings: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  musicOn,
  sfxOn,
  onToggleMusic,
  onToggleSfx,
  isMature,
  onOpenSettings,
}) => {
  return (
    <div className="absolute top-4 right-4 z-30 flex items-center gap-3">
      {/* Mode Badge */}
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-medium text-purple-200">
        {isMature ? (
          <>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-300 font-bold">18+</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>SFW</span>
          </>
        )}
      </div>

      {/* Audio Equalizer Decor & Music Toggle */}
      <button
        onClick={onToggleMusic}
        title={musicOn ? 'Mute Music' : 'Unmute Music'}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all text-xs text-purple-200 group"
      >
        <Music className={`w-3.5 h-3.5 ${musicOn ? 'text-fuchsia-400 animate-pulse' : 'text-zinc-500'}`} />
        <span className="hidden md:inline">Music</span>
        
        {/* Animated Equalizer */}
        {musicOn && (
          <div className="flex items-end gap-0.5 h-3 w-3 motion-reduce:hidden">
            <span className="w-0.5 bg-fuchsia-400 rounded-full animate-[bounce_1s_infinite_100ms]" style={{ height: '100%' }} />
            <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_300ms]" style={{ height: '70%' }} />
            <span className="w-0.5 bg-pink-400 rounded-full animate-[bounce_1s_infinite_200ms]" style={{ height: '90%' }} />
          </div>
        )}
      </button>

      {/* SFX Toggle */}
      <button
        onClick={onToggleSfx}
        title={sfxOn ? 'Mute SFX' : 'Unmute SFX'}
        className="p-2 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all text-purple-200"
      >
        {sfxOn ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
      </button>

      {/* Settings Button */}
      <button
        onClick={onOpenSettings}
        title="Open Settings"
        className="p-2 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all text-purple-200 hover:text-fuchsia-300"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
};