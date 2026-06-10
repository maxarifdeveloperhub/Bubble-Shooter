export interface Level {
  id: number;
  name: string;
  grid: (string | null)[][]; // colors: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | null
  targetScore: number;
  maxShots: number;
  unlockedAt: number; // minimum stars of level id - 1 or level completed index
}

export interface PlayerStats {
  coins: number;
  levelProgress: { [levelId: number]: { completed: boolean; score: number; stars: number } };
  highScore: number;
  dailyRewardLastClaimed: string | null; // Date ISO string
  achievements: { [achievementId: string]: { unlocked: boolean; progress: number; unlockedAt?: string } };
  unlockedPowerups: {
     bomb: number;
     rainbow: number;
     guideLine: number;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  icon: string;
}

export interface GameSettings {
  musicOn: boolean;
  sfxOn: boolean;
  vibrationOn: boolean;
}

export type PowerUpType = 'bomb' | 'rainbow' | 'guideLine';
