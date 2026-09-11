import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { STAGES } from '../engine';
import { STAGE_WEATHER_PRESETS } from '../weather';
import { Flag, Sparkles, Navigation, Gauge, CloudRain } from 'lucide-react';

interface StageTransitionOverlayProps {
  stageIndex: number;
  type: 'natural' | 'preview';
  visible: boolean;
  onClose: () => void;
}

export const StageTransitionOverlay: React.FC<StageTransitionOverlayProps> = ({
  stageIndex,
  type,
  visible,
  onClose,
}) => {
  const stage = STAGES[stageIndex] || STAGES[0];

  useEffect(() => {
    if (!visible) return;
    const duration = type === 'natural' ? 2200 : 1600;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, type, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="stage-transition-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-auto cursor-pointer select-none overflow-hidden"
        >
          {/* Top shutter bar */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="w-full bg-[#05111c]/95 border-b-2 shadow-lg backdrop-blur-sm px-4 py-2 flex items-center justify-between"
            style={{ borderColor: stage.accentColor || '#38bdf8' }}
          >
            <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#9ec4ce]">
              <Flag className="w-3.5 h-3.5 text-[#ffda85]" />
              <span className="font-bold text-white uppercase">
                OUT RUN SECTOR 0{stageIndex + 1}
              </span>
            </div>
            <span
              className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded uppercase font-semibold text-black"
              style={{ backgroundColor: stage.accentColor || '#38bdf8' }}
            >
              {type === 'natural' ? 'STAGE ADVANCE' : 'SECTOR TELEPORT'}
            </span>
          </motion.div>

          {/* Center Stage Card */}
          <div className="flex-1 flex items-center justify-center p-4 relative">
            {/* Speed streaks & background flare */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.6 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-x-0 h-44 bg-gradient-to-r from-transparent via-[#092233]/90 to-transparent pointer-events-none"
            />

            <motion.div
              initial={{ scale: 0.82, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 1.08, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 280 }}
              className="relative z-10 max-w-lg w-full text-center bg-[#071a28]/95 border-2 rounded-sm p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)] backdrop-blur-md"
              style={{
                borderColor: stage.accentColor || '#38bdf8',
                boxShadow: `0 0 35px ${stage.accentColor}33`,
              }}
            >
              {/* Stage number badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-[2px] bg-black/60 border border-white/10 mb-2">
                <span style={{ color: stage.accentColor || '#38bdf8' }}>
                  STAGE 0{stageIndex + 1}
                </span>
                <span className="text-white/40">/</span>
                <span className="text-white/70">06</span>
              </div>

              {/* Roman Stage Name */}
              <h2
                className="text-3xl sm:text-4xl font-extrabold italic tracking-tight uppercase [text-shadow:2px_3px_#000]"
                style={{ color: stage.secondaryColor || '#ffda85' }}
              >
                {stage.name}
              </h2>

              {/* Korean Stage Name & Subtitle */}
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-base sm:text-lg font-bold text-white">
                  {stage.ko}
                </span>
                <span className="text-xs text-[#8ab3be]">·</span>
                <span className="text-xs sm:text-sm text-[#c7e4eb]">
                  {stage.subtitle}
                </span>
              </div>

              {/* Atmospheric Weather Shift Notice */}
              {STAGE_WEATHER_PRESETS[stageIndex] && (
                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded bg-[#07131e] border border-[#38bdf8]/40 shadow-inner">
                  <span className="text-sm">
                    {STAGE_WEATHER_PRESETS[stageIndex].icon}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#ffd18c]">
                    날씨: {STAGE_WEATHER_PRESETS[stageIndex].ko} ({STAGE_WEATHER_PRESETS[stageIndex].name})
                  </span>
                  <span className="hidden sm:inline text-white/30 text-[10px]">·</span>
                  <span className="hidden sm:inline text-[#94d8f6] text-[10px]">
                    {STAGE_WEATHER_PRESETS[stageIndex].description}
                  </span>
                </div>
              )}

              {/* Status / Bonus Announcement Banner */}
              <div className="mt-4 py-2 px-3 rounded bg-black/50 border border-white/10 flex items-center justify-center gap-2">
                {type === 'natural' ? (
                  <>
                    <Sparkles className="w-4 h-4 text-[#ffd18c] animate-pulse" />
                    <span className="text-xs sm:text-sm font-bold tracking-wide text-[#ffea9f]">
                      STAGE CLEAR! 시간 보너스 +27초 획득!
                    </span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 text-[#83eddf]" />
                    <span className="text-xs sm:text-sm font-semibold tracking-wide text-[#83eddf]">
                      코스 진입 완료 · 시승 준비
                    </span>
                  </>
                )}
              </div>

              {/* Stage Progress indicator dots */}
              <div className="mt-4 flex items-center justify-center gap-2">
                {STAGES.map((s, idx) => (
                  <div
                    key={s.name}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-7 sm:w-9 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor:
                          idx === stageIndex
                            ? stage.accentColor || '#38bdf8'
                            : idx < stageIndex
                            ? '#2b6070'
                            : '#142c38',
                        boxShadow:
                          idx === stageIndex
                            ? `0 0 8px ${stage.accentColor}`
                            : 'none',
                      }}
                    />
                    <span
                      className="text-[9px] font-mono"
                      style={{
                        color: idx === stageIndex ? '#ffffff' : '#658b97',
                        fontWeight: idx === stageIndex ? 'bold' : 'normal',
                      }}
                    >
                      0{idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Telemetry Footer */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-around text-[11px] font-mono text-[#86a8b4]">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-[#ffda85]" />
                  최고속도 290 km/h
                </span>
                <span>구간 48,000m</span>
                <span className="text-white/50 text-[10px]">클릭하여 즉시 주행</span>
              </div>
            </motion.div>
          </div>

          {/* Bottom shutter bar */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="w-full bg-[#05111c]/95 border-t-2 shadow-lg backdrop-blur-sm px-4 py-2 flex items-center justify-between text-[11px] font-mono text-[#86a4b1]"
            style={{ borderColor: stage.accentColor || '#38bdf8' }}
          >
            <span>OUT RUN / 1986 HIGH-SPEED ARCADE SIMULATOR</span>
            <span className="text-white/70">6 LANES · DIVERGE & MERGE</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
