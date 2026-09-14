import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Drive from '../engine';
import { GameState, InputState } from '../types';
import { Assets, H, loadAllAssets, renderEnding, renderGame, W } from '../renderer';
import { SoundEngine } from '../audio';
import { StageTransitionOverlay } from './StageTransitionOverlay';
import { HighScoreModal } from './HighScoreModal';
import { ServiceMenuModal } from './ServiceMenuModal';
import { InsertCoinStartScreen } from './InsertCoinStartScreen';
import { globalWeatherEngine, STAGE_WEATHER_PRESETS } from '../weather';
import { getHighScores, isHighScore } from '../utils/highScores';
import { HighScoreEntry } from '../types';
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
  Radio,
  Disc,
  Coins,
  Flag,
  CloudRain,
  Sun,
  Wind,
  Trophy,
  Wrench,
} from 'lucide-react';

import arcadeMarqueeImg from '../assets/images/outrun_arcade_marquee_1789106020266.jpg';
import coinDoorImg from '../assets/images/arcade_coin_door_1789106056252.jpg';
import arcadeSteeringWheelImg from '../assets/images/arcade_steering_wheel_1789107222363.jpg';
import arcadeGearShifterImg from '../assets/images/arcade_gear_shifter_1789107237201.jpg';

interface OverlayState {
  show: boolean;
  title: string;
  desc: string;
  buttonText: string;
}

export const CoastlineGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cabinetRef = useRef<HTMLDivElement | null>(null);
  const wheelImgRef = useRef<HTMLImageElement | null>(null);

  const [assets, setAssets] = useState<Assets | null>(null);
  const [loadProgress, setLoadProgress] = useState<string>('이미지 준비 중…');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [autoGas, setAutoGas] = useState<boolean>(true);
  const [fpsStatus, setFpsStatus] = useState<string>('로딩 중');
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [credits, setCredits] = useState<number>(3);
  const [coinFlash, setCoinFlash] = useState<boolean>(false);
  const [selectedRadio, setSelectedRadio] = useState<string>('MAGICAL SOUND SHOWER');
  const [gear, setGear] = useState<'LOW' | 'HIGH'>('HIGH');
  const [pedalStates, setPedalStates] = useState<{ gas: boolean; brake: boolean }>({
    gas: false,
    brake: false,
  });
  const [steeringState, setSteeringState] = useState<'left' | 'right' | null>(null);
  const [stageTransition, setStageTransition] = useState<{
    visible: boolean;
    stageIndex: number;
    type: 'natural' | 'preview';
  }>({
    visible: false,
    stageIndex: 0,
    type: 'preview',
  });

  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() => getHighScores());
  const [isHighScoreOpen, setIsHighScoreOpen] = useState<boolean>(false);
  const [isServiceOpen, setIsServiceOpen] = useState<boolean>(false);
  const [pendingRecord, setPendingRecord] = useState<{
    lapTime: number;
    score: number;
    stageName: string;
  } | null>(null);

  const [overlay, setOverlay] = useState<OverlayState>({
    show: true,
    title: 'OUT RUN',
    desc: '낮은 차체, 넓은 도로, 해안선의 그 너머로.\n해안·도시·고원·사막·유적·석양 6개 스테이지를 질주하자.',
    buttonText: '이미지 준비 중…',
  });

  const [activeWeatherIndex, setActiveWeatherIndex] = useState<number | null>(null);
  const [weatherDisplay, setWeatherDisplay] = useState<{
    icon: string;
    ko: string;
    name: string;
    isDynamic: boolean;
  }>({
    icon: '☀️',
    ko: '맑은 해변',
    name: 'TROPICAL CLEAR',
    isDynamic: true,
  });

  const setWeather = useCallback((index: number | null) => {
    globalWeatherEngine.manualWeatherIndex = index;
    setActiveWeatherIndex(index);
    if (index !== null && STAGE_WEATHER_PRESETS[index]) {
      const p = STAGE_WEATHER_PRESETS[index];
      setWeatherDisplay({
        icon: p.icon,
        ko: p.ko,
        name: p.name,
        isDynamic: false,
      });
    } else {
      const s = stateRef.current;
      const w = globalWeatherEngine.getCurrentWeather(s.z);
      setWeatherDisplay({
        icon: w.currentProfile.icon,
        ko: w.currentProfile.ko,
        name: w.currentProfile.name,
        isDynamic: true,
      });
    }
  }, []);

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
        buttonText: '주행 시작 (START)',
      }));
    });
  }, []);

  const finishGame = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    const s = stateRef.current;
    const sound = soundEngineRef.current;

    const qualifiesForHighScore =
      !isDemoRef.current && s.elapsed > 5 && isHighScore(s.elapsed, s.score);

    if (qualifiesForHighScore) {
      const currentStageIdx = Drive.stageIndex(s.z);
      const stageName = Drive.STAGES[currentStageIdx]?.name || 'PALM COAST';
      setPendingRecord({
        lapTime: s.elapsed,
        score: s.score,
        stageName,
      });
      setIsHighScoreOpen(true);
    }

    if (s.won) {
      endingRef.current = 0;
      if (sound) sound.syncMusic(false, 0, false);
      return;
    }

    if (sound) sound.syncMusic(false, -1, false);
    setOverlay({
      show: true,
      title: 'OUT RUN\nGAME OVER',
      desc: `주행 시간: ${s.elapsed.toFixed(1)}초 · 점수: ${s.score.toLocaleString()} PTS · 충돌: ${s.hits}회\n다음에는 차량을 피하며 해안선 너머 결승점까지 달려보세요!`,
      buttonText: '다시 달리기 (RESTART)',
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

  const toggleGear = useCallback(() => {
    const nextGear = gear === 'LOW' ? 'HIGH' : 'LOW';
    setGear(nextGear);
    keysRef.current.gear = nextGear;
    stateRef.current.gear = nextGear;
    if (soundEngineRef.current) {
      soundEngineRef.current.playGearShift(nextGear === 'HIGH');
    }
  }, [gear]);

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
            gear: (keysRef.current.gear as 'LOW' | 'HIGH') || gear,
          });
          remaining -= step;
        }

        // Real-time steering wheel rotation physics
        if (wheelImgRef.current) {
          const steerVal = s.steer || 0;
          wheelImgRef.current.style.transform = `rotate(${steerVal * 38}deg)`;
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

      // Update dynamic weather particle physics & atmospheric shifts
      globalWeatherEngine.update(dt, s);

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
        const wState = globalWeatherEngine.getCurrentWeather(s.z);
        sound.updateWeather(
          wState.rainIntensity,
          wState.lightningIntensity,
          isPausedRef.current
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

        const wState = globalWeatherEngine.getCurrentWeather(s.z);
        setWeatherDisplay({
          icon: wState.currentProfile.icon,
          ko: wState.currentProfile.ko,
          name: wState.currentProfile.name,
          isDynamic: globalWeatherEngine.manualWeatherIndex === null,
        });
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
        if (mapped === 'gas') setPedalStates((p) => ({ ...p, gas: true }));
        if (mapped === 'brake') setPedalStates((p) => ({ ...p, brake: true }));
        if (mapped === 'left') setSteeringState('left');
        if (mapped === 'right') setSteeringState('right');
      }
      if ((e.code === 'Space' || e.key === ' ' || e.key === 'Shift' || e.key === 'g' || e.key === 'G') && !e.repeat) {
        e.preventDefault();
        toggleGear();
      }
      if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
        togglePause();
      }
      if ((e.key === 'c' || e.key === 'C' || e.key === '5') && !e.repeat) {
        insertCoin();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mapped = keyMap[e.key];
      if (mapped) {
        keysRef.current[mapped] = false;
        if (mapped === 'gas') setPedalStates((p) => ({ ...p, gas: false }));
        if (mapped === 'brake') setPedalStates((p) => ({ ...p, brake: false }));
        if (mapped === 'left' || mapped === 'right') setSteeringState(null);
      }
    };

    const handleBlur = () => {
      keysRef.current = {};
      setPedalStates({ gas: false, brake: false });
      setSteeringState(null);
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

  const insertCoin = useCallback(() => {
    if (soundEngineRef.current) {
      soundEngineRef.current.playCoinSound();
    }
    setCredits((prev) => Math.min(99, prev + 1));
    setCoinFlash(true);
    setTimeout(() => setCoinFlash(false), 800);
  }, []);

  const setTouchKey = (key: string, pressed: boolean) => {
    keysRef.current[key] = pressed;
    if (pressed && soundEngineRef.current) {
      soundEngineRef.current.resume();
    }
  };

  return (
    <main
      id="main-cabinet"
      className="w-full max-w-[1100px] mx-auto p-1.5 sm:p-3 text-[#fff5df] select-none font-retro"
    >
      {/* Outer Arcade Cabinet Shell */}
      <div
        id="cabinet-casing"
        className="relative bg-[#080d14] rounded-lg border-4 border-[#ff3b30]/80 shadow-[0_0_60px_rgba(255,59,48,0.25),0_30px_100px_rgba(0,0,0,0.95)] p-2 sm:p-3 overflow-hidden"
      >
        {/* Out Run 1986 Backlit Arcade Marquee Header */}
        <header
          id="arcade-marquee"
          className="relative rounded-t border-2 border-[#334155] shadow-[inset_0_2px_15px_rgba(255,255,255,0.15),0_8px_30px_rgba(0,0,0,0.8)] overflow-hidden mb-2 bg-black"
        >
          {/* Backlit Marquee Image Art */}
          <div className="relative w-full h-[90px] sm:h-[135px] md:h-[165px] overflow-hidden">
            <img
              src={arcadeMarqueeImg}
              alt="SEGA Out Run 1986 Arcade Marquee"
              className="w-full h-full object-cover object-center [filter:brightness(1.05)_contrast(1.08)]"
              referrerPolicy="no-referrer"
            />
            {/* Glossy Marquee Acrylic Glass Glare */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/50 pointer-events-none" />

            {/* Marquee Header Badges */}
            <div className="absolute top-2 left-2 right-2 flex justify-between items-center text-[9px] sm:text-[11px] font-arcade drop-shadow-[0_2px_4px_#000]">
              <span className="bg-black/85 text-[#38bdf8] px-2 py-0.5 rounded border border-[#38bdf8]/40 tracking-wider">
                ★ SEGA 1986 ★
              </span>
              <span className="bg-black/85 text-[#fde047] px-2 py-0.5 rounded border border-[#fde047]/40 tracking-wider animate-pulse">
                OUT RUN DELUXE
              </span>
            </div>

            {/* Marquee Footer Live Coin Display */}
            <div className="absolute bottom-1.5 left-2 right-2 flex justify-between items-center text-[9px] sm:text-[10px] font-arcade text-[#e2e8f0]">
              <span className="bg-black/80 text-[#a5f3fc] px-2 py-0.5 rounded border border-white/20">
                RADIO: {selectedRadio}
              </span>
              <button
                onClick={insertCoin}
                className="bg-black/80 hover:bg-[#ffb703] hover:text-black text-[#ffd18c] px-2.5 py-0.5 rounded border border-[#ffd18c]/50 cursor-pointer transition-all flex items-center gap-1.5"
                title="클릭하여 동전 투입"
              >
                <span className={coinFlash ? 'text-white animate-ping' : ''}>●</span>
                <span>{coinFlash ? 'COIN INSERTED!' : `CREDIT ${credits < 10 ? '0' + credits : credits}`}</span>
              </button>
            </div>
          </div>

          {/* Iconic Sega 6-Color Rainbow Racing Stripe */}
          <div className="h-2 w-full flex">
            <div className="flex-1 bg-[#ef4444]" />
            <div className="flex-1 bg-[#f97316]" />
            <div className="flex-1 bg-[#facc15]" />
            <div className="flex-1 bg-[#10b981]" />
            <div className="flex-1 bg-[#06b6d4]" />
            <div className="flex-1 bg-[#3b82f6]" />
          </div>
        </header>

        {/* Arcade CRT Monitor Bezel & Screen Section */}
        <section
          id="cabinet-screen-section"
          ref={cabinetRef}
          className="relative bg-[#020508] rounded border-4 border-[#1e293b] shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* Authentic CRT Cabinet Side Speaker Grills */}
          <div className="absolute top-0 bottom-0 left-0 w-3 sm:w-4 bg-[repeating-linear-gradient(0deg,#0a1017,#0a1017_4px,#16202c_4px,#16202c_8px)] border-r border-[#1e293b] z-10 opacity-75 pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-0 w-3 sm:w-4 bg-[repeating-linear-gradient(0deg,#0a1017,#0a1017_4px,#16202c_4px,#16202c_8px)] border-l border-[#1e293b] z-10 opacity-75 pointer-events-none" />

          {/* CRT Monitor Top Brand Stencil with Live Dynamic Weather Indicator */}
          <div className="w-full bg-[#0d1520] border-b border-[#1e293b] py-1 px-4 flex flex-wrap justify-between items-center text-[9px] font-arcade text-[#64748b] tracking-widest uppercase gap-1">
            <div className="flex items-center gap-2">
              <span>SEGA RASTER DISPLAY</span>
              <span className="text-white/20 hidden sm:inline">|</span>
              <span className="text-[#ffd18c] flex items-center gap-1.5">
                <span className="text-sm">{weatherDisplay.icon}</span>
                <span className="font-bold">{weatherDisplay.ko}</span>
                <span className="text-white/40 text-[8px] hidden md:inline">({weatherDisplay.name})</span>
                {weatherDisplay.isDynamic ? (
                  <span className="bg-[#0369a1] text-[#e0f2fe] px-1.5 py-0.5 text-[7px] rounded font-mono">DYNAMIC AUTO</span>
                ) : (
                  <span className="bg-[#78350f] text-[#fde68a] px-1.5 py-0.5 text-[7px] rounded font-mono">MANUAL LOCK</span>
                )}
              </span>
            </div>
            <span className="text-[#38bdf8]">60Hz NTSC</span>
          </div>

          <div className="relative px-3 sm:px-4 py-1">
            <canvas
              id="screen"
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full aspect-[4/3] block [image-rendering:pixelated] shadow-[0_0_30px_rgba(0,0,0,0.8)]"
              aria-label="Out Run 6차선 해안 레이싱 게임 화면"
            />

            {/* Authentic CRT Scanlines & Glass Tube Curvature Sheen */}
            <div className="crt-scanlines pointer-events-none absolute inset-0 mix-blend-overlay opacity-80" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.5)_100%)]" />

            {/* Stage Transition & Teleport Loading Overlay */}
            <StageTransitionOverlay
              stageIndex={stageTransition.stageIndex}
              type={stageTransition.type}
              visible={stageTransition.visible && isPlaying}
              onClose={() =>
                setStageTransition((prev) => ({ ...prev, visible: false }))
              }
            />

            {/* Authentic 1986 Out Run 'Insert Coin' Start Screen Component */}
            {overlay.show && (
              <InsertCoinStartScreen
                isLoaded={isLoaded}
                loadProgress={loadProgress}
                credits={credits}
                selectedRadio={selectedRadio}
                onSelectRadio={setSelectedRadio}
                onInsertCoin={insertCoin}
                onStartGame={startGame}
                onOpenRanking={() => {
                  soundEngineRef.current?.playButtonBeep();
                  setIsHighScoreOpen(true);
                }}
                soundEnabled={soundOn}
                onPlayCoinSound={() => soundEngineRef.current?.playCoinSound()}
                onPlayStartFanfare={() => soundEngineRef.current?.playStageFanfare()}
                isGameOver={overlay.title.includes('GAME OVER')}
                gameOverStats={overlay.title.includes('GAME OVER') ? overlay.desc : undefined}
              />
            )}
          </div>
        </section>

        {/* Streamlined Authentic 1986 SEGA OutRun Arcade Control Console */}
        <section
          id="arcade-cabinet-deck"
          className="mt-2.5 bg-gradient-to-b from-[#111722] via-[#090e15] to-[#04070b] border-2 border-[#1e293b] rounded-xl p-2.5 sm:p-3 shadow-[0_12px_32px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.06)] relative overflow-hidden"
        >
          {/* Header Bar: Sega Stencil, Auto Accel, Quick Tools (Coin, Ranking, Service, Sound, Fullscreen) */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#1e293b]/90 flex-wrap gap-2 text-xs font-arcade">
            {/* Sega Hardware Serial Stencil & Auto Accel */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#fef08a] text-[9px] tracking-wider">
                ★ SEGA RACING MOTOR 16 ★
              </span>

              {/* Auto Accel Rocker */}
              <label
                id="auto-accel-toggle"
                className="flex items-center gap-1.5 cursor-pointer bg-[#070c12] px-2 py-0.5 rounded border border-[#1e293b] hover:border-[#38bdf8] transition-colors"
                title="자동 액셀 가속 온/오프"
              >
                <input
                  id="auto"
                  type="checkbox"
                  checked={autoGas}
                  onChange={(e) => {
                    setAutoGas(e.target.checked);
                    autoGasRef.current = e.target.checked;
                    soundEngineRef.current?.playButtonBeep();
                  }}
                  className="sr-only"
                />
                <span
                  className={`w-2.5 h-2.5 rounded-full border transition-all ${
                    autoGas
                      ? 'bg-[#4ade80] border-[#86efac] shadow-[0_0_6px_#4ade80]'
                      : 'bg-[#475569] border-[#64748b]'
                  }`}
                />
                <span className="text-[8px] text-[#cbd5e1]">
                  AUTO ACCEL : {autoGas ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              {/* Insert Coin & Credits Button */}
              <button
                onClick={insertCoin}
                className="cursor-pointer group flex items-center gap-1.5 px-2.5 py-1 rounded bg-gradient-to-b from-[#f97316] to-[#c2410c] hover:from-[#fb923c] hover:to-[#ea580c] active:scale-95 border border-[#ffedd5] text-white font-arcade text-[9px] shadow-[0_0_10px_rgba(249,115,22,0.4)] transition-all"
                title="25¢ 동전 투입 [키보드: 5 또는 C]"
              >
                <Coins className="w-3 h-3 text-[#fef08a] group-hover:rotate-12 transition-transform" />
                <span>25¢ COIN</span>
                <span className="bg-black/60 px-1 py-0.2 rounded text-[#fde047] font-mono text-[8px]">
                  {credits < 10 ? '0' + credits : credits}
                </span>
              </button>

              {/* Hall of Fame / High Scores Leaderboard */}
              <button
                onClick={() => {
                  soundEngineRef.current?.playButtonBeep();
                  setIsHighScoreOpen(true);
                }}
                className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded bg-[#0b1b2b] hover:bg-[#132c45] border border-[#f59e0b] text-[#fef08a] font-arcade text-[9px] shadow-[0_0_8px_rgba(245,158,11,0.25)] transition-all"
                title="명예의 전당 TOP 5 기록실"
              >
                <Trophy className="w-3 h-3 text-[#f59e0b]" />
                <span>RANKING</span>
              </button>

              {/* Service Menu & Course/Weather Test */}
              <button
                onClick={() => {
                  soundEngineRef.current?.playButtonBeep();
                  setIsServiceOpen(true);
                }}
                className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] border border-[#38bdf8] text-[#7dd3fc] font-arcade text-[9px] transition-all"
                title="아케이드 서비스 및 코스/날씨 제어 메뉴"
              >
                <Wrench className="w-3 h-3 text-[#38bdf8]" />
                <span className="hidden sm:inline">SERVICE</span>
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="cursor-pointer p-1 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[#94a3b8] hover:text-white transition-colors"
                title="전체 화면"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Primary Arcade Action Buttons Row */}
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            {/* 1P START BUTTON */}
            <button
              id="start-deck-btn"
              disabled={!isLoaded}
              onClick={() => {
                soundEngineRef.current?.playButtonBeep();
                startGame(false);
              }}
              className="cursor-pointer group flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-gradient-to-b from-[#d97706] via-[#92400e] to-[#451a03] border-2 border-[#f59e0b] shadow-[0_3px_0_#290f02,0_0_12px_rgba(245,158,11,0.3)] active:translate-y-0.5 active:shadow-[0_1px_0_#290f02] transition-all text-[#fef08a] font-arcade text-[10px] sm:text-xs tracking-wider uppercase disabled:opacity-50"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] border border-[#fef08a] shadow-[0_0_6px_#facc15]" />
              <span>{isPlaying ? 'RESTART 1P' : '1P START'}</span>
            </button>

            {/* PAUSE BUTTON */}
            <button
              id="pause-deck-btn"
              onClick={() => {
                soundEngineRef.current?.playButtonBeep();
                togglePause();
              }}
              className="cursor-pointer group flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-gradient-to-b from-[#0284c7] via-[#075985] to-[#082f49] border-2 border-[#38bdf8] shadow-[0_3px_0_#041d2d,0_0_12px_rgba(56,189,248,0.25)] active:translate-y-0.5 active:shadow-[0_1px_0_#041d2d] transition-all text-[#e0f2fe] font-arcade text-[10px] sm:text-xs tracking-wider uppercase"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] border border-[#bae6fd] shadow-[0_0_6px_#38bdf8]" />
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>

            {/* FM SOUND TOGGLE */}
            <button
              id="sound-deck-btn"
              onClick={() => {
                toggleSound();
                soundEngineRef.current?.playButtonBeep();
              }}
              className="cursor-pointer group flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-gradient-to-b from-[#059669] via-[#065f46] to-[#022c22] border-2 border-[#34d399] shadow-[0_3px_0_#011711,0_0_12px_rgba(52,211,153,0.25)] active:translate-y-0.5 active:shadow-[0_1px_0_#011711] transition-all text-[#d1fae5] font-arcade text-[10px] sm:text-xs tracking-wider uppercase"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full border transition-all ${
                  soundOn
                    ? 'bg-[#10b981] border-[#a7f3d0] shadow-[0_0_6px_#10b981]'
                    : 'bg-[#475569] border-[#94a3b8]'
                }`}
              />
              <span>{soundOn ? 'FM ON' : 'FM MUTE'}</span>
            </button>
          </div>

          {/* Cockpit Driving Controls: 2-Speed Shifter + Rotating Steering Wheel + Racing Pedals */}
          <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center bg-[#05080d] border border-[#1e293b] rounded-lg p-2 sm:p-2.5 shadow-inner">
            {/* 1. 2-SPEED MECHANICAL SHIFTER (Left, 3 Cols) */}
            <div className="col-span-4 sm:col-span-3 flex flex-col items-center justify-center bg-gradient-to-b from-[#0c131c] to-[#05080c] border border-[#334155] rounded-lg p-2 shadow">
              <div className="text-[8px] sm:text-[9px] font-arcade text-[#94a3b8] mb-1 flex items-center gap-1">
                <span>SHIFTER</span>
                <span className="text-[#38bdf8]">[SPACE]</span>
              </div>

              {/* Shifter Image Box with click & active gear indicator */}
              <div
                onClick={toggleGear}
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden border border-[#475569] cursor-pointer group shadow hover:border-[#38bdf8] transition-all"
                title="클릭하여 LOW / HIGH 기어 변속 [SPACE]"
              >
                <img
                  src={arcadeGearShifterImg}
                  alt="OutRun 2-Speed Shifter"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform"
                />
                {/* Active Gear Badges Overlay */}
                <div className="absolute inset-x-0 bottom-0 py-0.5 bg-black/85 flex items-center justify-around text-[8px] font-arcade">
                  <span
                    className={`px-1 py-0.2 rounded font-bold transition-all ${
                      gear === 'LOW'
                        ? 'bg-[#38bdf8] text-black shadow-[0_0_6px_#38bdf8]'
                        : 'text-[#64748b]'
                    }`}
                  >
                    LOW
                  </span>
                  <span
                    className={`px-1 py-0.2 rounded font-bold transition-all ${
                      gear === 'HIGH'
                        ? 'bg-[#4ade80] text-black shadow-[0_0_6px_#4ade80]'
                        : 'text-[#64748b]'
                    }`}
                  >
                    HIGH
                  </span>
                </div>
              </div>

              <div className="mt-1 text-[8px] font-arcade">
                {gear === 'LOW' ? (
                  <span className="text-[#38bdf8]">LOW (0-160)</span>
                ) : (
                  <span className="text-[#4ade80]">HIGH (294 MAX)</span>
                )}
              </div>
            </div>

            {/* 2. SEGA SPORTS STEERING WHEEL & PADDLES (Center, 5 Cols) */}
            <div className="col-span-8 sm:col-span-6 flex flex-col items-center justify-center p-1">
              <div className="text-[8px] sm:text-[9px] font-arcade text-[#ffd18c] mb-1 flex items-center gap-1">
                <span>STEERING WHEEL</span>
                <span className="text-[#94a3b8]">[A / D · ◀ / ▶]</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 sm:gap-3 w-full">
                {/* Left Turn Paddle */}
                <button
                  data-key="left"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setTouchKey('left', true);
                    setSteeringState('left');
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    setTouchKey('left', false);
                    setSteeringState(null);
                  }}
                  onPointerCancel={() => {
                    setTouchKey('left', false);
                    setSteeringState(null);
                  }}
                  className={`touch-none w-12 sm:w-16 h-16 sm:h-20 rounded-lg bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] ${
                    steeringState === 'left'
                      ? 'from-[#38bdf8] to-[#0284c7] text-black border-white translate-y-0.5 shadow-[0_0_12px_#38bdf8]'
                      : 'border-[#38bdf8] text-[#38bdf8]'
                  } border-2 font-arcade text-xs shadow-[0_3px_0_#070d18] flex flex-col items-center justify-center cursor-pointer transition-all select-none`}
                  aria-label="스티어링 좌회전"
                >
                  <span className="text-sm sm:text-base">◀</span>
                  <span className="text-[8px]">LEFT</span>
                </button>

                {/* Rotating Sega Steering Wheel Centerpiece */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full p-1 bg-gradient-to-b from-[#475569] via-[#1e293b] to-[#0f172a] border-2 border-[#64748b] shadow-[0_4px_12px_rgba(0,0,0,0.8)] flex items-center justify-center select-none overflow-hidden flex-shrink-0">
                  <img
                    ref={wheelImgRef}
                    src={arcadeSteeringWheelImg}
                    alt="Sega OutRun Steering Wheel"
                    className="w-full h-full object-contain pointer-events-none drop-shadow transition-transform duration-75 ease-out"
                  />
                </div>

                {/* Right Turn Paddle */}
                <button
                  data-key="right"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setTouchKey('right', true);
                    setSteeringState('right');
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    setTouchKey('right', false);
                    setSteeringState(null);
                  }}
                  onPointerCancel={() => {
                    setTouchKey('right', false);
                    setSteeringState(null);
                  }}
                  className={`touch-none w-12 sm:w-16 h-16 sm:h-20 rounded-lg bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] ${
                    steeringState === 'right'
                      ? 'from-[#38bdf8] to-[#0284c7] text-black border-white translate-y-0.5 shadow-[0_0_12px_#38bdf8]'
                      : 'border-[#38bdf8] text-[#38bdf8]'
                  } border-2 font-arcade text-xs shadow-[0_3px_0_#070d18] flex flex-col items-center justify-center cursor-pointer transition-all select-none`}
                  aria-label="스티어링 우회전"
                >
                  <span className="text-sm sm:text-base">▶</span>
                  <span className="text-[8px]">RIGHT</span>
                </button>
              </div>

              {/* Status Readout */}
              <div className="mt-1 font-arcade text-[8px] text-[#94a3b8]">
                {steeringState === 'left' ? (
                  <span className="text-[#38bdf8]">◀ TURNING LEFT</span>
                ) : steeringState === 'right' ? (
                  <span className="text-[#38bdf8]">TURNING RIGHT ▶</span>
                ) : (
                  <span>CENTERED</span>
                )}
              </div>
            </div>

            {/* 3. DUAL CAST-METAL RACING PEDALS (Right, 3 Cols) */}
            <div className="col-span-12 sm:col-span-3 flex flex-row sm:flex-col items-center justify-center bg-gradient-to-b from-[#0c131c] to-[#05080c] border border-[#334155] rounded-lg p-2 shadow gap-2">
              <div className="text-[8px] sm:text-[9px] font-arcade text-[#94a3b8] sm:mb-1 w-full text-center">
                PEDALS
              </div>

              <div className="flex items-center gap-2 w-full justify-center">
                {/* BRAKE PEDAL */}
                <button
                  data-key="brake"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setTouchKey('brake', true);
                    setPedalStates((prev) => ({ ...prev, brake: true }));
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    setTouchKey('brake', false);
                    setPedalStates((prev) => ({ ...prev, brake: false }));
                  }}
                  onPointerCancel={() => {
                    setTouchKey('brake', false);
                    setPedalStates((prev) => ({ ...prev, brake: false }));
                  }}
                  className={`touch-none flex-1 max-w-[70px] h-16 sm:h-20 rounded bg-gradient-to-b from-[#7f1d1d] via-[#450a0a] to-[#200404] border-2 ${
                    pedalStates.brake
                      ? 'border-white from-[#ef4444] to-[#991b1b] translate-y-0.5 shadow-[0_0_10px_#ef4444]'
                      : 'border-[#ef4444]'
                  } shadow-[0_3px_0_#150303] flex flex-col items-center justify-between p-1.5 cursor-pointer transition-all select-none`}
                  aria-label="브레이크 감속 페달"
                >
                  <span className="w-full h-1 bg-[#ef4444]/40 rounded-full" />
                  <div className="text-center">
                    <div className="font-arcade text-[9px] text-[#fca5a5]">BRAKE</div>
                    <div className="text-[7px] font-retro text-white/70">감속 [↓]</div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full border ${
                      pedalStates.brake ? 'bg-[#ef4444] border-white' : 'bg-[#450a0a] border-[#7f1d1d]'
                    }`}
                  />
                </button>

                {/* ACCEL PEDAL */}
                <button
                  data-key="gas"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setTouchKey('gas', true);
                    setPedalStates((prev) => ({ ...prev, gas: true }));
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    setTouchKey('gas', false);
                    setPedalStates((prev) => ({ ...prev, gas: false }));
                  }}
                  onPointerCancel={() => {
                    setTouchKey('gas', false);
                    setPedalStates((prev) => ({ ...prev, gas: false }));
                  }}
                  className={`touch-none flex-1 max-w-[70px] h-16 sm:h-20 rounded bg-gradient-to-b from-[#064e3b] via-[#022c22] to-[#01140e] border-2 ${
                    pedalStates.gas
                      ? 'border-white from-[#10b981] to-[#047857] translate-y-0.5 shadow-[0_0_10px_#10b981]'
                      : 'border-[#10b981]'
                  } shadow-[0_3px_0_#02120d] flex flex-col items-center justify-between p-1.5 cursor-pointer transition-all select-none`}
                  aria-label="가속 액셀 페달"
                >
                  <span className="w-full h-1 bg-[#10b981]/40 rounded-full" />
                  <div className="text-center">
                    <div className="font-arcade text-[9px] text-[#86efac]">ACCEL</div>
                    <div className="text-[7px] font-retro text-white/70">가속 [↑]</div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full border ${
                      pedalStates.gas ? 'bg-[#10b981] border-white' : 'bg-[#022c22] border-[#064e3b]'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Sleek Bottom Status Bar: Minimalist Keyboard Guide + FPS */}
          <div className="mt-2 pt-2 border-t border-[#1e293b]/70 flex flex-col sm:flex-row sm:items-center justify-between text-[9px] font-arcade text-[#64748b] gap-1">
            <div className="flex items-center gap-1.5 flex-wrap text-[#94a3b8]">
              <span>🎮 [◀ ▶] 조향</span>
              <span className="text-[#334155]">·</span>
              <span>[↑/↓] 가속/감속</span>
              <span className="text-[#334155]">·</span>
              <span>[SPACE] 2단 기어</span>
              <span className="text-[#334155]">·</span>
              <span>[P] 일시정지</span>
              <span className="text-[#334155]">·</span>
              <span>[5/C] 코인 투입</span>
            </div>
            <div className="text-[#38bdf8] font-mono text-[8px] bg-black/50 px-2 py-0.5 rounded border border-[#1e293b] self-start sm:self-auto">
              SYS: {fpsStatus}
            </div>
          </div>
        </section>

        {/* TOP 5 HIGH SCORE HALL OF FAME MODAL */}
        <HighScoreModal
          isOpen={isHighScoreOpen}
          onClose={() => setIsHighScoreOpen(false)}
          scores={highScores}
          onScoresUpdated={(newScores) => setHighScores(newScores)}
          pendingRecord={pendingRecord}
          onClearPendingRecord={() => setPendingRecord(null)}
        />

        {/* SEGA SYSTEM 16 OPERATOR TEST & WEATHER LAB MODAL */}
        <ServiceMenuModal
          isOpen={isServiceOpen}
          onClose={() => setIsServiceOpen(false)}
          onPreview={preview}
          onStartGame={startGame}
          activeWeatherIndex={activeWeatherIndex}
          onSetWeather={setWeather}
          onJumpSCurve={() => {
            startGame(false);
            const s = stateRef.current;
            s.z = 278000;
            s.speed = Drive.MAX;
            s.checkpoint = 1;
          }}
        />
      </div>
    </main>
  );
};
