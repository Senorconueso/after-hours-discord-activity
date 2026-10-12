import React, { useState, useEffect, useRef } from 'react';
import questionData from './questions.json';
import ClubBackground from './components/ClubBackground';
import SettingsPanel from './components/SettingsPanel';
import { audioManager } from './lib/audioManager';

// ============================================================================
// COMPLETE QUESTION DATABASE (Expanded to 800 Questions)
// ============================================================================
// Original 800 curated questions imported from the project JSON.
const DEMO_QUESTIONS = questionData.questions;

const CATEGORY_META = {
  general: { name: "General", desc: "Funny, casual, nostalgic & everyday questions", rating: "sfw", color: "from-blue-500 to-cyan-400" },
  deep: { name: "Deep Conversations", desc: "Growth, fears, hopes, relationships & meaning", rating: "sfw", color: "from-indigo-500 to-purple-500" },
  hobby: { name: "Hobbies & Interests", desc: "Gaming, art, music, tech & personal passions", rating: "sfw", color: "from-emerald-500 to-teal-400" },
  nsfw: { name: "Original NSFW", desc: "Flirting, attraction, preferences & adult confessions", rating: "nsfw", color: "from-pink-500 to-rose-600" },
  mid: { name: "After Midnight", desc: "Intimate experiences, fantasies & relationships", rating: "nsfw", color: "from-purple-600 to-fuchsia-600" },
  lgbtq: { name: "LGBTQ+ After Dark", desc: "Queer relationships, identity & culture", rating: "nsfw", color: "from-purple-400 via-pink-500 to-red-500" },
  explicit: { name: "No Euphemisms", desc: "Direct, explicit questions about adult experiences", rating: "nsfw", color: "from-red-600 to-rose-800" },
  mixed: { name: "Ultimate 18+ Mixed", desc: "A combination of funny, personal & provocative cards", rating: "nsfw", color: "from-orange-500 to-red-500" }
};

const readStoredBoolean = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch { return fallback; }
};

const readStoredNumber = (key, fallback) => {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch { return fallback; }
};

const storeSetting = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch {}
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GameEngine {
  constructor(database) {
    this.database = database;
    this.is18Plus = false;
    this.activeCategories = [];
    this.usedIds = new Set();
    this.currentDeck = [];
    this.players = [];
    this.currentPlayerIndex = 0;
    this.gameMode = 'classic';
    this.favorites = new Set();
    this.history = [];
    this.boardPositions = {}; // playerIndex -> tileNumber (1-100)
    this.boardScores = {}; // playerIndex -> score
  }

  setAgeStatus(isAdult) {
    this.is18Plus = isAdult;
    if (!this.is18Plus) {
      this.activeCategories = this.activeCategories.filter(
        cat => CATEGORY_META[cat]?.rating === 'sfw'
      );
    }
    this._rebuildDeck();
  }

  setCategories(categories) {
    this.activeCategories = categories;
    this._rebuildDeck();
  }

  setGameMode(mode) {
    this.gameMode = mode;
  }

  setPlayers(playerList) {
    this.players = playerList;
    this.currentPlayerIndex = 0;
    this.boardPositions = {};
    this.boardScores = {};
    playerList.forEach((_, idx) => {
      this.boardPositions[idx] = 1;
      this.boardScores[idx] = 0;
    });
  }

  _rebuildDeck() {
    this.currentDeck = this.database.filter(q => {
      if (!q.enabled) return false;
      if (!this.activeCategories.includes(q.category)) return false;
      const isNsfw = q.rating === 'nsfw' || q.rating === '18+' || q.rating === 'explicit';
      if (isNsfw && !this.is18Plus) return false;
      if (this.usedIds.has(q.id)) return false;
      return true;
    });
    this._shuffle(this.currentDeck);
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  drawQuestion(specificCategory = null) {
    // Only select from the authorized, unconsumed current deck.
    const pool = specificCategory
      ? this.currentDeck.filter(q => q.category === specificCategory)
      : this.currentDeck;
    if (pool.length === 0) return null;
    const q = pool[Math.floor(Math.random() * pool.length)];
    this.currentDeck = this.currentDeck.filter(item => item.id !== q.id);
    this.usedIds.add(q.id);
    this.history.unshift(q);
    return q;
  }

  movePlayer(playerIndex, steps) {
    let current = this.boardPositions[playerIndex] || 1;
    current += steps;
    if (current > 100) current = 100;
    this.boardPositions[playerIndex] = current;
    this.boardScores[playerIndex] = (this.boardScores[playerIndex] || 0) + 10;
    return current;
  }

  nextTurn() {
    if (this.players.length > 0) {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
  }

  getCurrentPlayer() {
    if (this.players.length === 0) return null;
    return this.players[this.currentPlayerIndex];
  }

  toggleFavorite(questionId) {
    if (this.favorites.has(questionId)) {
      this.favorites.delete(questionId);
    } else {
      this.favorites.add(questionId);
    }
    return this.favorites.has(questionId);
  }

  resetDeck() {
    this.usedIds.clear();
    this._rebuildDeck();
  }

  getStats() {
    return {
      remaining: this.currentDeck.length,
      used: this.usedIds.size,
      totalActive: this.database.length
    };
  }

  getAvailableCategories() {
    const availableInDb = new Set(this.database.map(q => q.category));
    return Object.keys(CATEGORY_META).filter(
      key => availableInDb.has(key) && (this.is18Plus || CATEGORY_META[key].rating === 'sfw')
    );
  }
}

const GlowingButton = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => {
  const baseStyle = "w-full py-4 px-6 rounded-2xl font-black text-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:scale-[1.01] active:scale-95 text-white shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100";
  const variants = {
    primary: "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 hover:shadow-[0_0_28px_rgba(217,70,239,0.55)] border border-pink-300/20",
    secondary: "bg-slate-900/55 border border-white/10 hover:bg-slate-800/70 hover:border-pink-400/30 hover:shadow-[0_0_18px_rgba(236,72,153,0.16)] text-slate-200 backdrop-blur-xl",
    danger: "bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-[0_0_25px_rgba(225,29,72,0.5)]",
    sfw: "bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]",
    accent: "bg-gradient-to-r from-amber-500 to-pink-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]"
  };
  const handleClick = (event) => {
    if (disabled) return;
    void audioManager.unlock();
    audioManager.playSfx('click');
    onClick?.(event);
  };
  return (
    <button disabled={disabled} onClick={handleClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export default function App() {
  const engineRef = useRef(new GameEngine(DEMO_QUESTIONS));
  const engine = engineRef.current;

  const [screen, setScreen] = useState('age-gate'); // age-gate, menu, categories, modes, players, game, board, history
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [stats, setStats] = useState({ remaining: 0, used: 0, totalActive: 800 });
  const [selectedCats, setSelectedCats] = useState([]);
  const [gameMode, setGameMode] = useState('classic');
  const [players, setPlayers] = useState(['Player 1', 'Player 2']);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [musicEnabled, setMusicEnabled] = useState(() => readStoredBoolean('afterhours.musicEnabled', true));
  const [sfxEnabled, setSfxEnabled] = useState(() => readStoredBoolean('afterhours.sfxEnabled', true));
  const [musicVolume, setMusicVolume] = useState(() => readStoredNumber('afterhours.musicVolume', 0.18));
  const [sfxVolume, setSfxVolume] = useState(() => readStoredNumber('afterhours.sfxVolume', 0.55));
  const [reducedMotion, setReducedMotion] = useState(() => readStoredBoolean('afterhours.reducedMotion', false));

  // Board Game Specific States
  const [diceValue, setDiceValue] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [boardStep, setBoardStep] = useState('roll'); // 'roll', 'select-category', 'answer'
  const [selectedCategoryForTile, setSelectedCategoryForTile] = useState(null);
  const [, setBoardRevision] = useState(0);
  const [landingTile, setLandingTile] = useState(null);
  const [winnerName, setWinnerName] = useState(null);

  useEffect(() => {
    audioManager.setMusicVolume(musicVolume);
    audioManager.setSfxVolume(sfxVolume);
    audioManager.setSfxEnabled(sfxEnabled);
    audioManager.setMusicEnabled(musicEnabled);
    storeSetting('afterhours.musicEnabled', musicEnabled);
    storeSetting('afterhours.sfxEnabled', sfxEnabled);
    storeSetting('afterhours.musicVolume', musicVolume);
    storeSetting('afterhours.sfxVolume', sfxVolume);
  }, [musicEnabled, sfxEnabled, musicVolume, sfxVolume]);

  useEffect(() => {
    storeSetting('afterhours.reducedMotion', reducedMotion);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    return () => document.documentElement.classList.remove('reduced-motion');
  }, [reducedMotion]);

  useEffect(() => {
    let interval = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
      triggerToast("⏱️️ Time's up!");
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const syncStats = () => setStats(engine.getStats());

  const handleAgeSelect = (isAdult) => {
    engine.setAgeStatus(isAdult);
    void audioManager.unlock().then(() => { if (musicEnabled) audioManager.startMusic(); });
    setScreen('menu');
  };

  const startQuickPlay = () => {
    const available = engine.getAvailableCategories();
    engine.setCategories(available);
    engine.setGameMode('classic');
    engine.setPlayers([]);
    engine.resetDeck();
    drawNext();
    setScreen('game');
  };

  const openCategories = () => {
    setSelectedCats([...engine.activeCategories]);
    setScreen('categories');
  };

  const toggleCategory = (catId) => {
    setSelectedCats(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const confirmCategories = () => {
    if (selectedCats.length === 0) {
      triggerToast("⚠ Please select at least one category!");
      return;
    }
    engine.setCategories(selectedCats);
    engine.resetDeck();
    setScreen('modes');
  };

  const startGameWithMode = (mode) => {
    setGameMode(mode);
    engine.setGameMode(mode);
    if (mode === 'board') {
      setScreen('players');
    } else if (mode === 'party' || mode === 'hot-seat') {
      setScreen('players');
    } else {
      engine.setPlayers([]);
      engine.resetDeck();
      drawNext();
      setScreen('game');
    }
  };

  const addPlayer = (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setPlayers([...players, newPlayerName.trim()]);
    setNewPlayerName('');
  };

  const removePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const launchGameWithPlayers = () => {
    if (players.length === 0) {
      triggerToast("⚠️ Add at least one player name!");
      return;
    }
    engine.setPlayers(players);
    engine.resetDeck();

    if (gameMode === 'board') {
      setBoardStep('roll');
      setDiceValue(null);
      setScreen('board');
    } else {
      drawNext();
      setScreen('game');
    }
  };

  const drawNext = () => {
    const q = engine.drawQuestion();
    setCurrentQuestion(q);
    if (q) {
      setIsFavorite(engine.favorites.has(q.id));
      audioManager.playSfx('card');
    }
    syncStats();
    if (timerSeconds > 0) setTimerActive(true);
  };

  const handleSkip = () => {
    if (gameMode === 'board') {
      setBoardStep('roll');
      engine.nextTurn();
      return;
    }
    if (gameMode === 'party') engine.nextTurn();
    drawNext();
  };

  const handleNext = () => {
    if (gameMode === 'party') engine.nextTurn();
    drawNext();
  };

  const toggleCurrentFavorite = () => {
    if (!currentQuestion) return;
    const fav = engine.toggleFavorite(currentQuestion.id);
    setIsFavorite(fav);
    triggerToast(fav ? "❤ Added to Favorites" : "🖤 Removed from Favorites");
  };

  // Board Game Action Handlers
  const rollDice = async () => {
    if (isRolling) return;
    setIsRolling(true);
    setLandingTile(null);
    await audioManager.unlock();
    audioManager.playSfx('dice');

    const rollFrames = reducedMotion ? 3 : 11;
    for (let i = 0; i < rollFrames; i++) {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      await sleep(reducedMotion ? 28 : 62);
    }

    const finalRoll = Math.floor(Math.random() * 6) + 1;
    setDiceValue(finalRoll);

    const activeIdx = engine.currentPlayerIndex;
    const startPos = engine.boardPositions[activeIdx] || 1;
    const targetPos = Math.min(100, startPos + finalRoll);

    if (reducedMotion) {
      engine.boardPositions[activeIdx] = targetPos;
      setBoardRevision(v => v + 1);
    } else {
      for (let pos = startPos + 1; pos <= targetPos; pos++) {
        engine.boardPositions[activeIdx] = pos;
        setBoardRevision(v => v + 1);
        audioManager.playSfx('step');
        await sleep(145);
      }
    }

    engine.boardScores[activeIdx] = (engine.boardScores[activeIdx] || 0) + 10;
    setLandingTile(targetPos);
    window.setTimeout(() => setLandingTile(null), 750);

    if (targetPos >= 100) {
      audioManager.playSfx('win');
      setWinnerName(players[activeIdx]);
      triggerToast(`🏆 ${players[activeIdx]} WINS THE GAME! 🎉`);
    } else {
      audioManager.playSfx('land');
      triggerToast(`🎲 Rolled a ${finalRoll}! Moved to tile ${targetPos}`);
    }

    setIsRolling(false);
    setBoardStep('select-category');
  };

  const handleBoardCategorySelect = (catId) => {
    const q = engine.drawQuestion(catId);
    if (!q) { triggerToast('No questions remain in that category.'); return; }
    setCurrentQuestion(q);
    audioManager.playSfx('card');
    syncStats();
    setBoardStep('answer');
  };

  const finishBoardTurn = () => {
    engine.nextTurn();
    setBoardStep('roll');
    setDiceValue(null);
    setCurrentQuestion(null);
  };

  return (
    <div className="relative isolate min-h-screen text-slate-100 font-sans selection:bg-pink-500/30 overflow-x-hidden flex flex-col justify-between">
      <ClubBackground />
      
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 border border-pink-500/50 px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(236,72,153,0.3)] text-pink-300 font-bold animate-in fade-in slide-in-from-top-4 duration-300">
          {toastMessage}
        </div>
      )}

      {/* ================= AGE GATE SCREEN ================= */}
      {screen === 'age-gate' && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center animate-in fade-in zoom-in duration-500 m-auto max-w-md w-full">
          <div className="mb-6 p-4 rounded-3xl bg-gradient-to-tr from-purple-600/20 to-pink-600/20 border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
            <span className="text-4xl">🍸</span>
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-3 tracking-tight">
            AFTER HOURS
          </h1>
          <p className="text-slate-400 text-base mb-8">
            Featuring 800 Questions, Board Game Mode, and unforgettable adult secrets.
          </p>
          
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl w-full shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-white mb-1">Age Verification</h2>
            <p className="text-slate-400 text-xs mb-6">
              Select your mode. 18+ mode unlocks provocative adult decks and unfiltered conversations.
            </p>
            
            <GlowingButton variant="danger" onClick={() => handleAgeSelect(true)}>
              YES, I AM 18+ (Unlock All 800 Qs)
            </GlowingButton>
            <GlowingButton variant="sfw" onClick={() => handleAgeSelect(false)}>
              SFW SESSIONS ONLY (Safe for All)
            </GlowingButton>
          </div>
        </div>
      )}

      {/* ================= MAIN MENU SCREEN ================= */}
      {screen === 'menu' && (
        <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-5 md:p-8">
          <div className="w-full max-w-lg">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-300/20 bg-white/[0.06] text-3xl shadow-[0_0_42px_rgba(236,72,153,.22)] backdrop-blur-xl">🍸</div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.45em] text-cyan-200/80">Discord party game</p>
              <h1 className="text-5xl font-black tracking-[-0.055em] text-white md:text-6xl drop-shadow-[0_0_28px_rgba(236,72,153,.35)]">
                AFTER <span className="bg-gradient-to-r from-fuchsia-300 via-pink-300 to-cyan-200 bg-clip-text text-transparent">HOURS</span>
              </h1>
              <p className="mt-3 text-sm text-slate-300/85">How well do you really know your friends?</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${engine.is18Plus ? 'border-rose-400/25 bg-rose-500/10 text-rose-200' : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'}`}>
                  {engine.is18Plus ? '🔥 18+ unlocked' : '🛡 SFW session'}
                </span>
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold text-slate-300">
                  {musicEnabled ? <span className="equalizer"><span/><span/><span/><span/></span> : '🔇'}
                  {musicEnabled ? 'Club mix on' : 'Music off'}
                </span>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-5 md:p-6">
              <div className="space-y-3">
                <GlowingButton variant="primary" onClick={startQuickPlay}>⚡ QUICK PLAY</GlowingButton>
                <GlowingButton variant="secondary" onClick={openCategories}>📂 CHOOSE CATEGORIES</GlowingButton>
                <GlowingButton variant="secondary" onClick={() => { const available = engine.getAvailableCategories(); engine.setCategories(available); setSelectedCats(available); setScreen('modes'); }}>🎮 SELECT GAME MODE</GlowingButton>
                <div className="grid grid-cols-2 gap-3">
                  <GlowingButton variant="secondary" className="!px-3 !py-3 !text-sm" onClick={() => setScreen('history')}>📜 HISTORY</GlowingButton>
                  <GlowingButton variant="secondary" className="!px-3 !py-3 !text-sm" onClick={() => setScreen('settings')}>⚙ SETTINGS</GlowingButton>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-500">
                <span>{DEMO_QUESTIONS.length} curated questions</span>
                <button onClick={() => setScreen('age-gate')} className="font-semibold text-slate-400 underline decoration-white/20 underline-offset-4 hover:text-white">Switch age mode</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'settings' && (
        <SettingsPanel
          musicEnabled={musicEnabled}
          sfxEnabled={sfxEnabled}
          musicVolume={musicVolume}
          sfxVolume={sfxVolume}
          reducedMotion={reducedMotion}
          onMusicEnabled={(value) => { setMusicEnabled(value); void audioManager.unlock().then(() => value ? audioManager.startMusic() : audioManager.stopMusic()); }}
          onSfxEnabled={setSfxEnabled}
          onMusicVolume={setMusicVolume}
          onSfxVolume={setSfxVolume}
          onReducedMotion={setReducedMotion}
          onTestSound={() => { void audioManager.unlock().then(() => audioManager.playSfx('card')); }}
          onBack={() => setScreen('menu')}
        />
      )}

      {/* ================= CATEGORIES SCREEN ================= */}
      {screen === 'categories' && (
        <div className="relative z-10 flex flex-col min-h-screen p-6 max-w-3xl mx-auto w-full animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-8 mt-4">
            <div>
              <h2 className="text-3xl font-black text-white">Select Question Decks</h2>
              <p className="text-slate-400 text-sm">Choose from 800+ categorized questions for your session.</p>
            </div>
            <button onClick={() => setScreen('menu')} className="text-slate-400 hover:text-white transition-colors text-sm font-bold bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 flex-grow content-start">
            {engine.getAvailableCategories().map(catId => {
              const cat = CATEGORY_META[catId];
              const isSelected = selectedCats.includes(catId);
              
              return (
                <div 
                  key={catId}
                  onClick={() => toggleCategory(catId)}
                  className={`p-5 rounded-2xl cursor-pointer border-2 transition-all duration-200 ${
                    isSelected 
                      ? 'bg-slate-800/90 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.2)]' 
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 opacity-70'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className={`text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r ${cat.color}`}>
                      {cat.name}
                    </h3>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-pink-500 bg-pink-500/20' : 'border-slate-600'}`}>
                      {isSelected && <div className="w-3 h-3 bg-pink-500 rounded-full" />}
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs mb-3">{cat.desc}</p>
                  {cat.rating === 'nsfw' && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 px-2.5 py-1 rounded-md border border-red-500/30">
                      18+ Adult
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-6 mt-auto">
            <GlowingButton variant="primary" onClick={confirmCategories}>
              CONTINUE TO GAME MODES ({selectedCats.length} SELECTED)
            </GlowingButton>
          </div>
        </div>
      )}

      {/* ================= GAME MODES SCREEN ================= */}
      {screen === 'modes' && (
        <div className="relative z-10 flex flex-col min-h-screen p-6 max-w-2xl mx-auto w-full justify-center animate-in fade-in duration-300">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-white">Choose Game Mode</h2>
            <p className="text-slate-400 text-sm mt-1">Select how you want to experience the 800 questions.</p>
          </div>

          <div className="space-y-4 mb-8">
            <div onClick={() => startGameWithMode('classic')} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500 cursor-pointer transition-all">
              <h3 className="text-xl font-bold text-purple-400 mb-1">Classic Card Draw</h3>
              <p className="text-slate-400 text-sm">Draw random questions one by one with complete control over skips and deck resets.</p>
            </div>
            <div onClick={() => startGameWithMode('board')} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500 cursor-pointer transition-all">
              <h3 className="text-xl font-bold text-amber-400 mb-1">🎲 1-100 Board Game Mode</h3>
              <p className="text-slate-400 text-sm">Roll the dice, move across a 1-100 tile board, pick a category deck, and answer questions to win!</p>
            </div>
            <div onClick={() => startGameWithMode('party')} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-pink-500 cursor-pointer transition-all">
              <h3 className="text-xl font-bold text-pink-400 mb-1">Party Mode (Turn Rotation)</h3>
              <p className="text-slate-400 text-sm">Pass the phone or screen. The game automatically rotates player turns.</p>
            </div>
          </div>

          <button onClick={() => setScreen('categories')} className="text-slate-500 hover:text-slate-300 text-sm text-center">
            ← Back to Categories
          </button>
        </div>
      )}

      {/* ================= PLAYERS SETUP SCREEN ================= */}
      {screen === 'players' && (
        <div className="relative z-10 flex flex-col min-h-screen p-6 max-w-xl mx-auto w-full justify-center animate-in fade-in duration-300">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-black text-white">Add Players</h2>
            <p className="text-slate-400 text-sm mt-1">Who is playing in this session?</p>
          </div>

          <form onSubmit={addPlayer} className="flex gap-2 mb-6">
            <input 
              type="text" 
              value={newPlayerName} 
              onChange={e => setNewPlayerName(e.target.value)} 
              placeholder="Enter player name..." 
              className="flex-grow bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
            />
            <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
              Add
            </button>
          </form>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-8 max-h-60 overflow-y-auto space-y-2">
            {players.length === 0 ? (
              <p className="text-slate-500 text-center py-4 text-sm">No players added yet.</p>
            ) : (
              players.map((p, index) => (
                <div key={index} className="flex justify-between items-center bg-slate-800/80 px-4 py-3 rounded-xl">
                  <span className="font-semibold text-white">👤 {p}</span>
                  <button onClick={() => removePlayer(index)} className="text-rose-400 hover:text-rose-300 text-xs font-bold">
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <GlowingButton variant="primary" onClick={launchGameWithPlayers}>
              START {gameMode === 'board' ? 'BOARD GAME' : 'PARTY GAME'} ({players.length} PLAYERS)
            </GlowingButton>
            <button onClick={() => setScreen('modes')} className="w-full py-3 text-slate-500 hover:text-slate-300 text-sm text-center">
              ← Back to Modes
            </button>
          </div>
        </div>
      )}

      {/* ================= 1-100 BOARD GAME SCREEN ================= */}
      {screen === 'board' && (
        <div className="relative z-10 flex flex-col min-h-screen p-4 md:p-6 max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen('menu')} className="text-slate-400 hover:text-white font-medium text-sm flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
              ← Menu
            </button>
            <div className="text-center">
              <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-pink-500">
                1-100 Board Game Adventure
              </h2>
              <p className="text-xs text-slate-400">Current Turn: <span className="text-white font-bold">{engine.getCurrentPlayer()}</span></p>
            </div>
            <div className="text-xs font-bold text-slate-400 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
              Goal: Tile 100
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow">
            {/* Left/Top Panel: Player Positions & Controls */}
            <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Player Standings</h3>
                <div className="space-y-3 mb-6">
                  {players.map((p, idx) => {
                    const pos = engine.boardPositions[idx] || 1;
                    const isCurrent = engine.currentPlayerIndex === idx;
                    return (
                      <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${isCurrent ? 'bg-amber-500/10 border-amber-500/50 text-amber-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'}`}>
                        <div>
                          <p className="font-bold text-sm">{p} {isCurrent && '👑'}</p>
                          <p className="text-xs text-slate-400">Score: {engine.boardScores[idx] || 0} pts</p>
                        </div>
                        <span className="text-lg font-black font-mono bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                          {pos}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dice Roll & Category Selection Section */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center">
                {boardStep === 'roll' && (
                  <div>
                    <div className={`text-4xl font-black mb-3 text-amber-400 ${isRolling ? 'dice-shake' : ''}`}>
                      {diceValue !== null ? `🎲 ${diceValue}` : '🎲 --'}
                    </div>
                    <GlowingButton variant="accent" onClick={rollDice} disabled={isRolling} className="!py-3 !text-sm">
                      {isRolling ? 'Rolling Dice...' : `Roll Dice (${engine.getCurrentPlayer()})`}
                    </GlowingButton>
                  </div>
                )}

                {boardStep === 'select-category' && (
                  <div>
                    <p className="text-xs text-amber-300 font-bold mb-3">Choose a category to answer your question!</p>
                    <div className="grid grid-cols-2 gap-2">
                      {engine.activeCategories.filter(cat => engine.getAvailableCategories().includes(cat) && engine.currentDeck.some(q => q.category === cat)).map(catId => {
                        const cat = CATEGORY_META[catId];
                        return (
                          <button
                            key={catId}
                            onClick={() => handleBoardCategorySelect(catId)}
                            className="p-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all truncate"
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {boardStep === 'answer' && (
                  <GlowingButton variant="primary" onClick={finishBoardTurn} className="!py-3 !text-sm">
                    End Turn →
                  </GlowingButton>
                )}
              </div>
            </div>

            {/* Right Main Panel: 1-100 Grid Board OR Question Card */}
            <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 md:p-6 flex flex-col justify-center items-center shadow-2xl relative overflow-y-auto max-h-[75vh]">
              {boardStep === 'answer' && currentQuestion ? (
                <div className="w-full max-w-xl bg-slate-950 border border-pink-500/40 rounded-3xl p-8 flex flex-col justify-between items-center text-center shadow-[0_0_40px_rgba(236,72,153,0.2)] animate-in zoom-in-95 duration-300">
                  <span className="text-xs font-black uppercase tracking-widest text-pink-400 mb-2">
                    {CATEGORY_META[currentQuestion.category]?.name} Challenge
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 my-auto">
                    {currentQuestion.question}
                  </h3>
                  <GlowingButton variant="primary" onClick={finishBoardTurn} className="!py-3">
                    Answered & Complete Turn →
                  </GlowingButton>
                </div>
              ) : (
                <div className="w-full">
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Board Overview (1 to 100)</h3>
                  </div>
                  <div className="grid grid-cols-10 gap-1 md:gap-1.5 max-h-[60vh] overflow-y-auto p-2">
                    {[...Array(100)].map((_, i) => {
                      const tileNum = 100 - i; // Render from 100 down to 1 or snake order
                      const playersOnTile = players.filter((_, pIdx) => (engine.boardPositions[pIdx] || 1) === tileNum);
                      
                      return (
                        <div 
                          key={tileNum}
                          className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative p-1 text-[10px] md:text-xs font-bold transition-all ${
                            tileNum === 100 ? 'bg-amber-500/20 border-amber-400 text-amber-300' :
                            tileNum === 1 ? 'bg-blue-500/20 border-blue-400 text-blue-300' :
                            'bg-slate-950/60 border-slate-800 text-slate-400'
                          } ${landingTile === tileNum ? 'tile-land border-pink-400' : ''}`}
                        >
                          <span className="absolute top-1 left-1 opacity-50">{tileNum}</span>
                          {playersOnTile.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 justify-center mt-3">
                              {playersOnTile.map((p, pIdx) => (
                                <span key={pIdx} className="bg-pink-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-black shadow-md truncate max-w-[35px]" title={p}>
                                  {p[0]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN QUESTION SCREEN ================= */}
      {screen === 'game' && (
        <div className="relative z-10 flex flex-col min-h-screen p-4 md:p-8 max-w-4xl mx-auto w-full justify-between">
          
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen('menu')} className="text-slate-400 hover:text-white font-medium text-sm flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
              ← Menu
            </button>

            <div className="flex items-center gap-3">
              {gameMode === 'party' && engine.getCurrentPlayer() && (
                <div className="text-xs font-black uppercase tracking-wider bg-purple-950/80 text-purple-300 px-4 py-2 rounded-xl border border-purple-800/60 shadow-inner">
                  Turn: <span className="text-white text-sm">{engine.getCurrentPlayer()}</span>
                </div>
              )}
              <div className="text-xs font-bold text-slate-400 tracking-widest uppercase bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800 shadow-inner">
                Cards left: <span className="text-pink-400">{stats.remaining}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs text-slate-500 font-bold uppercase">Timer:</span>
            {[0, 15, 30, 60].map(sec => (
              <button 
                key={sec} 
                onClick={() => { setTimerSeconds(sec); setTimerActive(sec > 0); }}
                className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-all ${timerSeconds === sec && timerActive ? 'bg-pink-500 text-white border-pink-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
              >
                {sec === 0 ? 'Off' : `${sec}s`}
              </button>
            ))}
            {timerActive && (
              <span className="ml-2 text-sm font-mono font-bold text-pink-400 animate-pulse">
                ⏰ {timerSeconds}s
              </span>
            )}
          </div>

          <div className="flex-grow flex items-center justify-center w-full my-auto py-4">
            {!currentQuestion ? (
              <div className="text-center p-12 bg-slate-900/80 rounded-3xl border border-slate-800 w-full max-w-2xl shadow-2xl">
                <h3 className="text-3xl font-black text-slate-200 mb-2">Deck Exhausted</h3>
                <p className="text-slate-400 text-sm mb-8">You've gone through all available questions in this category.</p>
                <GlowingButton variant="primary" onClick={() => { engine.resetDeck(); drawNext(); }}>
                  🔄 RESHUFFLE DECK
                </GlowingButton>
              </div>
            ) : (
              <div 
                key={currentQuestion.id}
                className="question-reveal relative w-full max-w-2xl min-h-[380px] bg-slate-900/90 backdrop-blur-2xl border border-slate-700/60 rounded-[2.5rem] p-8 md:p-12 flex flex-col justify-between items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-in zoom-in-95 fade-in duration-300"
                style={{
                  boxShadow: `0 0 50px ${(currentQuestion.rating === 'nsfw' || currentQuestion.rating === '18+') ? 'rgba(225,29,72,0.18)' : 'rgba(56,189,248,0.12)'}`
                }}
              >
                <div className="w-full flex justify-between items-center">
                  <span className={`text-xs font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r ${CATEGORY_META[currentQuestion.category]?.color || 'from-slate-400 to-slate-600'}`}>
                    {CATEGORY_META[currentQuestion.category]?.name || currentQuestion.category}
                  </span>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={toggleCurrentFavorite} 
                      className={`text-lg p-2 rounded-full transition-colors ${isFavorite ? 'text-pink-500 bg-pink-500/10' : 'text-slate-600 hover:text-slate-400'}`}
                      title="Bookmark Question"
                    >
                      {isFavorite ? '❤️' : '🤍'}
                    </button>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-1.5 h-5 rounded-sm ${i < currentQuestion.intensity ? 'bg-pink-500' : 'bg-slate-800'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="my-auto py-6">
                  <h2 className="text-2xl md:text-4xl font-bold text-white leading-snug md:leading-snug">
                    {currentQuestion.question}
                  </h2>
                </div>
                
                <div className="w-full flex justify-between items-center text-xs text-slate-500 font-semibold tracking-wider pt-4 border-t border-slate-800/80">
                  <span className="uppercase">{currentQuestion.id}</span>
                  {(currentQuestion.rating === 'nsfw' || currentQuestion.rating === '18+' || currentQuestion.rating === 'explicit') && (
                    <span className="uppercase bg-red-950/80 text-red-400 px-2.5 py-1 rounded-md border border-red-900">18+ Adult</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto w-full pt-4">
            <GlowingButton variant="secondary" onClick={handleSkip} className="!py-4">
              SKIP / PASS
            </GlowingButton>
            <GlowingButton variant="primary" onClick={handleNext} className="!py-4">
              NEXT DRAW →
            </GlowingButton>
          </div>
        </div>
      )}

      {/* ================= QUESTION HISTORY SCREEN ================= */}
      {screen === 'history' && (
        <div className="relative z-10 flex flex-col min-h-screen p-6 max-w-2xl mx-auto w-full animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-6 mt-4">
            <h2 className="text-2xl font-black text-white">Drawn History</h2>
            <button onClick={() => setScreen('menu')} className="text-slate-400 hover:text-white text-sm bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
              Back to Menu
            </button>
          </div>

          <div className="space-y-3 flex-grow overflow-y-auto max-h-[75vh] pr-2">
            {engine.history.length === 0 ? (
              <p className="text-slate-500 text-center py-12">No questions drawn yet in this session.</p>
            ) : (
              engine.history.map((q, index) => (
                <div key={index} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                    <span className="text-pink-400 uppercase">{CATEGORY_META[q.category]?.name || q.category}</span>
                    <span>{q.id}</span>
                  </div>
                  <p className="text-white font-medium text-sm">{q.question}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {winnerName && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-[2rem] border border-amber-300/30 p-8 text-center shadow-[0_0_80px_rgba(245,158,11,.18)]">
            <div className="text-6xl">🏆</div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.35em] text-amber-300">Tile 100 reached</p>
            <h2 className="mt-2 text-4xl font-black text-white">{winnerName} wins!</h2>
            <p className="mt-3 text-sm text-slate-400">The room survived. Barely.</p>
            <GlowingButton className="mt-7" variant="accent" onClick={() => setWinnerName(null)}>KEEP THE PARTY GOING</GlowingButton>
          </div>
        </div>
      )}

      <footer className="relative z-10 py-4 text-center text-xs text-slate-600 border-t border-white/5 mt-auto">
        AFTER HOURS • 800 Questions Engine & Board Game Mode.
      </footer>
    </div>
  );
}