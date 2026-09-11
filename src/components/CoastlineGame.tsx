import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Drive from '../engine';
import { GameState, InputState } from '../types';
import { Assets, H, loadAllAssets, renderEnding, renderGame, W } from '../renderer';
import { SoundEngine } from '../audio';
import { StageTransitionOverlay } from './StageTransitionOverlay';
import {
  Play,
  Pause as PauseIcon,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Car,
  Compass,
  Zap,
} from 'lucide-react';

interface OverlayState {
  show: boolean;
  title: string;
  desc: string;
  buttonText: string;
}

export const CoastlineGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cabinetRef = useRef<HTMLDivElement | null>(null);

  const [assets, setAssets] = useState<Assets | null>(null);
  const [loadProgress, setLoadProgress] = useState<string>('이미지 준비 중…');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [autoGas, setAutoGas] = useState<boolean>(true);
  const [fpsStatus, setFpsStatus] = useState<string>('로딩 중');
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [stageTransition, setStageTransition] = useState<{
    visible: boolean;
    stageIndex: number;
    type: 'natural' | 'preview';
  }>({
    visible: false,
    stageIndex: 0,
    type: 'preview',
  });

  const [overlay, setOverlay] = useState<OverlayState>({
    show: true,
    title: 'COASTLINE\nREBORN',
    desc: '낮은 차체, 넓은 도로, 해안선의 그 너머로.\n해안·도시·고원·사막·유적·석양, 6개 스테이지를 질주하자.',
    buttonText: '이미지 준비 중…',
  });

  // Mutable refs for high-frequency game loop
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const stateRef = useRef<GameState>(Drive.create());
  const keysRef = useRef<Record<string, boolean>>({});
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const isDemoRef = useRef<boolean>(false);
  const autoGasRef = useRef<boolean>(true);
  const endingRef = useRef<number>(-1);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimeRef = useRef<number>(0);
  const lastStageRef = useRef<number>(0);

  const triggerStageTransition = useCallback(
    (stageIdx: number, type: 'natural' | 'preview') => {
      lastStageRef.current = stageIdx;
      setStageTransition({
        visible: true,
        stageIndex: stageIdx,
        type,
      });
      if (soundEngineRef.current) {
        soundEngineRef.current.playStageFanfare();
      }
    },
    []
  );

  // Initialize sound engine
  useEffect(() => {
    const sound = new SoundEngine('/media/MUSIC_DATA.mp3');
    soundEngineRef.current = sound;
    return () => {
      sound.destroy();
    };
  }, []);

  // Load assets
  useEffect(() => {
    loadAllAssets((loaded, total) => {
      setLoadProgress(`${loaded}/${total} 로딩 중…`);
    }).then((loadedAssets) => {
      setAssets(loadedAssets);
      setIsLoaded(true);
      setFpsStatus('준비 완료');
      setOverlay((prev) => ({
        ...prev,
        buttonText: '해안선으로',
      }));
    });
  }, []);

  const finishGame = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    const s = stateRef.current;
    const sound = soundEngineRef.current;

    if (s.won) {
      endingRef.current = 0;
      if (sound) sound.syncMusic(false, 0, false);
      return;
    }

    if (sound) sound.syncMusic(false, -1, false);
    setOverlay({
      show: true,
      title: 'ONE MORE\nDRIVE',
      desc: '다음에는 차량을 피하면서 해안선 너머로 완주해보세요.',
      buttonText: '다시 달리기',
    });
  }, []);

  const startGame = useCallback((demo: boolean = false, skipInitialTransition: boolean = false) => {
    if (!assets || !assets.loaded) return;
    const sound = soundEngineRef.current;
    if (sound) {
      sound.init();
      sound.resume();
      sound.resetMusicTime();
      sound.syncMusic(true, -1, false);
    }

    endingRef.current = -1;
    stateRef.current = Drive.create();
    lastStageRef.current = 0;
    isDemoRef.current = demo;
    isPlayingRef.current = true;
    isPausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);

    setOverlay((prev) => ({ ...prev, show: false }));
    if (!skipInitialTransition) {
      triggerStageTransition(0, 'preview');
    }
  }, [assets, triggerStageTransition]);

  const togglePause = useCallback(() => {
    if (!isPlayingRef.current && endingRef.current < 0) return;
    const nextPaused = !isPausedRef.current;
    isPausedRef.current = nextPaused;
    setIsPaused(nextPaused);
    if (soundEngineRef.current) {
      soundEngineRef.current.syncMusic(isPlayingRef.current, endingRef.current, nextPaused);
    }
  }, []);

  const toggleSound = useCallback(() => {
    const sound = soundEngineRef.current;
    if (!sound) return;
    const next = !soundOn;
    sound.soundEnabled = next;
    setSoundOn(next);
    sound.init();
    sound.resume();
    sound.syncMusic(isPlayingRef.current, endingRef.current, isPausedRef.current);
  }, [soundOn]);

  const toggleFullscreen = useCallback(() => {
    if (!cabinetRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      cabinetRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const preview = useCallback((z: number, stageIdx?: number, isCurve = false, isCrash = false) => {
    const targetStage = stageIdx !== undefined ? stageIdx : Drive.stageIndex(z);
    startGame(!isCurve && !isCrash, true);
    const s = stateRef.current;
    s.z = z;
    s.speed = Drive.MAX;
    s.x = Drive.roads(z)[0].x;
    s.route = z > 152000 ? 'SEASIDE' : '';
    s.stage = targetStage;
    lastStageRef.current = targetStage;
    if (z > 240000) {
      s.checkpoint = 1;
    }
    if (isCrash) {
      s.traffic = [{ z: z + 100, lane: 2, speed: 0, type: 4, passed: false }];
      s.x = Drive.trafficX(s.traffic[0]);
    }
    triggerStageTransition(targetStage, 'preview');
  }, [startGame, triggerStageTransition]);

  // Main game tick and render loop
  useEffect(() => {
    if (!assets) return;

    const loop = (t: number) => {
      let dt = Math.min((t - lastTimeRef.current) / 1000 || 0, 0.2);
      lastTimeRef.current = t;

      const s = stateRef.current;
      const sound = soundEngineRef.current;

      if (isPlayingRef.current && !isPausedRef.current) {
        for (let remaining = dt; remaining > 0; ) {
          const step = Math.min(remaining, 1 / 60);
          Drive.update(s, step, {
            ...keysRef.current,
            gas: keysRef.current.gas || autoGasRef.current,
            demo: isDemoRef.current,
            branch: 'left',
          });
          remaining -= step;
        }

        const currentStage = Drive.stageIndex(s.z);
        if (currentStage > lastStageRef.current && currentStage < 6) {
          lastStageRef.current = currentStage;
          triggerStageTransition(currentStage, 'natural');
        }

        if (s.over) {
          finishGame();
        }
      }

      if (endingRef.current >= 0 && !isPausedRef.current) {
        endingRef.current = Math.min(23, endingRef.current + dt);
      }

      if (sound) {
        const throttle =
          !s.braking &&
          (keysRef.current.gas || autoGasRef.current || isDemoRef.current);
        sound.updateEngine(
          s,
          isPlayingRef.current,
          isPausedRef.current,
          endingRef.current,
          throttle
        );
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          if (endingRef.current >= 0) {
            renderEnding(ctx, s, assets, endingRef.current, () => {
              setOverlay({
                show: true,
                title: 'WHAT A\nFINISH!',
                desc: `트로피는 그녀의 품으로! ${s.elapsed.toFixed(1)}초 만에 완주 / 충돌 ${s.hits}회`,
                buttonText: '다시 달리기',
              });
            });
          } else {
            renderGame(ctx, s, assets, isPausedRef.current, isDemoRef.current);
          }
        }
      }

      frameCountRef.current++;
      fpsTimeRef.current += dt;
      if (fpsTimeRef.current >= 1) {
        const fps = Math.round(frameCountRef.current / fpsTimeRef.current);
        frameCountRef.current = 0;
        fpsTimeRef.current = 0;
        const pct = Math.min(100, Math.round((s.z / Drive.END) * 100));
        setFpsStatus(`${fps} fps · ${pct}% · 6차선 / 분기·합류`);
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [assets, finishGame]);

  // Keyboard controls
  useEffect(() => {
    const keyMap: Record<string, string> = {
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
      ArrowUp: 'gas',
      w: 'gas',
      W: 'gas',
      ArrowDown: 'brake',
      s: 'brake',
      S: 'brake',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mapped = keyMap[e.key];
      if (mapped) {
        e.preventDefault();
        keysRef.current[mapped] = true;
      }
      if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
        togglePause();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mapped = keyMap[e.key];
      if (mapped) {
        keysRef.current[mapped] = false;
      }
    };

    const handleBlur = () => {
      keysRef.current = {};
      if (isPlayingRef.current && !isPausedRef.current) {
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [togglePause]);

  const setTouchKey = (key: string, pressed: boolean) => {
    keysRef.current[key] = pressed;
    if (pressed && soundEngineRef.current) {
      soundEngineRef.current.resume();
    }
  };

  return (
    <main
      id="main-cabinet"
      className="w-full max-w-[1100px] mx-auto p-2 sm:p-4 text-[#fff5df] font-sans select-none"
    >
      {/* Header marquee */}
      <header
        id="arcade-header"
        className="flex items-center justify-between mb-2.5 text-[11px] tracking-[3px] text-[#7fafb9] uppercase font-mono"
      >
        <b className="text-[#ffc083] text-base tracking-normal font-sans font-bold">
          COASTLINE / REBORN
        </b>
        <span className="hidden sm:inline">SIX STAGES · COAST TO ANCIENT ROAD</span>
      </header>

      {/* Retro Arcade Cabinet Section */}
      <section
        id="cabinet-screen-section"
        ref={cabinetRef}
        className="relative bg-black rounded-sm shadow-[0_24px_70px_rgba(0,0,0,0.7)] overflow-hidden border border-[#1b3447]"
      >
        <canvas
          id="screen"
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full aspect-[4/3] block [image-rendering:pixelated]"
          aria-label="6차선 해안 레이싱 화면"
        />

        {/* Stage Transition & Teleport Loading Overlay */}
        <StageTransitionOverlay
          stageIndex={stageTransition.stageIndex}
          type={stageTransition.type}
          visible={stageTransition.visible && isPlaying}
          onClose={() =>
            setStageTransition((prev) => ({ ...prev, visible: false }))
          }
        />

        {/* Overlay start/finish menu */}
        {overlay.show && (
          <div
            id="overlay"
            className="absolute inset-0 grid place-items-center bg-[#05243c]/70 backdrop-blur-[2px] p-4 transition-all"
          >
            <div
              id="start-panel"
              className="px-6 py-7 sm:px-11 sm:py-8 text-center bg-[#092538]/95 border-t-[3px] border-t-[#ffda85] border-b-[3px] border-b-[#56dbc9] shadow-2xl max-w-[92%] rounded-sm"
            >
              <small className="tracking-[4px] text-[#83eddf] text-xs uppercase font-bold block mb-1">
                A DRIVE TO REMEMBER
              </small>
              <h1
                id="title"
                className="font-bold italic text-3xl sm:text-5xl md:text-6xl leading-[0.95] my-3.5 text-[#ffbd85] tracking-tight [text-shadow:3px_4px_#71434e] whitespace-pre-line"
              >
                {overlay.title}
              </h1>
              <p
                id="desc"
                className="text-xs sm:text-[13px] leading-relaxed text-[#d5e9e9] my-3 whitespace-pre-line"
              >
                {overlay.desc}
              </p>

              <div className="flex flex-wrap justify-center gap-3 my-4">
                <button
                  id="start"
                  disabled={!isLoaded}
                  onClick={() => startGame(false)}
                  className="cursor-pointer bg-[#ffd18c] hover:bg-[#ffe2a8] text-[#132b3a] font-bold text-sm sm:text-base px-6 py-2.5 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow"
                >
                  {isLoaded ? overlay.buttonText : loadProgress}
                </button>
                <button
                  id="demo"
                  disabled={!isLoaded}
                  onClick={() => startGame(true)}
                  className="cursor-pointer bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] font-semibold text-sm sm:text-base px-4 py-2.5 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  데모 주행
                </button>
              </div>

              <p className="text-[11px] sm:text-xs text-[#a0c5c9] leading-relaxed mt-2 border-t border-[#1a4454] pt-2">
                ← → 핸들　↓ 브레이크　↑ 액셀<br />
                자동 액셀 ON 시 핸들 조작만으로 주행할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Control Buttons Bar */}
      <div
        id="controls-bar"
        className="flex items-center gap-2 sm:gap-2.5 mt-3 flex-wrap text-xs sm:text-[13px]"
      >
        <label
          id="auto-accel-label"
          className="flex items-center gap-1.5 cursor-pointer mr-auto text-[#bcced2] hover:text-white transition-colors"
        >
          <input
            id="auto"
            type="checkbox"
            checked={autoGas}
            onChange={(e) => {
              setAutoGas(e.target.checked);
              autoGasRef.current = e.target.checked;
            }}
            className="accent-[#ffd18c] rounded cursor-pointer w-4 h-4"
          />
          <Zap className="w-3.5 h-3.5 text-[#ffd18c]" />
          자동 액셀
        </label>

        <button
          id="pause"
          onClick={togglePause}
          className="flex items-center gap-1.5 bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] rounded-sm font-semibold px-3 py-2 transition-colors cursor-pointer"
        >
          {isPaused ? <Play className="w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
          {isPaused ? '재개' : '일시정지'}
        </button>

        <button
          id="sound"
          onClick={toggleSound}
          className="flex items-center gap-1.5 bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] rounded-sm font-semibold px-3 py-2 transition-colors cursor-pointer"
        >
          {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#83eddf]" /> : <VolumeX className="w-3.5 h-3.5 text-[#ff8f8f]" />}
          {soundOn ? '음향 ON' : '음향 OFF'}
        </button>

        <button
          id="restart"
          onClick={() => startGame(false)}
          className="flex items-center gap-1.5 bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] rounded-sm font-semibold px-3 py-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          다시하기
        </button>

        <button
          id="full"
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] rounded-sm font-semibold px-3 py-2 transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          전체화면
        </button>
      </div>

      {/* Onscreen Touch / Gamepad Controls */}
      <div
        id="touch-controls"
        className="flex gap-2 mt-2.5 select-none"
      >
        <button
          data-key="left"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setTouchKey('left', true);
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            setTouchKey('left', false);
          }}
          onPointerCancel={() => setTouchKey('left', false)}
          className="touch-none min-w-[70px] sm:min-w-[80px] h-12 bg-[#163647] active:bg-[#ffda85] active:text-[#132b3a] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] font-bold text-lg rounded-sm flex items-center justify-center transition-colors cursor-pointer"
        >
          ◀
        </button>
        <button
          data-key="right"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setTouchKey('right', true);
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            setTouchKey('right', false);
          }}
          onPointerCancel={() => setTouchKey('right', false)}
          className="touch-none min-w-[70px] sm:min-w-[80px] h-12 bg-[#163647] active:bg-[#ffda85] active:text-[#132b3a] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] font-bold text-lg rounded-sm flex items-center justify-center transition-colors cursor-pointer"
        >
          ▶
        </button>

        <div className="flex-1" />

        <button
          data-key="brake"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setTouchKey('brake', true);
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            setTouchKey('brake', false);
          }}
          onPointerCancel={() => setTouchKey('brake', false)}
          className="touch-none min-w-[75px] sm:min-w-[85px] h-12 bg-[#3f191b] active:bg-[#ff4b4b] active:text-white hover:bg-[#522123] border border-[#853f41] text-[#fcd8d8] font-bold text-xs sm:text-sm rounded-sm flex items-center justify-center transition-colors cursor-pointer"
        >
          BRAKE
        </button>
        <button
          data-key="gas"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setTouchKey('gas', true);
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            setTouchKey('gas', false);
          }}
          onPointerCancel={() => setTouchKey('gas', false)}
          className="touch-none min-w-[75px] sm:min-w-[85px] h-12 bg-[#153e36] active:bg-[#34d399] active:text-[#0b241e] hover:bg-[#1e5247] border border-[#3b7a6c] text-[#d6faee] font-bold text-xs sm:text-sm rounded-sm flex items-center justify-center transition-colors cursor-pointer"
        >
          GAS
        </button>
      </div>

      {/* Course Previews and Debug Drawer */}
      <details
        id="course-preview-details"
        open={previewOpen}
        onToggle={(e) => setPreviewOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mt-3 text-[#90adb7] text-xs border border-[#1b3447] rounded-sm p-2.5 bg-[#0a1824]"
      >
        <summary className="cursor-pointer font-semibold text-[#83eddf] hover:text-white transition-colors flex items-center gap-1.5 list-none">
          <Compass className="w-3.5 h-3.5" />
          <span>코스 미리보기 · 테스트 주행 (클릭하여 펼치기)</span>
        </summary>
        <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-[#1a384e]">
          <button
            id="forkPreview"
            onClick={() => preview(145000)}
            className="bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
          >
            분기점에서 시승
          </button>
          <button
            id="mergePreview"
            onClick={() => preview(225000)}
            className="bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
          >
            합류점에서 시승
          </button>
          <button
            onClick={() => preview(65000)}
            className="bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
          >
            요트 해변에서 시승
          </button>
          {Drive.STAGES.map((stg, i) => (
            <button
              key={stg.name}
              onClick={() => preview(i * Drive.STAGE_LENGTH + 5000, i)}
              className="bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
            >
              {i + 1}：{stg.ko}
            </button>
          ))}
          <button
            onClick={() => {
              startGame(false);
              const s = stateRef.current;
              s.z = 278000;
              s.speed = Drive.MAX;
              s.checkpoint = 1;
            }}
            className="bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
          >
            한계 커브 시승
          </button>
          <button
            onClick={() => preview(Drive.END - 20000, 5)}
            className="bg-[#163647] hover:bg-[#285267] border border-[#477481] text-[#f9f3dc] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
          >
            골인 직전 시승
          </button>
          <button
            onClick={() => preview(65000, undefined, false, true)}
            className="bg-[#4a1c1d] hover:bg-[#632728] border border-[#833a3c] text-[#ffd6d6] px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs"
          >
            고속 충돌 확인
          </button>
        </div>
      </details>

      {/* Button & Feature Guide */}
      <section
        id="game-guide"
        aria-label="조작 안내"
        className="mt-4 p-3.5 bg-[#102532] border border-[#1d3d52] rounded-sm text-[#d5e9e9] text-xs sm:text-[13px] leading-relaxed"
      >
        <b className="text-[#ffc083] font-bold block mb-1 text-sm">조작 안내</b>
        <p className="space-y-1">
          <span><b>◀ / ▶</b>：좌우로 핸들을 조작합니다 (← → / A·D)</span><br />
          <span><b>BRAKE</b>：누르고 있는 동안 감속합니다. 급커브 직전에 사용합니다 (↓ / S)</span><br />
          <span><b>GAS</b>：누르고 있는 동안 가속합니다 (↑ / W). 자동 액셀 ON 시 누르지 않아도 가속합니다.</span><br />
          <span><b>일시정지 / 재개</b>：주행과 사운드를 멈추거나 다시 시작합니다 (P)</span><br />
          <span><b>음향 ON / OFF</b>：BGM, 엔진음, 타이어 스키드음을 함께 켜고 끕니다. 주행 시작 시 재생됩니다.</span><br />
          <span><b>다시하기</b>：스테이지 1부터 다시 시작　｜　<b>전체화면</b>：화면을 확대 (Esc로 복귀)</span><br />
          <span><b>데모 주행</b>：AI 자동 운전　｜　<b>코스 미리보기</b>：각 스테이지 및 극한 코스 테스트</span>
        </p>
      </section>

      {/* Footer info */}
      <footer
        id="arcade-footer"
        className="text-[11px] leading-relaxed text-[#86a4b1] mt-2.5 font-mono flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1"
      >
        <div>
          방향키 / WASD로 조작 · P로 일시정지 · 분기점은 왼쪽이 SEASIDE, 오른쪽이 HIGHLAND · 합류 지점에서 시간 추가
        </div>
        <span id="status" className="text-[#83eddf] font-semibold">
          {fpsStatus}
        </span>
      </footer>
    </main>
  );
};
