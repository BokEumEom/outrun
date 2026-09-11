import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Drive from '../engine';
import { GameState, InputState } from '../types';
import { Assets, H, loadAllAssets, renderEnding, renderGame, W } from '../renderer';
import { SoundEngine } from '../audio';
import { StageTransitionOverlay } from './StageTransitionOverlay';
import { globalWeatherEngine, STAGE_WEATHER_PRESETS } from '../weather';
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
} from 'lucide-react';

import arcadeMarqueeImg from '../assets/images/outrun_arcade_marquee_1789106020266.jpg';
import titleBadgeImg from '../assets/images/outrun_title_badge_1789106037004.jpg';
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

    if (s.won) {
      endingRef.current = 0;
      if (sound) sound.syncMusic(false, 0, false);
      return;
    }

    if (sound) sound.syncMusic(false, -1, false);
    setOverlay({
      show: true,
      title: 'OUT RUN\nGAME OVER',
      desc: '다음에는 차량을 피하면서 해안선 너머로 완주해보세요.',
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

            {/* Authentic 1986 Out Run Title Screen Overlay */}
            {overlay.show && (
              <div
                id="overlay"
                className="absolute inset-0 grid place-items-center bg-[#010810]/85 backdrop-blur-[2px] p-2 sm:p-4 transition-all z-20"
              >
                <div
                  id="start-panel"
                  className="relative px-4 py-4 sm:px-8 sm:py-6 text-center bg-gradient-to-b from-[#091827] via-[#05111c] to-[#02070c] border-4 border-[#ffb703] shadow-[0_0_60px_rgba(255,183,3,0.35),inset_0_2px_0_rgba(255,255,255,0.2)] max-w-[96%] w-[600px] rounded"
                >
                  {/* Sega Corner Screws Decor */}
                  <span className="absolute top-1.5 left-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>
                  <span className="absolute top-1.5 right-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>
                  <span className="absolute bottom-1.5 left-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>
                  <span className="absolute bottom-1.5 right-2 text-[#ffb703] text-xs font-mono font-bold">✦</span>

                  {/* Generated Pixel-Art Title Badge Artwork */}
                  <div className="relative mx-auto max-w-[420px] rounded overflow-hidden border-2 border-[#ffb703]/70 shadow-lg mb-2.5">
                    <img
                      src={titleBadgeImg}
                      alt="Out Run 1986 Title Screen Artwork"
                      className="w-full h-auto max-h-[145px] object-cover object-center"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-1 left-0 right-0 text-center">
                      <span className="font-arcade text-[10px] sm:text-xs text-[#ffe066] drop-shadow-[0_2px_2px_#000]">
                        MOTOR RACING ARCADE
                      </span>
                    </div>
                  </div>

                  {/* Pulsing Arcade Prompt */}
                  <div className="font-arcade text-xs sm:text-sm text-[#fef08a] tracking-widest animate-pulse my-2">
                    ★ PRESS START BUTTON ★
                  </div>

                  {/* Out Run Radio Station Selector Cassette */}
                  <div className="my-2.5 px-2.5 py-2 bg-[#020b12] border border-[#1e3a4e] rounded">
                    <div className="flex items-center justify-between text-[9px] font-arcade text-[#7dd3fc] mb-1.5">
                      <span className="flex items-center gap-1 text-[#ffd18c]">
                        <Radio className="w-3.5 h-3.5" />
                        FM STEREO 108.3
                      </span>
                      <span className="text-[#4ade80] animate-pulse">● PLAYING</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[8px] sm:text-[9px] font-arcade">
                      {['MAGICAL SOUND SHOWER', 'PASSING BREEZE', 'SPLASH WAVE'].map((track) => (
                        <button
                          key={track}
                          onClick={() => setSelectedRadio(track)}
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

                  {/* Description / Story in Retro Arcade Font */}
                  <p
                    id="desc"
                    className="font-retro text-xs sm:text-[13px] leading-relaxed text-[#cde4e8] my-2 whitespace-pre-line"
                  >
                    {overlay.desc}
                  </p>

                  {/* Authentic 3D Convex Arcade Buttons */}
                  <div className="flex flex-wrap justify-center gap-4 my-3">
                    <button
                      id="start"
                      disabled={!isLoaded}
                      onClick={() => startGame(false)}
                      className="cursor-pointer font-arcade text-xs sm:text-sm px-6 sm:px-8 py-3 rounded-full bg-gradient-to-b from-[#ffd166] via-[#f59e0b] to-[#b45309] text-[#1b1100] font-black tracking-wider uppercase border-3 border-[#fef08a] shadow-[0_6px_0_#78350f,0_12px_30px_rgba(245,158,11,0.6)] active:translate-y-1.5 active:shadow-[0_1px_0_#78350f] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isLoaded ? overlay.buttonText : loadProgress}
                    </button>

                    <button
                      id="demo"
                      disabled={!isLoaded}
                      onClick={() => startGame(true)}
                      className="cursor-pointer font-arcade text-xs sm:text-sm px-5 sm:px-7 py-3 rounded-full bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] text-white font-bold tracking-wider uppercase border-3 border-[#bae6fd] shadow-[0_6px_0_#075985,0_12px_25px_rgba(2,132,199,0.5)] active:translate-y-1.5 active:shadow-[0_1px_0_#075985] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Car className="w-4 h-4" />
                      DEMO DRIVE
                    </button>
                  </div>

                  {/* Coin-Op Credit Status */}
                  <div className="flex items-center justify-between border-t border-[#1e3a4e] pt-2 text-[9px] sm:text-[10px] font-arcade text-[#94a3b8]">
                    <span className="text-[#38bdf8]">
                      CREDIT: {credits < 10 ? '0' + credits : credits} (1 COIN 1 PLAY)
                    </span>
                    <button
                      onClick={insertCoin}
                      className="text-[#ffd18c] hover:underline cursor-pointer flex items-center gap-1 font-arcade"
                    >
                      <Coins className="w-3 h-3" />
                      동전 투입 [C/5]
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Authentic 1986 SEGA OutRun Arcade Control Console */}
        <section
          id="arcade-cabinet-deck"
          className="mt-3 bg-gradient-to-b from-[#141b24] via-[#0b1017] to-[#05080c] border-2 border-[#334155] rounded-xl p-3 sm:p-4 shadow-[inset_0_2px_4px_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.8)] relative overflow-hidden"
        >
          {/* Authentic OutRun Top Hardware Stencil & Serial Placard */}
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#1e293b]/80 flex-wrap gap-2 text-xs font-arcade">
            {/* Sega Hardware Serial Stencil */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#fef08a] text-[9px] tracking-wider">
                ★ SEGA RACING MOTOR 16 · 1986 ★
              </span>
              <span className="text-[#38bdf8] text-[9px] hidden sm:inline">
                SYSTEM 16-B · COIN-OP HARDWARE
              </span>
            </div>

            {/* Auto Accel Rocker Switch & Mode */}
            <div className="flex items-center gap-3 ml-auto">
              <label
                id="auto-accel-toggle"
                className="flex items-center gap-2 cursor-pointer bg-[#070c12] px-2.5 py-1 rounded border border-[#1e293b] hover:border-[#38bdf8] transition-colors"
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
                  className={`w-3 h-3 rounded-full border-2 transition-all ${
                    autoGas
                      ? 'bg-[#4ade80] border-[#86efac] shadow-[0_0_8px_#4ade80]'
                      : 'bg-[#475569] border-[#64748b]'
                  }`}
                />
                <span className="text-[9px] text-[#cbd5e1]">
                  AUTO ACCEL : {autoGas ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          </div>

          {/* Upper Arcade Plunger Push-Button Deck */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            {/* 1P START BUTTON (Yellow Illuminated Sanwa Dome Button) */}
            <button
              id="start-deck-btn"
              disabled={!isLoaded}
              onClick={() => {
                soundEngineRef.current?.playButtonBeep();
                startGame(false);
              }}
              className="cursor-pointer group relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-b from-[#b45309] via-[#78350f] to-[#451a03] border-2 border-[#f59e0b] shadow-[0_4px_0_#290f02,0_0_15px_rgba(245,158,11,0.4)] active:translate-y-1 active:shadow-[0_1px_0_#290f02] transition-all text-[#fef08a] font-arcade text-xs tracking-wider uppercase"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#facc15] border-2 border-[#fef08a] shadow-[0_0_8px_#facc15] group-hover:scale-110 transition-transform" />
              <span>{isPlaying ? 'RESTART 1P' : '1P START'}</span>
            </button>

            {/* PAUSE BUTTON (Blue Translucent Sanwa Dome Button) */}
            <button
              id="pause-deck-btn"
              onClick={() => {
                soundEngineRef.current?.playButtonBeep();
                togglePause();
              }}
              className="cursor-pointer group relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-b from-[#0369a1] via-[#075985] to-[#082f49] border-2 border-[#38bdf8] shadow-[0_4px_0_#041d2d,0_0_15px_rgba(56,189,248,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#041d2d] transition-all text-[#e0f2fe] font-arcade text-xs tracking-wider uppercase"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#38bdf8] border-2 border-[#bae6fd] shadow-[0_0_8px_#38bdf8] group-hover:scale-110 transition-transform" />
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>

            {/* SOUND TOGGLE (Green Illuminated Sanwa Dome Button) */}
            <button
              id="sound-deck-btn"
              onClick={() => {
                toggleSound();
                soundEngineRef.current?.playButtonBeep();
              }}
              className="cursor-pointer group relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-b from-[#047857] via-[#065f46] to-[#022c22] border-2 border-[#34d399] shadow-[0_4px_0_#011711,0_0_15px_rgba(52,211,153,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#011711] transition-all text-[#d1fae5] font-arcade text-xs tracking-wider uppercase"
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  soundOn
                    ? 'bg-[#10b981] border-[#a7f3d0] shadow-[0_0_8px_#10b981]'
                    : 'bg-[#475569] border-[#94a3b8]'
                }`}
              />
              <span>{soundOn ? 'FM AUDIO ON' : 'MUTE AUDIO'}</span>
            </button>

            {/* FULLSCREEN / RESET */}
            <div className="flex gap-1.5">
              <button
                id="reset-deck-btn"
                onClick={() => {
                  soundEngineRef.current?.playButtonBeep();
                  startGame(false);
                }}
                className="flex-1 cursor-pointer flex items-center justify-center gap-1 py-2.5 px-2 rounded-lg bg-gradient-to-b from-[#7f1d1d] via-[#450a0a] to-[#200404] border-2 border-[#ef4444] shadow-[0_4px_0_#150202] active:translate-y-1 active:shadow-[0_1px_0_#150202] transition-all text-[#fee2e2] font-arcade text-[10px] tracking-wider uppercase"
                title="게임 재시작"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET</span>
              </button>
              <button
                id="full-deck-btn"
                onClick={toggleFullscreen}
                className="cursor-pointer flex items-center justify-center px-3 rounded-lg bg-gradient-to-b from-[#334155] via-[#1e293b] to-[#0f172a] border-2 border-[#64748b] shadow-[0_4px_0_#0a0f16] active:translate-y-1 active:shadow-[0_1px_0_#0a0f16] transition-all text-[#e2e8f0] font-arcade text-[10px]"
                title="전체 화면"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Cockpit Driving Hardware Deck (Shifter + Steering Wheel + Pedals) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-[#070b10] border-2 border-[#1e293b] rounded-xl p-3 shadow-inner">
            
            {/* 1. OUT RUN 2-SPEED MECHANICAL SHIFTER (Left, 3 Cols) */}
            <div className="md:col-span-3 flex flex-col items-center justify-center bg-gradient-to-b from-[#101721] to-[#070b10] border-2 border-[#334155] rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              <div className="text-[10px] font-arcade text-[#94a3b8] mb-1.5 flex items-center gap-1">
                <span>2-SPEED SHIFTER</span>
                <span className="text-[#38bdf8]">[SPACE/SHIFT]</span>
              </div>
              
              {/* Physical Shifter Visual Box */}
              <div
                onClick={toggleGear}
                className="relative w-[100px] h-[100px] sm:w-[112px] sm:h-[112px] rounded-lg overflow-hidden border-2 border-[#475569] cursor-pointer group shadow-lg hover:border-[#38bdf8] transition-all"
                title="클릭하여 LOW / HIGH 기어 변속"
              >
                <img
                  src={arcadeGearShifterImg}
                  alt="OutRun 2-Speed Shifter"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform"
                />
                
                {/* Active Gear Highlight Overlay */}
                <div className="absolute inset-x-0 bottom-0 py-1 bg-black/80 backdrop-blur-xs flex items-center justify-around text-[9px] font-arcade">
                  <span className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                    gear === 'LOW'
                      ? 'bg-[#38bdf8] text-black shadow-[0_0_8px_#38bdf8]'
                      : 'text-[#64748b]'
                  }`}>
                    LOW
                  </span>
                  <span className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                    gear === 'HIGH'
                      ? 'bg-[#4ade80] text-black shadow-[0_0_8px_#4ade80]'
                      : 'text-[#64748b]'
                  }`}>
                    HIGH
                  </span>
                </div>
              </div>

              {/* Shifter Spec Label */}
              <div className="mt-2 text-center text-[9px] font-arcade text-[#cbd5e1]">
                {gear === 'LOW' ? (
                  <span className="text-[#38bdf8] animate-pulse">
                    ● LOW: 초반 가속 (0-160km/h)
                  </span>
                ) : (
                  <span className="text-[#4ade80]">
                    ● HIGH: 최고속도 294km/h
                  </span>
                )}
              </div>
            </div>

            {/* 2. SEGA RACING STEERING WHEEL & PADDLES (Center, 6 Cols) */}
            <div className="md:col-span-6 flex flex-col items-center justify-center p-2">
              <div className="text-[10px] font-arcade text-[#ffd18c] mb-2 flex items-center gap-1.5">
                <span>SEGA SPORTS STEERING</span>
                <span className="text-[9px] text-[#94a3b8]">[A/D or ◀/▶]</span>
              </div>

              {/* Wheel + Left & Right Paddles Layout */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 w-full">
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
                  className={`touch-none w-16 sm:w-20 h-20 rounded-xl bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] ${
                    steeringState === 'left'
                      ? 'from-[#38bdf8] to-[#0284c7] text-black border-white translate-y-1'
                      : 'border-[#38bdf8] text-[#38bdf8]'
                  } border-2 font-arcade text-xs sm:text-sm shadow-[0_5px_0_#070d18,0_0_15px_rgba(56,189,248,0.25)] flex flex-col items-center justify-center cursor-pointer transition-all select-none`}
                  aria-label="스티어링 좌회전"
                >
                  <span className="text-base sm:text-lg">◀</span>
                  <span className="text-[9px]">LEFT</span>
                </button>

                {/* Rotating Sega Steering Wheel Centerpiece */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-b from-[#475569] via-[#1e293b] to-[#0f172a] border-3 border-[#64748b] shadow-[0_6px_20px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.2)] flex items-center justify-center select-none overflow-hidden">
                  <img
                    ref={wheelImgRef}
                    src={arcadeSteeringWheelImg}
                    alt="Sega OutRun Steering Wheel"
                    className="w-full h-full object-contain pointer-events-none drop-shadow-md transition-transform duration-75 ease-out"
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
                  className={`touch-none w-16 sm:w-20 h-20 rounded-xl bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] ${
                    steeringState === 'right'
                      ? 'from-[#38bdf8] to-[#0284c7] text-black border-white translate-y-1'
                      : 'border-[#38bdf8] text-[#38bdf8]'
                  } border-2 font-arcade text-xs sm:text-sm shadow-[0_5px_0_#070d18,0_0_15px_rgba(56,189,248,0.25)] flex flex-col items-center justify-center cursor-pointer transition-all select-none`}
                  aria-label="스티어링 우회전"
                >
                  <span className="text-base sm:text-lg">▶</span>
                  <span className="text-[9px]">RIGHT</span>
                </button>
              </div>

              {/* Dynamic Turn Status Readout */}
              <div className="mt-1.5 font-arcade text-[9px] text-[#94a3b8]">
                {steeringState === 'left' ? (
                  <span className="text-[#38bdf8]">◀ STEERING HARD LEFT</span>
                ) : steeringState === 'right' ? (
                  <span className="text-[#38bdf8]">STEERING HARD RIGHT ▶</span>
                ) : (
                  <span>CENTERED · READY</span>
                )}
              </div>
            </div>

            {/* 3. HEAVY-DUTY CAST METAL RACING PEDALS (Right, 3 Cols) */}
            <div className="md:col-span-3 flex flex-col items-center justify-center bg-gradient-to-b from-[#101721] to-[#070b10] border-2 border-[#334155] rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              <div className="text-[10px] font-arcade text-[#94a3b8] mb-1.5">
                RACING PEDALS
              </div>

              <div className="flex items-center gap-2.5 w-full justify-center">
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
                  className={`touch-none flex-1 max-w-[84px] h-24 rounded-lg bg-gradient-to-b from-[#7f1d1d] via-[#450a0a] to-[#200404] border-2 ${
                    pedalStates.brake ? 'border-white from-[#ef4444] to-[#991b1b] translate-y-1.5' : 'border-[#ef4444]'
                  } shadow-[0_5px_0_#150303,0_0_15px_rgba(239,68,68,0.3)] flex flex-col items-center justify-between p-2 cursor-pointer transition-all select-none`}
                  aria-label="브레이크 감속 페달"
                >
                  <span className="w-full h-1.5 bg-[#ef4444]/40 rounded-full" />
                  <div className="text-center">
                    <div className="font-arcade text-[10px] text-[#fca5a5]">BRAKE</div>
                    <div className="text-[8px] font-retro text-white/70">감속 [↓]</div>
                  </div>
                  <span className={`w-3 h-3 rounded-full border ${pedalStates.brake ? 'bg-[#ef4444] border-white shadow-[0_0_8px_#ef4444]' : 'bg-[#450a0a] border-[#7f1d1d]'}`} />
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
                  className={`touch-none flex-1 max-w-[84px] h-24 rounded-lg bg-gradient-to-b from-[#064e3b] via-[#022c22] to-[#01140e] border-2 ${
                    pedalStates.gas ? 'border-white from-[#10b981] to-[#047857] translate-y-1.5' : 'border-[#10b981]'
                  } shadow-[0_5px_0_#02120d,0_0_15px_rgba(16,185,129,0.3)] flex flex-col items-center justify-between p-2 cursor-pointer transition-all select-none`}
                  aria-label="가속 액셀 페달"
                >
                  <span className="w-full h-1.5 bg-[#10b981]/40 rounded-full" />
                  <div className="text-center">
                    <div className="font-arcade text-[10px] text-[#86efac]">ACCEL</div>
                    <div className="text-[8px] font-retro text-white/70">가속 [↑]</div>
                  </div>
                  <span className={`w-3 h-3 rounded-full border ${pedalStates.gas ? 'bg-[#10b981] border-white shadow-[0_0_8px_#10b981]' : 'bg-[#022c22] border-[#064e3b]'}`} />
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Real Arcade Coin Door Section */}
        <section
          id="arcade-coin-section"
          className="mt-3 bg-[#0a0f16] border-2 border-[#1e293b] rounded p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner"
        >
          {/* Coin Door Asset Graphic with Clickable Reject Buttons */}
          <div className="relative w-full sm:w-[260px] h-[95px] rounded overflow-hidden border border-[#334155] shadow-md flex-shrink-0">
            <img
              src={coinDoorImg}
              alt="Arcade Cabinet Coin Door"
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            {/* Interactive 25c Coin Push Reject Buttons Overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-6 pointer-events-auto">
              <button
                onClick={insertCoin}
                className="w-9 h-11 bg-gradient-to-b from-[#f97316] to-[#c2410c] hover:from-[#fb923c] hover:to-[#ea580c] active:scale-95 border-2 border-[#ffedd5] rounded shadow-[0_0_12px_#f97316] text-[#fff] font-arcade text-[8px] flex flex-col items-center justify-center cursor-pointer transition-transform"
                title="25¢ 동전 넣기"
              >
                <span>25¢</span>
                <span className="text-[6px]">PUSH</span>
              </button>
              <button
                onClick={insertCoin}
                className="w-9 h-11 bg-gradient-to-b from-[#f97316] to-[#c2410c] hover:from-[#fb923c] hover:to-[#ea580c] active:scale-95 border-2 border-[#ffedd5] rounded shadow-[0_0_12px_#f97316] text-[#fff] font-arcade text-[8px] flex flex-col items-center justify-center cursor-pointer transition-transform"
                title="25¢ 동전 넣기"
              >
                <span>25¢</span>
                <span className="text-[6px]">PUSH</span>
              </button>
            </div>
          </div>

          {/* Sega Arcade Serial & Coin Specs */}
          <div className="flex-1 text-center sm:text-left font-arcade text-[10px] space-y-1">
            <div className="text-[#ffd18c] flex items-center justify-center sm:justify-start gap-2">
              <Coins className="w-4 h-4 text-[#ffb703]" />
              <span>COIN-OP ARCADE SIMULATOR</span>
            </div>
            <div className="text-[#94a3b8] text-[9px] font-retro">
              오렌지색 25¢ 버튼을 클릭하거나 키보드 [5] 또는 [C]를 눌러 동전을 투입할 수 있습니다.
            </div>
            <div className="text-[#38bdf8] text-[9px]">
              MODEL: 1986-OUTRUN · SEGA ENTERPRISES, LTD. TOKYO JAPAN
            </div>
          </div>

          {/* Credits Counter Pill */}
          <div className="bg-black/80 border-2 border-[#f59e0b] px-4 py-2 rounded text-center min-w-[120px]">
            <div className="text-[8px] font-arcade text-[#94a3b8]">CREDITS</div>
            <div className="text-xl font-arcade text-[#fef08a] [text-shadow:0_0_10px_#f59e0b]">
              {credits < 10 ? '0' + credits : credits}
            </div>
          </div>
        </section>

        {/* Out Run Course Map & Route Selector */}
        <details
          id="course-preview-details"
          open={previewOpen}
          onToggle={(e) => setPreviewOpen((e.currentTarget as HTMLDetailsElement).open)}
          className="mt-3 text-[#94a3b8] text-xs border border-[#1e293b] rounded p-3 bg-gradient-to-b from-[#0d1622] to-[#070c14] shadow"
        >
          <summary className="cursor-pointer font-arcade text-[#7dd3fc] hover:text-white transition-colors flex items-center justify-between list-none text-[10px] sm:text-[11px]">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#ffd18c]" />
              <span>OUT RUN COURSE MAP & SECTOR TEST</span>
            </div>
            <span className="text-[9px] text-[#ffd18c] bg-black/60 px-2 py-0.5 rounded border border-[#1e293b]">
              ROUTE SELECTOR ▼
            </span>
          </summary>

          <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-[#1e293b] font-arcade text-[9px]">
            <button
              id="forkPreview"
              onClick={() => preview(145000)}
              className="bg-[#0f2838] hover:bg-[#163b52] border border-[#38bdf8] text-[#bae6fd] px-2.5 py-1.5 rounded cursor-pointer transition-all"
            >
              FORK 분기점
            </button>
            <button
              id="mergePreview"
              onClick={() => preview(225000)}
              className="bg-[#0f2838] hover:bg-[#163b52] border border-[#38bdf8] text-[#bae6fd] px-2.5 py-1.5 rounded cursor-pointer transition-all"
            >
              MERGE 합류점
            </button>
            <button
              onClick={() => preview(65000)}
              className="bg-[#0f2838] hover:bg-[#163b52] border border-[#38bdf8] text-[#bae6fd] px-2.5 py-1.5 rounded cursor-pointer transition-all"
            >
              SEASIDE 해변
            </button>
            {Drive.STAGES.map((stg, i) => (
              <button
                key={stg.name}
                onClick={() => preview(i * Drive.STAGE_LENGTH + 5000, i)}
                className="bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[#e2e8f0] px-2.5 py-1.5 rounded cursor-pointer transition-all"
              >
                STAGE {i + 1}:{stg.name.toUpperCase()}
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
              className="bg-[#362208] hover:bg-[#52330a] border border-[#f59e0b] text-[#fde047] px-2.5 py-1.5 rounded cursor-pointer transition-all font-bold"
            >
              S-CURVE 극한커브
            </button>
            <button
              onClick={() => preview(Drive.END - 20000, 5)}
              className="bg-[#362208] hover:bg-[#52330a] border border-[#f59e0b] text-[#fde047] px-2.5 py-1.5 rounded cursor-pointer transition-all font-bold"
            >
              GOAL 골인
            </button>
            <button
              onClick={() => preview(65000, undefined, false, true)}
              className="bg-[#450a0a] hover:bg-[#7f1d1d] border border-[#ef4444] text-[#fca5a5] px-2.5 py-1.5 rounded cursor-pointer transition-all font-bold"
            >
              CRASH 충돌테스트
            </button>

            {/* Dynamic Weather System Lab */}
            <div className="w-full mt-3 pt-3 border-t border-[#1e293b]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-2 text-[#ffd18c]">
                  <CloudRain className="w-4 h-4 text-[#38bdf8]" />
                  <span className="font-bold">OUT RUN DYNAMIC WEATHER LAB · 실시간 날씨 제어</span>
                </div>
                <span className="text-[8px] text-[#94a3b8] font-retro">
                  주행 진행 시 고원 안개, 사막 열기/모래, 유적 폭우/번개, 석양 노을이 자연스럽게 교차합니다
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setWeather(null)}
                  className={`px-3 py-1.5 rounded cursor-pointer transition-all border flex items-center gap-1.5 ${
                    activeWeatherIndex === null
                      ? 'bg-[#0284c7] text-white border-[#38bdf8] shadow-[0_0_10px_#0284c7]'
                      : 'bg-[#0f172a] text-[#94a3b8] border-[#334155] hover:border-[#64748b]'
                  }`}
                >
                  <span>🔄 DYNAMIC (코스 자동 연동)</span>
                </button>

                {STAGE_WEATHER_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.type}
                    onClick={() => {
                      setWeather(idx);
                      if (!isPlaying) {
                        preview(idx * Drive.STAGE_LENGTH + 5000, idx);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded cursor-pointer transition-all border flex items-center gap-1.5 ${
                      activeWeatherIndex === idx
                        ? 'bg-[#b45309] text-[#fef3c7] border-[#f59e0b] shadow-[0_0_10px_#f59e0b]'
                        : 'bg-[#1e293b] text-[#cbd5e1] border-[#475569] hover:border-[#94a3b8]'
                    }`}
                    title={preset.description}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.ko}</span>
                    <span className="text-[8px] opacity-60 font-mono">({preset.name})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        {/* Arcade Cabinet Steering Wheel Instruction Card Plate */}
        <section
          id="game-guide"
          aria-label="조작 안내"
          className="mt-3 p-3 bg-gradient-to-b from-[#0b121b] to-[#05090f] border-2 border-[#1e293b] rounded text-[#d5e9e9] text-xs leading-relaxed shadow"
        >
          <div className="flex items-center justify-between mb-2 border-b border-[#1e293b] pb-1.5">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-[#ffd18c]" />
              <b className="font-arcade text-xs text-[#ffd18c] tracking-wider uppercase">
                OUT RUN INSTRUCTION CARD · 조작 안내
              </b>
            </div>
            <span className="font-arcade text-[9px] text-[#38bdf8]">SEGA 1986 REPRODUCTION</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-retro text-xs text-[#cde4e8]">
            <div className="space-y-1">
              <div>
                <span className="font-arcade text-[9px] text-[#38bdf8]">◀ / ▶ (또는 ← → / A·D)</span>：스티어링 핸들 조작
              </div>
              <div>
                <span className="font-arcade text-[9px] text-[#f87171]">BRAKE (또는 ↓ / S)</span>：브레이크 감속 (급커브 필수)
              </div>
              <div>
                <span className="font-arcade text-[9px] text-[#4ade80]">GAS (또는 ↑ / W)</span>：가속 (자동 액셀 활성화 시 자동)
              </div>
              <div>
                <span className="font-arcade text-[9px] text-[#facc15]">GEAR (또는 SPACE / SHIFT)</span>：2단 수동 기어 변속 (LOW ↔ HIGH)
              </div>
            </div>
            <div className="space-y-1">
              <div>
                <span className="font-arcade text-[9px] text-[#ffd18c]">ROUTE FORK</span>：왼쪽은 해안(SEASIDE), 오른쪽은 고원(HIGHLAND)
              </div>
              <div>
                <span className="font-arcade text-[9px] text-[#ffd18c]">CHECKPOINT</span>：합류 지점 통과 시 제한 시간(TIME) 연장
              </div>
              <div>
                <span className="font-arcade text-[9px] text-[#38bdf8]">SHORTCUTS</span>：[SPACE] 기어 · [P] 일시정지 · [5/C] 코인
              </div>
            </div>
          </div>
        </section>

        {/* Arcade Cabinet Footer */}
        <footer
          id="arcade-footer"
          className="text-[10px] text-[#64748b] mt-2.5 font-arcade flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1 border-t border-[#1e293b] pt-2"
        >
          <div>OUT RUN (C) 1986 SEGA TRIBUTE · FERRARI TESTAROSSA SPIDER</div>
          <span id="status" className="text-[#38bdf8] bg-black/60 px-2 py-0.5 rounded border border-[#1e293b]">
            SYSTEM: {fpsStatus}
          </span>
        </footer>
      </div>
    </main>
  );
};
