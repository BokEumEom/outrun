import React from 'react';
import * as Drive from '../engine';
import { STAGE_WEATHER_PRESETS } from '../weather';
import { Wrench, X, Compass, CloudRain, Flag, Zap } from 'lucide-react';

interface ServiceMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreview: (z: number, stageIdx?: number, isCurve?: boolean, isCrash?: boolean) => void;
  onStartGame: (demo?: boolean) => void;
  activeWeatherIndex: number | null;
  onSetWeather: (index: number | null) => void;
  onJumpSCurve: () => void;
}

export const ServiceMenuModal: React.FC<ServiceMenuModalProps> = ({
  isOpen,
  onClose,
  onPreview,
  activeWeatherIndex,
  onSetWeather,
  onJumpSCurve,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[680px] max-h-[90vh] overflow-y-auto bg-[#070c14] border-4 border-[#38bdf8] rounded-xl p-4 sm:p-6 shadow-[0_0_50px_rgba(56,189,248,0.35),inset_0_2px_4px_rgba(255,255,255,0.15)] text-[#f8fafc] font-arcade">
        {/* Corner Rivets */}
        <span className="absolute top-2 left-2 text-[#38bdf8] text-xs">✦</span>
        <span className="absolute top-2 right-2 text-[#38bdf8] text-xs">✦</span>
        <span className="absolute bottom-2 left-2 text-[#38bdf8] text-xs">✦</span>
        <span className="absolute bottom-2 right-2 text-[#38bdf8] text-xs">✦</span>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1e3a5f] pb-3 mb-4">
          <div className="flex items-center gap-2 text-[#7dd3fc]">
            <Wrench className="w-5 h-5 text-[#38bdf8]" />
            <span className="text-sm sm:text-base tracking-wider [text-shadow:0_0_10px_#38bdf8]">
              SEGA SYSTEM 16 · SERVICE & TEST MENU
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

        {/* SECTION 1: COURSE SECTOR SELECTOR */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs text-[#ffd18c] mb-2 border-b border-[#1e293b] pb-1">
            <Compass className="w-4 h-4 text-[#f59e0b]" />
            <span>COURSE ROUTE & SECTOR TELEPORT</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[9px]">
            <button
              onClick={() => {
                onPreview(145000);
                onClose();
              }}
              className="bg-[#0f2838] hover:bg-[#163b52] border border-[#38bdf8] text-[#bae6fd] p-2 rounded cursor-pointer transition-all text-left"
            >
              <div className="font-bold text-[#7dd3fc]">FORK 분기점</div>
              <div className="text-[8px] text-[#94a3b8]">145,000m · 코스 갈림길</div>
            </button>

            <button
              onClick={() => {
                onPreview(225000);
                onClose();
              }}
              className="bg-[#0f2838] hover:bg-[#163b52] border border-[#38bdf8] text-[#bae6fd] p-2 rounded cursor-pointer transition-all text-left"
            >
              <div className="font-bold text-[#7dd3fc]">MERGE 합류점</div>
              <div className="text-[8px] text-[#94a3b8]">225,000m · 체크포인트</div>
            </button>

            <button
              onClick={() => {
                onJumpSCurve();
                onClose();
              }}
              className="bg-[#362208] hover:bg-[#52330a] border border-[#f59e0b] text-[#fde047] p-2 rounded cursor-pointer transition-all text-left font-bold"
            >
              <div className="font-bold text-[#facc15]">S-CURVE 극한커브</div>
              <div className="text-[8px] text-[#fed7aa]">278,000m · 급회전 핸들링</div>
            </button>

            {Drive.STAGES.map((stg, i) => (
              <button
                key={stg.name}
                onClick={() => {
                  onPreview(i * Drive.STAGE_LENGTH + 5000, i);
                  onClose();
                }}
                className="bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[#e2e8f0] p-2 rounded cursor-pointer transition-all text-left"
              >
                <div className="font-bold text-[#38bdf8]">
                  STAGE {i + 1}: {stg.name.toUpperCase()}
                </div>
                <div className="text-[8px] text-[#94a3b8]">{stg.ko}</div>
              </button>
            ))}

            <button
              onClick={() => {
                onPreview(Drive.END - 20000, 5);
                onClose();
              }}
              className="bg-[#1e3a1e] hover:bg-[#2d572d] border border-[#4ade80] text-[#86efac] p-2 rounded cursor-pointer transition-all text-left font-bold"
            >
              <div className="font-bold text-[#4ade80]">GOAL 골인 라인</div>
              <div className="text-[8px] text-[#bbf7d0]">엔딩 축하 시퀀스</div>
            </button>

            <button
              onClick={() => {
                onPreview(65000, undefined, false, true);
                onClose();
              }}
              className="bg-[#450a0a] hover:bg-[#7f1d1d] border border-[#ef4444] text-[#fca5a5] p-2 rounded cursor-pointer transition-all text-left font-bold"
            >
              <div className="font-bold text-[#f87171]">CRASH 충돌 테스트</div>
              <div className="text-[8px] text-[#fecaca]">스핀 및 충돌 연출</div>
            </button>
          </div>
        </div>

        {/* SECTION 2: DYNAMIC WEATHER LAB */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs text-[#ffd18c] mb-2 border-b border-[#1e293b] pb-1">
            <CloudRain className="w-4 h-4 text-[#38bdf8]" />
            <span>DYNAMIC WEATHER CONTROL LAB</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[9px]">
            <button
              onClick={() => onSetWeather(null)}
              className={`p-2 rounded cursor-pointer transition-all border text-left flex flex-col justify-center ${
                activeWeatherIndex === null
                  ? 'bg-[#0284c7] text-white border-[#38bdf8] shadow-[0_0_10px_#0284c7]'
                  : 'bg-[#0f172a] text-[#94a3b8] border-[#334155] hover:border-[#64748b]'
              }`}
            >
              <div className="font-bold">🔄 DYNAMIC AUTO</div>
              <div className="text-[8px] opacity-80">코스 주행 시 자동 전환</div>
            </button>

            {STAGE_WEATHER_PRESETS.map((preset, idx) => (
              <button
                key={preset.type}
                onClick={() => onSetWeather(idx)}
                className={`p-2 rounded cursor-pointer transition-all border text-left ${
                  activeWeatherIndex === idx
                    ? 'bg-[#b45309] text-[#fef3c7] border-[#f59e0b] shadow-[0_0_10px_#f59e0b]'
                    : 'bg-[#1e293b] text-[#cbd5e1] border-[#475569] hover:border-[#94a3b8]'
                }`}
                title={preset.description}
              >
                <div className="flex items-center gap-1 font-bold">
                  <span>{preset.icon}</span>
                  <span>{preset.ko}</span>
                </div>
                <div className="text-[8px] opacity-70 font-mono">({preset.name})</div>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 3: INSTRUCTION QUICK GUIDE */}
        <div>
          <div className="flex items-center gap-2 text-xs text-[#ffd18c] mb-2 border-b border-[#1e293b] pb-1">
            <Flag className="w-4 h-4 text-[#ffd18c]" />
            <span>CABINET CONTROLS & SHORTCUTS GUIDE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] font-retro text-[#cbd5e1] bg-[#03060a] p-3 rounded border border-[#1e293b]">
            <div className="space-y-1">
              <div><span className="font-arcade text-[#38bdf8]">◀ / ▶ (A/D)</span>: 스티어링 핸들 조작</div>
              <div><span className="font-arcade text-[#f87171]">↓ / S (BRAKE)</span>: 급제동 브레이크</div>
              <div><span className="font-arcade text-[#4ade80]">↑ / W (GAS)</span>: 가속 페달</div>
            </div>
            <div className="space-y-1">
              <div><span className="font-arcade text-[#facc15]">SPACE / SHIFT</span>: 2단 기어 (LOW ↔ HIGH)</div>
              <div><span className="font-arcade text-[#38bdf8]">P / ESC</span>: 게임 일시정지</div>
              <div><span className="font-arcade text-[#ffd18c]">5 / C</span>: 25¢ 동전 투입 (CREDIT)</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-[#1e3a5f] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#38bdf8] hover:bg-[#0284c7] text-[#070c14] font-bold text-xs rounded cursor-pointer transition-colors"
          >
            서비스 메뉴 닫기 (RETURN TO GAME)
          </button>
        </div>
      </div>
    </div>
  );
};
