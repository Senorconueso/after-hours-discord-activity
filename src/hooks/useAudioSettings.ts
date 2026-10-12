import { useState, useEffect } from 'react';
import { audioManager } from '../lib/audioManager';

export function useAudioSettings() {
  const [musicOn, setMusicOn] = useState(audioManager.isMusicOn());
  const [sfxOn, setSfxOn] = useState(audioManager.isSfxOn());
  const [musicVol, setMusicVol] = useState(audioManager.getMusicVolume());
  const [sfxVol, setSfxVol] = useState(audioManager.getSfxVolume());

  const toggleMusic = () => {
    const newState = audioManager.toggleMusic();
    setMusicOn(newState);
  };

  const toggleSfx = () => {
    const newState = audioManager.toggleSfx();
    setSfxOn(newState);
  };

  const changeMusicVolume = (vol: number) => {
    audioManager.setMusicVolume(vol);
    setMusicVol(vol);
  };

  const changeSfxVolume = (vol: number) => {
    audioManager.setSfxVolume(vol);
    setSfxVol(vol);
  };

  const testSound = () => {
    audioManager.playSfx('button-click');
  };

  return {
    musicOn,
    sfxOn,
    musicVol,
    sfxVol,
    toggleMusic,
    toggleSfx,
    changeMusicVolume,
    changeSfxVolume,
    testSound,
  };
}