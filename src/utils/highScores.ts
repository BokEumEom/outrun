import { HighScoreEntry } from '../types';

const STORAGE_KEY = 'outrun_top5_high_scores_v1';

export const DEFAULT_HIGH_SCORES: HighScoreEntry[] = [
  {
    rank: 1,
    initials: 'SEGA',
    lapTime: 98.2, // 1'38"20
    score: 98500,
    stageName: 'SUNSET BAY',
    date: '1986-09-20',
  },
  {
    rank: 2,
    initials: 'YU.S',
    lapTime: 104.65, // 1'44"65
    score: 86200,
    stageName: 'ANCIENT ROAD',
    date: '1986-09-21',
  },
  {
    rank: 3,
    initials: 'OUT',
    lapTime: 112.4, // 1'52"40
    score: 74300,
    stageName: 'RED CANYON',
    date: '1986-09-22',
  },
  {
    rank: 4,
    initials: 'RUN',
    lapTime: 121.8, // 2'01"80
    score: 62900,
    stageName: 'ALPINE RUN',
    date: '1986-09-23',
  },
  {
    rank: 5,
    initials: 'ACE',
    lapTime: 134.15, // 2'14"15
    score: 51400,
    stageName: 'RIVIERA',
    date: '1986-09-24',
  },
];

export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "00'00\"00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  const cStr = String(centis).padStart(2, '0');
  return `${mStr}'${sStr}"${cStr}`;
}

export function getHighScores(): HighScoreEntry[] {
  if (typeof window === 'undefined') return DEFAULT_HIGH_SCORES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_HIGH_SCORES));
      return DEFAULT_HIGH_SCORES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5).map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
      }));
    }
    return DEFAULT_HIGH_SCORES;
  } catch {
    return DEFAULT_HIGH_SCORES;
  }
}

export function isHighScore(lapTime: number, score: number): boolean {
  if (!lapTime || lapTime <= 0) return false;
  const current = getHighScores();
  if (current.length < 5) return true;
  // Ranking is primary by fastest lap time (lower is better), or by higher score if lap times are close
  const slowestTime = current[current.length - 1].lapTime;
  const lowestScore = current[current.length - 1].score;
  return lapTime < slowestTime || score > lowestScore;
}

export function addHighScore(
  initials: string,
  lapTime: number,
  score: number,
  stageName: string
): { list: HighScoreEntry[]; rank: number } {
  const current = getHighScores();
  const cleanInitials = (initials.trim().toUpperCase() || 'DRV').slice(0, 4);

  const newEntry: HighScoreEntry = {
    rank: 0,
    initials: cleanInitials,
    lapTime: Math.max(1, lapTime),
    score: Math.max(0, Math.floor(score)),
    stageName: stageName || 'PALM COAST',
    date: new Date().toISOString().slice(0, 10),
  };

  const combined = [...current, newEntry];

  // Sort by lap time ascending (fastest first). If identical, by score descending
  combined.sort((a, b) => {
    if (Math.abs(a.lapTime - b.lapTime) > 0.05) {
      return a.lapTime - b.lapTime;
    }
    return b.score - a.score;
  });

  const top5 = combined.slice(0, 5).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(top5));
  } catch {
    // Ignore localStorage write error
  }

  const earnedRank = top5.findIndex(
    (e) => e.initials === cleanInitials && Math.abs(e.lapTime - lapTime) < 0.001
  );

  return {
    list: top5,
    rank: earnedRank >= 0 ? earnedRank + 1 : 0,
  };
}

export function resetHighScores(): HighScoreEntry[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_HIGH_SCORES));
  } catch {
    // Ignore
  }
  return DEFAULT_HIGH_SCORES;
}
