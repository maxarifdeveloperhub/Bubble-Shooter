import { useState, useEffect } from 'react';
import { getLevels, generateProceduralLevel } from './utils/levels';
import { PlayerStats, Level, GameSettings, Achievement, PowerUpType } from './types';
import { SoundManager } from './utils/audio';
import { CanvasGame } from './components/CanvasGame';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Settings as SettingsIcon,
  Trophy,
  ShoppingBag,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Sparkles,
  Award,
  Coins,
  CheckCircle,
  HelpCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowRight,
  Skull,
  X,
  Star
} from 'lucide-react';

const INITIAL_SETTINGS: GameSettings = {
  musicOn: true,
  sfxOn: true,
  vibrationOn: true,
};

const INITIAL_STATS: PlayerStats = {
  coins: 250,
  levelProgress: {},
  highScore: 0,
  dailyRewardLastClaimed: null,
  unlockedPowerups: {
    bomb: 2,
    rainbow: 2,
    guideLine: 2,
  },
  achievements: {
    pop_100: { unlocked: false, progress: 0 },
    level_5: { unlocked: false, progress: 0 },
    combo_5: { unlocked: false, progress: 0 },
    high_score_3000: { unlocked: false, progress: 0 },
    buy_powerup: { unlocked: false, progress: 0 },
  },
};

const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: 'pop_100',
    title: 'Pop Meister',
    description: 'Pop 100 bubbles in total on the board',
    target: 100,
    rewardCoins: 150,
    icon: 'Sparkles',
  },
  {
    id: 'level_5',
    title: 'Canyon Conquered',
    description: 'Successfully complete level 5',
    target: 5,
    rewardCoins: 250,
    icon: 'Trophy',
  },
  {
    id: 'combo_5',
    title: 'Chain Reaction',
    description: 'Reach a 5x Match Combo during a play session',
    target: 5,
    rewardCoins: 200,
    icon: 'Zap',
  },
  {
    id: 'high_score_3000',
    title: 'High Shooter',
    description: 'Earn a high score of 3,000 points',
    target: 3000,
    rewardCoins: 300,
    icon: 'Award',
  },
  {
    id: 'buy_powerup',
    title: 'Adrenaline Surge',
    description: 'Purchase 3 power-ups from the Shop',
    target: 3,
    rewardCoins: 100,
    icon: 'ShoppingBag',
  },
];

export default function App() {
  const [screen, setScreen] = useState<'splash' | 'menu' | 'levels' | 'game' | 'pause' | 'win_modal' | 'lose_modal' | 'achievements' | 'shop' | 'settings'>('splash');
  const [playerStats, setPlayerStats] = useState<PlayerStats>(INITIAL_STATS);
  const [settings, setSettings] = useState<GameSettings>(INITIAL_SETTINGS);

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);

  // Active play parameters
  const [gameScore, setGameScore] = useState(0);
  const [gameShotsLeft, setGameShotsLeft] = useState(0);
  const [gameCombo, setGameCombo] = useState(0);
  const [earnedStars, setEarnedStars] = useState(0);
  const [loseReason, setLoseReason] = useState<'shots' | 'ceiling'>('shots');

  // Active selected powerup ready to fire
  const [activePowerup, setActivePowerup] = useState<PowerUpType | null>(null);

  // Daily reward notification banner
  const [dailyClaimedToday, setDailyClaimedToday] = useState(false);
  const [showDailyToast, setShowDailyToast] = useState(false);

  // Initialize and load saved state from localStorage
  useEffect(() => {
    // Load local settings
    const storedSettings = localStorage.getItem('bubble_shooter_settings');
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (err) {
        console.warn('Stale configurations, reverting to baseline template.');
      }
    }

    // Load local PlayerStats
    const storedStats = localStorage.getItem('bubble_shooter_player_stats');
    if (storedStats) {
      try {
        const loaded: PlayerStats = JSON.parse(storedStats);
        // fill pre-requisite powerups of structural template
        const combined: PlayerStats = {
          ...INITIAL_STATS,
          ...loaded,
          unlockedPowerups: { ...INITIAL_STATS.unlockedPowerups, ...loaded.unlockedPowerups },
          achievements: { ...INITIAL_STATS.achievements, ...loaded.achievements },
        };
        setPlayerStats(combined);
      } catch (err) {
        setPlayerStats(INITIAL_STATS);
      }
    }

    // Populate levels
    setLevels(getLevels());

    // Splash timeout mock
    const timer = setTimeout(() => {
      setScreen('menu');
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  // Update background audio status whenever musicOn setting changes
  useEffect(() => {
    if (screen !== 'splash') {
      if (settings.musicOn) {
        SoundManager.startMusic(true);
      } else {
        SoundManager.stopMusic();
      }
    }
  }, [settings.musicOn, screen]);

  // Save stats helper
  const saveStats = (updatedStats: PlayerStats) => {
    setPlayerStats(updatedStats);
    localStorage.setItem('bubble_shooter_player_stats', JSON.stringify(updatedStats));
  };

  // Save settings helper
  const saveSettings = (updatedSettings: GameSettings) => {
    setSettings(updatedSettings);
    localStorage.setItem('bubble_shooter_settings', JSON.stringify(updatedSettings));
  };

  // Global browser click to resolve autostart constraints on Audio Contexts
  const handleUserInteractionClick = () => {
    if (settings.musicOn) {
      SoundManager.startMusic(true);
    }
  };

  // Select level item
  const handleSelectLevel = (levelId: number) => {
    SoundManager.playClick(settings.sfxOn);
    let lvl = levels.find((l) => l.id === levelId);
    if (!lvl) {
      lvl = generateProceduralLevel(levelId);
    }
    setCurrentLevel(lvl);
    setGameScore(0);
    setGameShotsLeft(lvl.maxShots);
    setGameCombo(0);
    setScreen('game');
  };

  // Real-time gameplay feedback telemetry
  const handleScoreUpdate = (newScore: number, remainingShots: number, combo: number) => {
    setGameScore(newScore);
    setGameShotsLeft(remainingShots);
    setGameCombo(combo);

    // Track achievement: max combo
    if (combo >= playerStats.achievements.combo_5.progress) {
      trackProgress('combo_5', combo);
    }

    // Track achievement: absolute high score
    if (newScore > playerStats.highScore) {
      const updatedStats = { ...playerStats, highScore: newScore };
      saveStats(updatedStats);
    }
    if (newScore >= 3000) {
      trackProgress('high_score_3000', newScore);
    }
  };

  const handleUpdateCoins = (coinIncrement: number) => {
    if (coinIncrement <= 0) return;
    const nextStats = { ...playerStats, coins: playerStats.coins + coinIncrement };
    saveStats(nextStats);

    // Also track matching/popping progress
    const bubblesCountIncrement = coinIncrement * 3; // rough estimate
    trackProgress('pop_100', playerStats.achievements.pop_100.progress + bubblesCountIncrement);
  };

  const handleUsePowerup = (type: PowerUpType) => {
    const nextPowerups = { ...playerStats.unlockedPowerups };
    if (nextPowerups[type] > 0) {
      nextPowerups[type] = nextPowerups[type] - 1;
      const nextStats = { ...playerStats, unlockedPowerups: nextPowerups };
      saveStats(nextStats);
    }
  };

  // Level Clear Win State
  const handleLevelWin = (finalScore: number, stars: number) => {
    if (!currentLevel) return;
    SoundManager.playWin(settings.sfxOn);
    setEarnedStars(stars);

    // Update level completed statistics
    const progress = { ...playerStats.levelProgress };
    const currentRecord = progress[currentLevel.id];
    
    // Pick highest values
    const prevStars = currentRecord ? currentRecord.stars : 0;
    const prevScore = currentRecord ? currentRecord.score : 0;

    progress[currentLevel.id] = {
      completed: true,
      score: Math.max(prevScore, finalScore),
      stars: Math.max(prevStars, stars),
    };

    // Calculate level bonuses (100 coins for completed level, extra stars bonus!)
    const levelPassBonus = 100 + stars * 25;
    const nextCoins = playerStats.coins + levelPassBonus;

    const nextStats = {
      ...playerStats,
      coins: nextCoins,
      levelProgress: progress,
    };

    saveStats(nextStats);

    // Track completed level progress
    trackProgress('level_5', Object.keys(progress).length);

    setScreen('win_modal');
  };

  // Level Failure State
  const handleLevelLose = (reason: 'shots' | 'ceiling') => {
    SoundManager.playLose(settings.sfxOn);
    setLoseReason(reason);
    setScreen('lose_modal');
  };

  // Shop item transaction mechanism
  const buyBooster = (type: PowerUpType, cost: number) => {
    if (playerStats.coins < cost) return; // bank insufficient
    SoundManager.playUpgrade(settings.sfxOn);

    const updatedPowerups = { ...playerStats.unlockedPowerups };
    updatedPowerups[type] = (updatedPowerups[type] || 0) + 1;

    // Buy powerup achievement progress
    const currentBuyProgress = playerStats.achievements.buy_powerup.progress;
    
    const nextStats = {
      ...playerStats,
      coins: playerStats.coins - cost,
      unlockedPowerups: updatedPowerups,
    };

    saveStats(nextStats);
    trackProgress('buy_powerup', currentBuyProgress + 1);
  };

  // Achievement progress increments
  const trackProgress = (id: string, currentVal: number) => {
    const ach = ACHIEVEMENTS_LIST.find((a) => a.id === id);
    if (!ach) return;

    const userAch = playerStats.achievements[id] || { unlocked: false, progress: 0 };
    if (userAch.unlocked) return; // already unlocked

    const nextProgress = Math.min(ach.target, currentVal);
    const becameUnlocked = nextProgress >= ach.target;

    const updatedAchievements = { ...playerStats.achievements };
    updatedAchievements[id] = {
      unlocked: becameUnlocked ? true : userAch.unlocked,
      progress: nextProgress,
      unlockedAt: becameUnlocked ? new Date().toISOString() : userAch.unlockedAt,
    };

    const nextCoins = becameUnlocked ? playerStats.coins + ach.rewardCoins : playerStats.coins;

    const nextStats = {
      ...playerStats,
      coins: nextCoins,
      achievements: updatedAchievements,
    };

    saveStats(nextStats);

    if (becameUnlocked) {
      SoundManager.playUnlockPowerup(settings.sfxOn);
    }
  };

  // Daily Rewards Claim mechanism
  const claimDailyReward = () => {
    const lastClaimed = playerStats.dailyRewardLastClaimed;
    const now = new Date();

    if (lastClaimed) {
      const lastDate = new Date(lastClaimed);
      const diffMs = now.getTime() - lastDate.getTime();
      const hoursDiff = diffMs / (1000 * 60 * 60);

      if (hoursDiff < 24) {
        // Already claimed in past 24 hours
        setDailyClaimedToday(true);
        setShowDailyToast(true);
        setTimeout(() => setShowDailyToast(false), 2500);
        return;
      }
    }

    // Process fresh claim
    SoundManager.playUpgrade(settings.sfxOn);
    const nextStats = {
      ...playerStats,
      coins: playerStats.coins + 150, // 150 daily free coins!
      dailyRewardLastClaimed: now.toISOString(),
    };
    saveStats(nextStats);
    setDailyClaimedToday(true);
    setShowDailyToast(true);
    setTimeout(() => setShowDailyToast(false), 2500);
  };

  const getDailyRewardStatus = () => {
    const lastClaimed = playerStats.dailyRewardLastClaimed;
    if (!lastClaimed) return { claimable: true, timeRemainingLabel: '' };

    const lastDate = new Date(lastClaimed);
    const diffMs = new Date().getTime() - lastDate.getTime();
    const hoursDiff = diffMs / (1000 * 60 * 60);

    if (hoursDiff >= 24) {
      return { claimable: true, timeRemainingLabel: '' };
    } else {
      const remainingMs = (24 * 60 * 60 * 1000) - diffMs;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        claimable: false,
        timeRemainingLabel: `${hours}h ${minutes}m remaining`,
      };
    }
  };

  const resetAllProgress = () => {
    if (confirm("Reset game progress? This wipes all high scores, completed levels and coins!")) {
      SoundManager.playClick(settings.sfxOn);
      localStorage.removeItem('bubble_shooter_player_stats');
      setPlayerStats(INITIAL_STATS);
      setScreen('menu');
    }
  };

  return (
    <div
      onClick={handleUserInteractionClick}
      className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-6 font-sans relative overflow-hidden select-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950 via-slate-900 to-slate-950"
    >
      {/* Decorative Floating ambient background bubbles */}
      <div className="absolute top-10 left-10 w-24 h-24 rounded-full bg-pink-500/10 blur-xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-sky-500/10 blur-2xl animate-pulse-glow" />
      <div className="absolute top-1/2 left-3/4 w-16 h-16 rounded-full bg-violet-600/5 blur-lg" />

      {/* Main Game Screen Device Frame Container */}
      <div className="w-full max-w-[440px] aspect-[9/16] glass-panel rounded-3xl border border-slate-700/60 shadow-3xl overflow-hidden flex flex-col relative">
        <AnimatePresence mode="wait">
          {/* 1. SPLASH SCREEN */}
          {screen === 'splash' && (
            <motion.div
              key="splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950"
            >
              <div className="relative mb-6 animate-pulse-glow">
                {/* 3D Shiny Glass Sphere Bubble Simulation Icon */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-pink-400 p-1 shadow-2xl flex items-center justify-center relative">
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-pink-400" />
                  </div>
                  {/* Glossy sheen */}
                  <div className="absolute top-2 left-4 w-6 h-3 rounded-full bg-white/20 blur-[1px]" />
                </div>
              </div>

              <h1 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-violet-400 to-amber-400 font-display mb-2">
                BUBBLE
              </h1>
              <h2 className="text-xl font-bold text-slate-400 tracking-widest font-mono mb-8">
                SHOOTER
              </h2>

              {/* Progress loader */}
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.1, ease: 'easeInOut' }}
                  className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
                />
              </div>
              <p className="text-xs text-slate-500 font-mono">LOADING ASSETS...</p>
            </motion.div>
          )}

          {/* 2. MAIN MENU SCREEN */}
          {screen === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col p-6 justify-between"
            >
              {/* Header Profile with Gold / Coin indicator */}
              <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-black text-amber-400" id="menu-coin-counter">
                    {playerStats.coins}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-violet-950/40 px-3 py-1 rounded-full border border-violet-900/30">
                  <Trophy className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-semibold text-slate-300">HighScore:</span>
                  <span className="text-xs font-black text-violet-300">{playerStats.highScore}</span>
                </div>
              </div>

              {/* Central Premium Game Title */}
              <div className="my-auto text-center py-6">
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full" />
                  <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-200 to-pink-500 tracking-tight font-display drop-shadow-lg block">
                    BUBBLE
                  </span>
                  <span className="text-3xl font-extrabold tracking-widest text-amber-400 font-mono block mt-1">
                    SHOOTER
                  </span>
                </div>

                <p className="text-slate-400 text-xs font-medium max-w-xs mx-auto">
                  Pop colorful layout clusters with bounces, explosive boosters, and neon paths!
                </p>
              </div>

              {/* Action Buttons Column */}
              <div className="flex flex-col gap-3.5 mb-2">
                <button
                  id="primary-play-btn"
                  onClick={() => handleSelectLevel(Object.keys(playerStats.levelProgress).length + 1)}
                  className="w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>PLAY NOW</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    id="menu-select-level-btn"
                    onClick={() => {
                      SoundManager.playClick(settings.sfxOn);
                      setScreen('levels');
                    }}
                    className="bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-bold py-3 px-4 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>Levels</span>
                  </button>

                  <button
                    id="menu-achievements-btn"
                    onClick={() => {
                      SoundManager.playClick(settings.sfxOn);
                      setScreen('achievements');
                    }}
                    className="bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-bold py-3 px-4 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Badges</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    id="menu-shop-btn"
                    onClick={() => {
                      SoundManager.playClick(settings.sfxOn);
                      setScreen('shop');
                    }}
                    className="bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-bold py-3 px-4 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    <span>Boost Market</span>
                  </button>

                  <button
                    id="menu-settings-btn"
                    onClick={() => {
                      SoundManager.playClick(settings.sfxOn);
                      setScreen('settings');
                    }}
                    className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold py-3 px-4 rounded-xl border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <SettingsIcon className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </button>
                </div>

                {/* Daily Rewards Claim Deck */}
                <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 flex justify-between items-center gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-pink-400" />
                    <div>
                      <h4 className="text-xs font-black text-slate-200">Daily Free Gift</h4>
                      <p className="text-[10px] text-slate-500">Claim 150 coins once a day!</p>
                    </div>
                  </div>

                  <button
                    id="claim-daily-gift-btn"
                    onClick={claimDailyReward}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      getDailyRewardStatus().claimable
                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white animate-pulse shadow-md active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {getDailyRewardStatus().claimable ? 'Claim' : 'Claimed'}
                  </button>
                </div>
              </div>

              {/* Toast notifier for claiming gift */}
              {showDailyToast && (
                <div className="absolute top-16 left-4 right-4 bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-xl text-xs text-center shadow-lg backdrop-blur-md">
                  🎉 Gift claimed! +150 Coins added to wallet.
                </div>
              )}
            </motion.div>
          )}

          {/* 3. LEVEL SELECTION SCREEN */}
          {screen === 'levels' && (
            <motion.div
              key="levels"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <button
                  id="back-to-menu-from-levels-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('menu');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 p-2.5 rounded-xl border border-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-black text-slate-100 font-display">SELECT LEVEL</h3>
                <div className="flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-extrabold text-amber-400">{playerStats.coins}</span>
                </div>
              </div>

              {/* Grid of level selectors */}
              <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 pr-1 max-h-[360px]">
                {levels.map((lvl) => {
                  const progress = playerStats.levelProgress[lvl.id];
                  const completed = progress?.completed || false;
                  const stars = progress?.stars || 0;

                  // Simple unlock barrier logic
                  const isUnlocked = lvl.id === 1 || playerStats.levelProgress[lvl.id - 1]?.completed;

                  return (
                    <button
                      key={lvl.id}
                      id={`level-card-${lvl.id}`}
                      onClick={() => isUnlocked && handleSelectLevel(lvl.id)}
                      disabled={!isUnlocked}
                      className={`relative aspect-square rounded-2xl flex flex-col items-center justify-between p-3.5 border transition-all ${
                        isUnlocked
                          ? 'bg-slate-900/80 hover:bg-indigo-950/50 border-indigo-900/40 hover:border-violet-500/50 cursor-pointer active:scale-95'
                          : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                      }`}
                    >
                      {/* Level ID number badge */}
                      <span className={`text-base font-black ${isUnlocked ? 'text-slate-100' : 'text-slate-600'}`}>
                        {lvl.id}
                      </span>

                      {/* Display earned stars rating */}
                      {isUnlocked && (
                        <div className="flex gap-0.5 justify-center mt-1">
                          {[1, 2, 3].map((sIndex) => (
                            <Star
                              key={sIndex}
                              className={`w-3 h-3 ${sIndex <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Unlocked lock info icon */}
                      {!isUnlocked && <span className="text-[10px] uppercase tracking-wider text-slate-700">Locked</span>}

                      {/* Tiny level label name */}
                      {isUnlocked && (
                        <div className="text-[8px] truncate font-medium text-slate-400 w-full text-center">
                          {lvl.name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* 4. GAMEPLAY SCREEN */}
          {screen === 'game' && currentLevel && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-4 justify-between"
            >
              {/* Gameplay level info header */}
              <div className="flex justify-between items-center mb-2 px-1">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest font-mono">
                    LEVEL {currentLevel.id}
                  </h4>
                  <p className="text-sm font-black text-slate-100 truncate max-w-[180px]">
                    {currentLevel.name}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-2xl border border-slate-800">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                  <span className="text-sm font-black text-slate-100 font-mono tracking-tight">
                    {gameScore}
                  </span>
                </div>
              </div>

              {/* Dynamic canvas component with physical modules mapping */}
              <CanvasGame
                level={currentLevel}
                settings={settings}
                unlockedPowerups={playerStats.unlockedPowerups}
                onWin={handleLevelWin}
                onLose={handleLevelLose}
                onPause={() => {
                  SoundManager.playClick(settings.sfxOn);
                  setScreen('pause');
                }}
                onScoreUpdate={handleScoreUpdate}
                onUpdateCoins={handleUpdateCoins}
                onUsePowerup={handleUsePowerup}
                activePowerup={activePowerup}
                setActivePowerup={setActivePowerup}
              />
            </motion.div>
          )}

          {/* 5. PAUSE MENU OVERLAY */}
          {screen === 'pause' && currentLevel && (
            <motion.div
              key="pause"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-slate-900/80 border border-slate-700/50 flex items-center justify-center mb-4">
                <SettingsIcon className="w-8 h-8 text-slate-400" />
              </div>

              <h3 className="text-2xl font-black text-slate-100 font-display mb-1">GAME PAUSED</h3>
              <p className="text-xs text-slate-400 mb-8 max-w-xs leading-relaxed">
                You are currently playing <span className="font-extrabold text-slate-100">Level {currentLevel.id}</span>. Continue or restart to achieve a perfect 3-star score!
              </p>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  id="pause-resume-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('game');
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-black py-3 rounded-xl transition-all active:scale-95"
                >
                  RESUME GAME
                </button>

                <button
                  id="pause-retry-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    handleSelectLevel(currentLevel.id);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold py-3 rounded-xl border border-slate-800 transition-all active:scale-95"
                >
                  RESTART LEVEL
                </button>

                <button
                  id="pause-quit-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('levels');
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-rose-400 font-bold py-3 rounded-xl border border-slate-900 transition-colors"
                >
                  QUIT TO LEVELS
                </button>
              </div>
            </motion.div>
          )}

          {/* 6. LEVEL COMPLETE (WIN) SCREEN */}
          {screen === 'win_modal' && currentLevel && (
            <motion.div
              key="win"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                <div className="w-20 h-20 bg-slate-900 rounded-full border-2 border-amber-400 flex items-center justify-center relative animate-pulse-glow">
                  <Star className="w-10 h-10 text-amber-400 fill-amber-400" />
                </div>
              </div>

              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 font-display mb-1">
                LEVEL CLEARED!
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Awesome! All grid bubbles popped with extreme precision.
              </p>

              {/* Score Display Card */}
              <div className="glass-card w-full max-w-xs p-4 rounded-2xl mb-8 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                  <span className="text-xs text-slate-400">Total Score:</span>
                  <span className="text-lg font-black text-slate-100 font-mono">{gameScore}</span>
                </div>

                {/* Stars container */}
                <div className="flex justify-center gap-1.5 py-1">
                  {[1, 2, 3].map((starIndex) => (
                    <Star
                      key={starIndex}
                      className={`w-8 h-8 ${
                        starIndex <= earnedStars ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-slate-800'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-slate-400">Coins Awarded:</span>
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    +{100 + earnedStars * 25} Coins
                  </span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  id="win-next-level-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    const nextId = currentLevel.id + 1;
                    handleSelectLevel(nextId);
                  }}
                  className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 hover:brightness-110 text-slate-950 font-black py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(52,211,153,0.3)] transition-all active:scale-95"
                >
                  <span>NEXT LEVEL</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  id="win-replay-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    handleSelectLevel(currentLevel.id);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl border border-slate-800 transition-all active:scale-95"
                >
                  PLAY AGAIN
                </button>

                <button
                  id="win-quit-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('menu');
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-slate-400 font-bold py-3 rounded-xl border border-slate-900 transition-colors"
                >
                  MAIN MENU
                </button>
              </div>
            </motion.div>
          )}

          {/* 7. GAME OVER (LOSE) SCREEN */}
          {screen === 'lose_modal' && currentLevel && (
            <motion.div
              key="lose"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-950/40 border border-rose-900/50 rounded-full flex items-center justify-center mb-4">
                <Skull className="w-8 h-8 text-rose-500 animate-bounce" />
              </div>

              <h2 className="text-3xl font-black text-rose-400 font-display mb-1">GAME OVER</h2>
              <p className="text-xs text-slate-400 mb-6 max-w-xs">
                {loseReason === 'ceiling'
                  ? 'The bubbles crossed the target danger limit line! Fail.'
                  : 'You ran out of shots with active bubbles remaining!'}
              </p>

              {/* Reassurance score container */}
              <div className="bg-slate-900/80 w-full max-w-xs p-4 rounded-xl border border-slate-800 mb-8">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-slate-400 text-xs">Score Achieved:</span>
                  <span className="text-base text-slate-100 font-black font-mono">{gameScore}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  id="lose-retry-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    handleSelectLevel(currentLevel.id);
                  }}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-3 px-6 rounded-2xl shadow-[0_4px_15px_rgba(244,63,94,0.3)] transition-all active:scale-95"
                >
                  RETRY LEVEL
                </button>

                <button
                  id="lose-quit-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('levels');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl border border-slate-800 transition"
                >
                  CHOOSE LEVEL
                </button>

                <button
                  id="lose-menu-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('menu');
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-slate-400 font-bold py-3 rounded-xl border border-slate-900 transition-colors"
                >
                  MAIN MENU
                </button>
              </div>
            </motion.div>
          )}

          {/* 8. SHOP (BOOSTER STORE) SCREEN */}
          {screen === 'shop' && (
            <motion.div
              key="shop"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="flex-1 flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <button
                  id="shop-back-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('menu');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 p-2.5 rounded-xl border border-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-black text-slate-100 font-display">BOOST MARKET</h3>
                <div className="flex items-center gap-1 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 text-xs">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-extrabold text-amber-400" id="shop-coin-counter">
                    {playerStats.coins}
                  </span>
                </div>
              </div>

              {/* Shop list items */}
              <div className="flex-1 overflow-y-auto space-y-4 max-h-[380px] pr-1">
                {/* Item 1: BOMB */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-950/40 border border-orange-900/30 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-100">Bomb Booster</h4>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Explodes bubbles in a 2-index radius.
                      </p>
                      <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block mt-1">
                        Currently: {playerStats.unlockedPowerups.bomb} owned
                      </span>
                    </div>
                  </div>

                  <button
                    id="buy-powerup-bomb-btn"
                    onClick={() => buyBooster('bomb', 150)}
                    disabled={playerStats.coins < 150}
                    className="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-40 hover:border-amber-500/40 text-slate-200 border border-slate-700 font-bold p-2.5 rounded-xl transition-all w-24"
                  >
                    <span className="text-[10px] text-slate-400 font-medium">Buy for</span>
                    <span className="text-xs font-black text-amber-400 flex items-center gap-0.5 mt-0.5">
                      <Coins className="w-3 h-3" /> 150
                    </span>
                  </button>
                </div>

                {/* Item 2: RAINBOW */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-950/40 border border-violet-900/30 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-violet-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-100">Rainbow Bubble</h4>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Matches instantly with any colliding color.
                      </p>
                      <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block mt-1">
                        Currently: {playerStats.unlockedPowerups.rainbow} owned
                      </span>
                    </div>
                  </div>

                  <button
                    id="buy-powerup-rainbow-btn"
                    onClick={() => buyBooster('rainbow', 200)}
                    disabled={playerStats.coins < 200}
                    className="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-40 hover:border-amber-500/40 text-slate-200 border border-slate-700 font-bold p-2.5 rounded-xl transition-all w-24"
                  >
                    <span className="text-[10px] text-slate-400 font-medium">Buy for</span>
                    <span className="text-xs font-black text-amber-400 flex items-center gap-0.5 mt-0.5">
                      <Coins className="w-3 h-3" /> 200
                    </span>
                  </button>
                </div>

                {/* Item 3: AIM GUIDE EXTENDER */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-900/30 flex items-center justify-center">
                      <Award className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-100">Aim Extension</h4>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Perfect laser aim bounce trace prediction.
                      </p>
                      <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block mt-1">
                        Currently: {playerStats.unlockedPowerups.guideLine} owned
                      </span>
                    </div>
                  </div>

                  <button
                    id="buy-powerup-laser-btn"
                    onClick={() => buyBooster('guideLine', 100)}
                    disabled={playerStats.coins < 100}
                    className="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-40 hover:border-amber-500/40 text-slate-200 border border-slate-700 font-bold p-2.5 rounded-xl transition-all w-24"
                  >
                    <span className="text-[10px] text-slate-400 font-medium">Buy for</span>
                    <span className="text-xs font-black text-amber-400 flex items-center gap-0.5 mt-0.5">
                      <Coins className="w-3 h-3" /> 100
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 9. SETTINGS SCREEN */}
          {screen === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-8">
                <button
                  id="settings-back-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('menu');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 p-2.5 rounded-xl border border-slate-800 transition-colors pointer-events-auto"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-black text-slate-100 font-display">SYSTEM SETTINGS</h3>
                <div className="w-8" />
              </div>

              {/* List of Settings Toggles */}
              <div className="flex-1 space-y-6">
                {/* Toggle: Music */}
                <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    {settings.musicOn ? (
                      <Volume2 className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-slate-500" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">Ambient Music</h4>
                      <p className="text-[10px] text-slate-400">Synthesized dynamic tune loop.</p>
                    </div>
                  </div>

                  <button
                    id="toggle-music-btn"
                    onClick={() => {
                      const next = { ...settings, musicOn: !settings.musicOn };
                      saveSettings(next);
                      SoundManager.playClick(next.sfxOn);
                    }}
                    className={`w-12 h-6.5 rounded-full p-1 transition-colors ${
                      settings.musicOn ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-full bg-white transition-all transform ${
                        settings.musicOn ? 'translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle: SFX */}
                <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Volume1 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">Game SFX</h4>
                      <p className="text-[10px] text-slate-400">Pops, bounces, explosions, matches.</p>
                    </div>
                  </div>

                  <button
                    id="toggle-sfx-btn"
                    onClick={() => {
                      const next = { ...settings, sfxOn: !settings.sfxOn };
                      saveSettings(next);
                      SoundManager.playClick(next.sfxOn);
                    }}
                    className={`w-12 h-6.5 rounded-full p-1 transition-colors ${
                      settings.sfxOn ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-full bg-white transition-all transform ${
                        settings.sfxOn ? 'translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle: Vibration */}
                <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">Haptic Buzz</h4>
                      <p className="text-[10px] text-slate-400">Tactile pulse on combo match bursts.</p>
                    </div>
                  </div>

                  <button
                    id="toggle-vibration-btn"
                    onClick={() => {
                      const next = { ...settings, vibrationOn: !settings.vibrationOn };
                      saveSettings(next);
                      SoundManager.playClick(next.sfxOn);
                    }}
                    className={`w-12 h-6.5 rounded-full p-1 transition-colors ${
                      settings.vibrationOn ? 'bg-amber-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-full bg-white transition-all transform ${
                        settings.vibrationOn ? 'translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Factory Reset button */}
                <div className="pt-6">
                  <button
                    id="reset-stats-btn"
                    onClick={resetAllProgress}
                    className="w-full bg-slate-950 text-xs font-black text-rose-400/90 hover:text-rose-400 hover:bg-slate-900/60 border border-slate-900 py-3 rounded-2xl transition shadow-sm cursor-pointer"
                  >
                    RESET PROGRESS DATA
                  </button>
                </div>
              </div>

              <div className="text-center font-mono text-[9px] text-slate-600 mt-4">
                BUBBLE SHOOTER COGNITIVE ENGINE V1.3
              </div>
            </motion.div>
          )}

          {/* 10. ACHIEVEMENTS (BADGES) SCREEN */}
          {screen === 'achievements' && (
            <motion.div
              key="achievements"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="flex-1 flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <button
                  id="achievements-back-btn"
                  onClick={() => {
                    SoundManager.playClick(settings.sfxOn);
                    setScreen('menu');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 p-2.5 rounded-xl border border-slate-800 transition-colors pointer-events-auto"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-black text-slate-100 font-display">BADGES & TROPHIES</h3>
                <div className="w-8" />
              </div>

              {/* Achievements Stack */}
              <div className="flex-1 overflow-y-auto space-y-4 max-h-[360px] pr-1">
                {ACHIEVEMENTS_LIST.map((ach) => {
                  const state = playerStats.achievements[ach.id] || { unlocked: false, progress: 0 };
                  const percent = Math.min(100, Math.floor((state.progress / ach.target) * 100));

                  return (
                    <div
                      key={ach.id}
                      id={`achievement-item-${ach.id}`}
                      className={`p-3.5 rounded-2xl border transition ${
                        state.unlocked
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          {state.unlocked ? (
                            <CheckCircle className="w-5 h-5 text-amber-400" />
                          ) : (
                            <Award className="w-5 h-5 text-slate-500" />
                          )}
                          <div>
                            <h4 className="text-xs font-black text-slate-100">{ach.title}</h4>
                            <p className="text-[10px] text-slate-400">{ach.description}</p>
                          </div>
                        </div>

                        {state.unlocked && (
                          <span className="text-[10px] font-black text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
                            Claimed +{ach.rewardCoins}
                          </span>
                        )}
                      </div>

                      {/* Progress Line */}
                      <div className="flex items-center gap-3 justify-between">
                        <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${state.unlocked ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {state.progress} / {ach.target}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
