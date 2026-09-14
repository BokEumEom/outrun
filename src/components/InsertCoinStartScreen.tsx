import React, { useState, useEffect, useCallback } from 'react';
import { Play, Car, Trophy, Radio, Coins, Sparkles, Volume2 } from 'lucide-react';
import titleBadgeImg from '../assets/images/outrun_title_badge_1789106037004.jpg';

export interface InsertCoinStartScreenProps {
  isLoaded: boolean;
  loadProgress: string;
  credits: number;
  selectedRadio: string;
  onSelectRadio: (track: string) => void;
  onInsertCoin: () => void;
  onStartGame: (demo: boolean) => void;
  onOpenRanking: () => void;
  soundEnabled?: boolean;
  onPlayCoinSound?: () => void;
  onPlayStartFanfare?: () => void;
  isGameOver?: boolean;
  gameOverStats?: string;
}

export const InsertCoinStartScreen: React.FC<InsertCoinStartScreenProps> = ({
  isLoaded,
  loadProgress,
  credits,
  selectedRadio,
  onSelectRadio,
  onInsertCoin,
  onStartGame,
  onOpenRanking,
  soundEnabled = true,
  onPlayCoinSound,
  onPlayStartFanfare,
  isGameOver = false,
  gameOverStats,
}) => {
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [coinDropping, setCoinDropping] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    isGameOver ? '★ GAME OVER · INSERT COIN TO CONTINUE ★' : '★ INSERT COIN ★'
  );
  const [flashScreen, setFlashScreen] = useState<boolean>(false);

  useEffect(() => {
    if (!isTransitioning) {
      setStatusMessage(
        isGameOver ? '★ GAME OVER · INSERT COIN TO CONTINUE ★' : '★ INSERT COIN ★'
      );
    }
  }, [isGameOver, isTransitioning]);

  // Keyboard shortcut listener for Coin (5/C) and Start (Enter/Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;

      if (e.key === '5' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        triggerInsertCoinOnly();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isLoaded) {
          handleCoinAndStart(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoaded, isTransitioning]);

  const triggerInsertCoinOnly = useCallback(() => {
    if (onPlayCoinSound) onPlayCoinSound();
    setCoinDropping(true);
    onInsertCoin();
    setTimeout(() => setCoinDropping(false), 500);
  }, [onInsertCoin, onPlayCoinSound]);

  const handleCoinAndStart = useCallback(
    (demo: boolean = false) => {
      if (!isLoaded || isTransitioning) return;

      setIsTransitioning(true);
      setCoinDropping(true);

      // Play authentic coin sound
      if (onPlayCoinSound) {
        onPlayCoinSound();
      }

      if (!demo) {
        setStatusMessage('COIN ACCEPTED! STARTING ENGINE...');
      } else {
        setStatusMessage('DEMO ATTRACTION MODE STARTING...');
      }

      // Step 1: Coin insertion chime + brief delay
      setTimeout(() => {
        setCoinDropping(false);
        if (onPlayStartFanfare) {
          onPlayStartFanfare();
        }
        setFlashScreen(true);
      }, 350);

      // Step 2: Screen warp & launch game
      setTimeout(() => {
        onStartGame(demo);
      }, 750);
    },
    [isLoaded, isTransitioning, onInsertCoin, onPlayCoinSound, onPlayStartFanfare, onStartGame]
  );

  return (
    <div
      id="insert-coin-screen"
      className={`absolute inset-0 z-20 flex items-center justify-center p-2 sm:p-4 bg-[#010810]/85 backdrop-blur-[2px] select-none transition-all duration-300 ${
        flashScreen ? 'brightness-200 contrast-125' : ''
      }`}
    >
      {/* Outer Glow & Shutter Effect during Transition */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-white/20 pointer-events-none animate-pulse z-30" />
      )}

      {/* Main Start Screen Arcade Panel */}
      <div
        id="start-panel"
        className={`relative w-full max-w-[600px] text-center bg-gradient-to-b from-[#091827] via-[#05111c] to-[#02070c] border-4 border-[#ffb703] shadow-[0_0_60px_rgba(255,183,3,0.35),inset_0_2px_0_rgba(255,255,255,0.2)] rounded p-3 sm:p-5 transition-transform duration-500 ${
          isTransitioning ? 'scale-105 opacity-90' : 'scale-100 opacity-100'
        }`}
      >
        {/* Corner Sega Brass Screws */}
        <span className="absolute top-1.5 left-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>
        <span className="absolute top-1.5 right-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>
        <span className="absolute bottom-1.5 left-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>
        <span className="absolute bottom-1.5 right-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>

        {/* Top Header Marquee Ticker */}
        <div className="flex items-center justify-between border-b border-[#1e3a4e] pb-1.5 mb-2 text-[9px] font-arcade">
          <span className="text-[#38bdf8] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#ffb703]" />
            SEGA MOTOR RACING 1986
          </span>
          <button
            onClick={onOpenRanking}
            className="cursor-pointer text-[#ffd18c] hover:text-white flex items-center gap-1 transition-colors"
            title="명예의 전당 랭킹 보기"
          >
            <Trophy className="w-3 h-3 text-[#f59e0b]" />
            <span>TOP 5 RECORD</span>
          </button>
        </div>

        {/* 1986 Out Run Pixel Art Title Art Badge */}
        <div className="relative mx-auto max-w-[420px] rounded overflow-hidden border-2 border-[#ffb703]/70 shadow-lg mb-2">
          <img
            src={titleBadgeImg}
            alt="Out Run 1986 Arcade Title Artwork"
            className="w-full h-auto max-h-[140px] object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-1.5 left-0 right-0 text-center">
            <span className="font-arcade text-[10px] sm:text-xs text-[#ffe066] drop-shadow-[0_2px_4px_#000] tracking-wider">
              MOTOR RACING ARCADE
            </span>
          </div>
        </div>

        {/* Pulsing INSERT COIN Prompt Banner */}
        <div className="my-2.5">
          <div
            className={`font-arcade text-xs sm:text-sm tracking-widest transition-colors ${
              isTransitioning
                ? 'text-[#4ade80] animate-bounce font-bold'
                : isGameOver
                ? 'text-[#f87171] animate-pulse drop-shadow-[0_0_10px_rgba(248,113,113,0.7)]'
                : 'text-[#fef08a] animate-pulse drop-shadow-[0_0_10px_rgba(254,240,138,0.7)]'
            }`}
          >
            {statusMessage}
          </div>
          {gameOverStats ? (
            <div className="font-retro text-xs sm:text-[13px] leading-relaxed text-[#fde047] my-1.5 p-2 bg-[#1b0a0a]/80 border border-[#ef4444]/60 rounded whitespace-pre-line">
              {gameOverStats}
            </div>
          ) : (
            <div className="font-retro text-xs text-[#94a3b8] mt-0.5">
              {isTransitioning
                ? '엔진 시동 중! 잠시 후 주행이 시작됩니다'
                : '화면의 코인 슬롯을 클릭하거나 START를 눌러주세요'}
            </div>
          )}
        </div>

        {/* Interactive 3D Coin Slot & Chute Centerpiece */}
        <div className="relative my-3 p-3 bg-gradient-to-b from-[#0b1622] via-[#060e17] to-[#02060b] border-2 border-[#ffb703]/60 rounded-lg shadow-inner max-w-[460px] mx-auto">
          {/* Animated Dropping Coin Graphic */}
          {coinDropping && (
            <div className="absolute left-1/2 -top-6 -translate-x-1/2 pointer-events-none z-20 animate-bounce">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ca8a04] via-[#facc15] to-[#fef08a] border-2 border-[#fff] shadow-[0_0_15px_#facc15] flex items-center justify-center text-black font-arcade text-[8px] font-black">
                25¢
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            {/* Left: Physical Arcade 25c Coin Chute Slot */}
            <div
              onClick={() => handleCoinAndStart(false)}
              className="cursor-pointer group flex-1 bg-[#101924] hover:bg-[#162536] border-2 border-[#38bdf8] hover:border-[#facc15] rounded p-2.5 shadow transition-all flex items-center gap-3"
              title="동전 넣고 바로 주행 시작 [5 / C / ENTER]"
            >
              <div className="relative w-10 h-12 bg-gradient-to-b from-[#1e293b] to-[#0f172a] rounded border border-[#64748b] flex flex-col items-center justify-center p-1 group-hover:scale-105 transition-transform flex-shrink-0">
                {/* Coin Slot Slit */}
                <div className="w-1.5 h-6 bg-black rounded-full border border-[#475569] shadow-inner mb-0.5" />
                <span className="text-[6px] font-arcade text-[#94a3b8]">25¢</span>
              </div>
              <div className="text-left">
                <div className="font-arcade text-[10px] text-[#fef08a] group-hover:text-[#fff] transition-colors flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-[#facc15]" />
                  <span>INSERT 25¢ COIN</span>
                </div>
                <div className="text-[8px] text-[#7dd3fc] font-arcade mt-0.5">
                  CLICK TO INSERT & DRIVE
                </div>
              </div>
            </div>

            {/* Right: Credits Counter Box */}
            <div className="bg-black/80 border border-[#f59e0b] px-3 py-2 rounded text-center min-w-[110px] flex-shrink-0">
              <div className="text-[8px] font-arcade text-[#94a3b8]">CREDIT(S)</div>
              <div className="text-lg font-arcade text-[#fef08a] [text-shadow:0_0_8px_#f59e0b]">
                {credits < 10 ? '0' + credits : credits}
              </div>
              <div className="text-[7px] font-retro text-[#38bdf8]">1 COIN = 1 PLAY</div>
            </div>
          </div>
        </div>

        {/* Radio Cassette Station Selector */}
        <div className="my-2.5 px-2.5 py-2 bg-[#020b12] border border-[#1e3a4e] rounded max-w-[460px] mx-auto">
          <div className="flex items-center justify-between text-[9px] font-arcade text-[#7dd3fc] mb-1.5">
            <span className="flex items-center gap-1 text-[#ffd18c]">
              <Radio className="w-3.5 h-3.5" />
              FM STEREO 108.3 BGM
            </span>
            <span className="text-[#4ade80] animate-pulse">● READY</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[8px] sm:text-[9px] font-arcade">
            {['MAGICAL SOUND SHOWER', 'PASSING BREEZE', 'SPLASH WAVE'].map((track) => (
              <button
                key={track}
                onClick={() => onSelectRadio(track)}
                className={`py-1.5 px-1 rounded truncate border transition-all cursor-pointer ${
                  selectedRadio === track
                    ? 'bg-[#0284c7] text-white border-[#7dd3fc] shadow-[0_0_10px_rgba(2,132,199,0.5)]'
                    : 'bg-[#0b1b26] text-[#94a3b8] border-[#1e293b] hover:text-white'
                }`}
              >
                {track.replace('SOUND SHOWER', 'SHOWER')}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button Controls Row */}
        <div className="flex flex-wrap justify-center gap-3 my-3">
          {/* Big Convex Arcade START BUTTON */}
          <button
            id="start-insert-btn"
            disabled={!isLoaded || isTransitioning}
            onClick={() => handleCoinAndStart(false)}
            className="cursor-pointer font-arcade text-xs sm:text-sm px-6 sm:px-8 py-3 rounded-full bg-gradient-to-b from-[#ffd166] via-[#f59e0b] to-[#b45309] text-[#1b1100] font-black tracking-wider uppercase border-3 border-[#fef08a] shadow-[0_6px_0_#78350f,0_12px_30px_rgba(245,158,11,0.6)] active:translate-y-1.5 active:shadow-[0_1px_0_#78350f] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            {isLoaded
              ? isGameOver
                ? '이어하기 (CONTINUE)'
                : '주행 시작 (START)'
              : loadProgress}
          </button>

          {/* DEMO DRIVE BUTTON */}
          <button
            id="demo-insert-btn"
            disabled={!isLoaded || isTransitioning}
            onClick={() => handleCoinAndStart(true)}
            className="cursor-pointer font-arcade text-xs sm:text-sm px-5 sm:px-6 py-3 rounded-full bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] text-white font-bold tracking-wider uppercase border-3 border-[#bae6fd] shadow-[0_6px_0_#075985,0_12px_25px_rgba(2,132,199,0.5)] active:translate-y-1.5 active:shadow-[0_1px_0_#075985] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Car className="w-4 h-4" />
            DEMO DRIVE
          </button>

          {/* TOP 5 RANK BUTTON */}
          <button
            onClick={onOpenRanking}
            disabled={isTransitioning}
            className="cursor-pointer font-arcade text-xs sm:text-sm px-4 sm:px-5 py-3 rounded-full bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] text-[#fde047] font-bold tracking-wider uppercase border-2 border-[#f59e0b] shadow-[0_6px_0_#0f172a,0_12px_20px_rgba(245,158,11,0.3)] active:translate-y-1.5 transition-all flex items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-[#f59e0b]" />
            TOP 5 RANK
          </button>
        </div>

        {/* Footer Helper Strip */}
        <div className="flex items-center justify-between border-t border-[#1e3a4e] pt-2 text-[8px] sm:text-[9px] font-arcade text-[#94a3b8]">
          <div className="flex items-center gap-1 text-[#38bdf8]">
            <span>단축키: [5/C] 코인 투입 · [ENTER] 출발 · [A/D] 핸들</span>
          </div>
          <button
            onClick={triggerInsertCoinOnly}
            className="cursor-pointer text-[#ffd18c] hover:underline flex items-center gap-1"
          >
            <Coins className="w-3 h-3 text-[#facc15]" />
            <span>동전만 넣기 (+1 CREDIT)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
