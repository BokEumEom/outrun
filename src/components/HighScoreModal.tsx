import React, { useState } from 'react';
import { HighScoreEntry } from '../types';
import { formatLapTime, addHighScore, resetHighScores } from '../utils/highScores';
import { Trophy, X, RotateCcw, Award, Check } from 'lucide-react';

interface HighScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  scores: HighScoreEntry[];
  onScoresUpdated: (newScores: HighScoreEntry[]) => void;
  pendingRecord?: {
    lapTime: number;
    score: number;
    stageName: string;
  } | null;
  onClearPendingRecord?: () => void;
}

export const HighScoreModal: React.FC<HighScoreModalProps> = ({
  isOpen,
  onClose,
  scores,
  onScoresUpdated,
  pendingRecord,
  onClearPendingRecord,
}) => {
  const [initials, setInitials] = useState<string>('ACE');
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmitInitials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRecord) return;
    const { list } = addHighScore(
      initials,
      pendingRecord.lapTime,
      pendingRecord.score,
      pendingRecord.stageName
    );
    onScoresUpdated(list);
    setSubmitted(true);
    if (onClearPendingRecord) {
      onClearPendingRecord();
    }
  };

  const handleReset = () => {
    if (window.confirm('기록을 1986 SEGA 오리지널 기본 기록으로 초기화할까요?')) {
      const reset = resetHighScores();
      onScoresUpdated(reset);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[560px] bg-[#070d16] border-4 border-[#f59e0b] rounded-xl p-4 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.35),inset_0_2px_4px_rgba(255,255,255,0.15)] text-[#f8fafc] font-arcade">
        {/* Arcade Corner Rivets */}
        <span className="absolute top-2 left-2 text-[#f59e0b] text-xs">✦</span>
        <span className="absolute top-2 right-2 text-[#f59e0b] text-xs">✦</span>
        <span className="absolute bottom-2 left-2 text-[#f59e0b] text-xs">✦</span>
        <span className="absolute bottom-2 right-2 text-[#f59e0b] text-xs">✦</span>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1e3a5f] pb-3 mb-4">
          <div className="flex items-center gap-2 text-[#fde047]">
            <Trophy className="w-5 h-5 text-[#f59e0b]" />
            <span className="text-sm sm:text-base tracking-wider [text-shadow:0_0_10px_#f59e0b]">
              OUT RUN HALL OF FAME
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle Stencil */}
        <div className="text-center mb-4">
          <span className="text-[10px] text-[#38bdf8] tracking-widest uppercase bg-[#0d2238] px-3 py-1 rounded border border-[#0284c7]/40">
            ★ TOP 5 FASTEST LAP TIME LEADERBOARD ★
          </span>
        </div>

        {/* New High Score Entry Section (If qualifying) */}
        {pendingRecord && !submitted && (
          <form
            onSubmit={handleSubmitInitials}
            className="mb-4 p-3 bg-gradient-to-r from-[#854d0e]/40 via-[#b45309]/50 to-[#854d0e]/40 border-2 border-[#facc15] rounded-lg text-center animate-pulse"
          >
            <div className="text-xs text-[#fef08a] mb-1 flex items-center justify-center gap-1.5">
              <Award className="w-4 h-4 text-[#facc15]" />
              <span>NEW RECORD! 이니셜을 등록하세요!</span>
            </div>
            <div className="text-[10px] text-[#fed7aa] mb-2">
              기록: <span className="text-white font-bold">{formatLapTime(pendingRecord.lapTime)}</span> ·
              점수: <span className="text-white font-bold">{pendingRecord.score.toLocaleString()} PTS</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <input
                type="text"
                maxLength={4}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ACE"
                className="w-24 px-2 py-1.5 bg-black border-2 border-[#fde047] text-center text-sm text-[#facc15] font-arcade tracking-widest focus:outline-none focus:ring-2 focus:ring-[#f59e0b] uppercase"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-bold text-xs rounded cursor-pointer transition-all flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>등록</span>
              </button>
            </div>
          </form>
        )}

        {/* Retro 5-Tier High Score Table */}
        <div className="overflow-hidden border-2 border-[#1e293b] rounded-lg bg-[#04080f]">
          <div className="grid grid-cols-12 gap-1 py-2 px-3 bg-[#0a1424] text-[9px] sm:text-[10px] text-[#7dd3fc] border-b border-[#1e293b] uppercase">
            <span className="col-span-2 text-center">RANK</span>
            <span className="col-span-3">DRIVER</span>
            <span className="col-span-3 text-right">LAP TIME</span>
            <span className="col-span-2 text-right">SCORE</span>
            <span className="col-span-2 text-right hidden sm:block">STAGE</span>
          </div>

          <div className="divide-y divide-[#132338]">
            {scores.map((row, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              let rankBadgeColor = 'text-[#cbd5e1]';
              let nameColor = 'text-[#e2e8f0]';
              let timeColor = 'text-[#38bdf8]';

              if (isFirst) {
                rankBadgeColor = 'text-[#facc15] font-bold';
                nameColor = 'text-[#fef08a]';
                timeColor = 'text-[#facc15]';
              } else if (isSecond) {
                rankBadgeColor = 'text-[#93c5fd]';
                nameColor = 'text-[#e0f2fe]';
                timeColor = 'text-[#60a5fa]';
              } else if (isThird) {
                rankBadgeColor = 'text-[#fb923c]';
                nameColor = 'text-[#ffedd5]';
                timeColor = 'text-[#f97316]';
              }

              return (
                <div
                  key={row.rank + row.initials + row.date}
                  className={`grid grid-cols-12 gap-1 py-2.5 px-3 text-[10px] sm:text-xs items-center ${
                    isFirst ? 'bg-[#f59e0b]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`col-span-2 text-center ${rankBadgeColor}`}>
                    {idx === 0 ? '1ST 🥇' : idx === 1 ? '2ND 🥈' : idx === 2 ? '3RD 🥉' : `${idx + 1}TH`}
                  </span>
                  <span className={`col-span-3 font-bold tracking-wider ${nameColor}`}>
                    {row.initials}
                  </span>
                  <span className={`col-span-3 text-right font-mono ${timeColor}`}>
                    {formatLapTime(row.lapTime)}
                  </span>
                  <span className="col-span-2 text-right text-[#4ade80] font-mono text-[9px] sm:text-[11px]">
                    {row.score.toLocaleString()}
                  </span>
                  <span className="col-span-2 text-right text-[8px] text-[#94a3b8] truncate hidden sm:block">
                    {row.stageName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1e3a5f] text-[9px] text-[#64748b]">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 hover:text-[#f87171] transition-colors cursor-pointer"
            title="초기 1986 기록으로 리셋"
          >
            <RotateCcw className="w-3 h-3" />
            <span>기록 초기화</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-white text-xs cursor-pointer transition-colors"
          >
            닫기 (CLOSE)
          </button>
        </div>
      </div>
    </div>
  );
};
