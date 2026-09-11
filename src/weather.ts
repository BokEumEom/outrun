import { clamp, mix, smooth, STAGE_LENGTH } from './engine';
import { GameState } from './types';

export type WeatherType = 'CLEAR' | 'HAZE' | 'FOG' | 'DUST' | 'RAIN' | 'SUNSET';

export interface WeatherProfile {
  type: WeatherType;
  name: string;
  ko: string;
  icon: string;
  description: string;
  skyFilter: string; // Color overlay
  fogDensity: number; // 0 to 1
  rainIntensity: number; // 0 to 1
  dustIntensity: number; // 0 to 1
  sunsetGlow: number; // 0 to 1
  darkness: number; // 0 to 1
}

export const STAGE_WEATHER_PRESETS: WeatherProfile[] = [
  {
    type: 'CLEAR',
    name: 'TROPICAL CLEAR',
    ko: '맑은 해변',
    icon: '☀️',
    description: '눈부신 지중해 태양과 에메랄드빛 바다',
    skyFilter: 'rgba(255, 235, 180, 0.08)',
    fogDensity: 0.0,
    rainIntensity: 0.0,
    dustIntensity: 0.0,
    sunsetGlow: 0.0,
    darkness: 0.0,
  },
  {
    type: 'HAZE',
    name: 'COASTAL HAZE',
    ko: '해안 해무',
    icon: '🌤️',
    description: '해변에서 불어오는 온화한 바다안개와 짭조름한 바람',
    skyFilter: 'rgba(210, 240, 245, 0.15)',
    fogDensity: 0.22,
    rainIntensity: 0.0,
    dustIntensity: 0.0,
    sunsetGlow: 0.05,
    darkness: 0.02,
  },
  {
    type: 'FOG',
    name: 'ALPINE MIST & FOG',
    ko: '고원 짙은 안개',
    icon: '🌫️',
    description: '굽이치는 산악 와인딩 도로를 휘감는 몽환적인 운무',
    skyFilter: 'rgba(180, 205, 215, 0.35)',
    fogDensity: 0.88,
    rainIntensity: 0.04,
    dustIntensity: 0.0,
    sunsetGlow: 0.0,
    darkness: 0.18,
  },
  {
    type: 'DUST',
    name: 'CANYON SANDSTORM',
    ko: '사막 모래바람',
    icon: '🏜️',
    description: '작열하는 아지랑이와 시야를 가로지르는 붉은 모래 먼지',
    skyFilter: 'rgba(245, 140, 60, 0.28)',
    fogDensity: 0.35,
    rainIntensity: 0.0,
    dustIntensity: 0.95,
    sunsetGlow: 0.25,
    darkness: 0.12,
  },
  {
    type: 'RAIN',
    name: 'TEMPLE THUNDERSTORM',
    ko: '유적 폭우 & 번개',
    icon: '⛈️',
    description: '고대 유적 석조로를 강타하는 거센 폭우와 번개 섬광',
    skyFilter: 'rgba(15, 25, 45, 0.55)',
    fogDensity: 0.45,
    rainIntensity: 1.0,
    dustIntensity: 0.0,
    sunsetGlow: 0.0,
    darkness: 0.58,
  },
  {
    type: 'SUNSET',
    name: 'SUNSET BAY GLOW',
    ko: '황혼 노을 안개',
    icon: '🌅',
    description: '결승선을 비추는 장엄한 황금빛 노을과 저녁 노을빛 연무',
    skyFilter: 'rgba(255, 90, 80, 0.32)',
    fogDensity: 0.25,
    rainIntensity: 0.0,
    dustIntensity: 0.15,
    sunsetGlow: 1.0,
    darkness: 0.15,
  },
];

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
  layer: number; // 0=distant, 1=medium, 2=close
}

interface DustParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

interface SplashRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface ScreenDroplet {
  x: number;
  y: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
}

export class WeatherEngine {
  private rainDrops: RainDrop[] = [];
  private dustParticles: DustParticle[] = [];
  private splashes: SplashRipple[] = [];
  private screenDroplets: ScreenDroplet[] = [];

  // Lightning system
  private lightningTimer = 0;
  private lightningDuration = 0;
  private lightningIntensity = 0;
  private isDoubleStrike = false;

  // Manual weather override (null for auto dynamic stage transition)
  public manualWeatherIndex: number | null = null;

  constructor() {
    this.initParticles();
  }

  private initParticles(): void {
    // Initialize 160 reusable rain drops
    for (let i = 0; i < 160; i++) {
      this.rainDrops.push({
        x: Math.random() * 520 - 20,
        y: Math.random() * 300,
        length: 8 + Math.random() * 16,
        speed: 400 + Math.random() * 450,
        alpha: 0.3 + Math.random() * 0.6,
        layer: Math.floor(Math.random() * 3),
      });
    }

    // Initialize 80 reusable dust particles
    for (let i = 0; i < 80; i++) {
      const isRed = Math.random() > 0.4;
      this.dustParticles.push({
        x: Math.random() * 520 - 20,
        y: Math.random() * 300,
        size: 1 + Math.random() * 2.5,
        vx: -(120 + Math.random() * 200),
        vy: (Math.random() - 0.5) * 40,
        alpha: 0.2 + Math.random() * 0.6,
        color: isRed ? '#f97316' : '#facc15',
      });
    }

    // Initialize screen droplets (windshield water drops)
    for (let i = 0; i < 16; i++) {
      this.screenDroplets.push({
        x: Math.random() * 480,
        y: Math.random() * 260,
        vy: 10 + Math.random() * 25,
        radius: 1.2 + Math.random() * 2.2,
        life: Math.random() * 3,
        maxLife: 2 + Math.random() * 3,
      });
    }
  }

  /**
   * Calculates smoothly blended weather state based on track progress z
   */
  public getCurrentWeather(z: number): {
    fogDensity: number;
    rainIntensity: number;
    dustIntensity: number;
    sunsetGlow: number;
    darkness: number;
    lightningIntensity: number;
    currentProfile: WeatherProfile;
    nextProfile: WeatherProfile;
    transitionProgress: number;
    stageIndex: number;
  } {
    if (this.manualWeatherIndex !== null && STAGE_WEATHER_PRESETS[this.manualWeatherIndex]) {
      const preset = STAGE_WEATHER_PRESETS[this.manualWeatherIndex];
      return {
        fogDensity: preset.fogDensity,
        rainIntensity: preset.rainIntensity,
        dustIntensity: preset.dustIntensity,
        sunsetGlow: preset.sunsetGlow,
        darkness: preset.darkness,
        lightningIntensity: preset.rainIntensity > 0.5 ? this.lightningIntensity : 0,
        currentProfile: preset,
        nextProfile: preset,
        transitionProgress: 1,
        stageIndex: this.manualWeatherIndex,
      };
    }

    const floatStage = clamp(z / STAGE_LENGTH, 0, 5.999);
    const currStage = Math.floor(floatStage);
    const nextStage = Math.min(5, currStage + 1);
    const stagePos = floatStage - currStage; // 0.0 to 1.0 within stage

    // Transition smoothly in the last 25% of the stage
    const transitionZone = 0.75;
    let blend = 0;
    if (stagePos > transitionZone) {
      blend = smooth((stagePos - transitionZone) / (1 - transitionZone));
    }

    const p1 = STAGE_WEATHER_PRESETS[currStage];
    const p2 = STAGE_WEATHER_PRESETS[nextStage];

    return {
      fogDensity: mix(p1.fogDensity, p2.fogDensity, blend),
      rainIntensity: mix(p1.rainIntensity, p2.rainIntensity, blend),
      dustIntensity: mix(p1.dustIntensity, p2.dustIntensity, blend),
      sunsetGlow: mix(p1.sunsetGlow, p2.sunsetGlow, blend),
      darkness: mix(p1.darkness, p2.darkness, blend),
      lightningIntensity: this.lightningIntensity * mix(p1.rainIntensity, p2.rainIntensity, blend),
      currentProfile: p1,
      nextProfile: p2,
      transitionProgress: blend,
      stageIndex: currStage,
    };
  }

  /**
   * Update particle physics and lightning timings
   */
  public update(dt: number, s: GameState): void {
    const weather = this.getCurrentWeather(s.z);
    const speedRatio = clamp(s.speed / 9500, 0, 1.2);
    const turn = s.yaw;

    // 1. Update Rain
    if (weather.rainIntensity > 0.02) {
      const windX = -turn * 180 - 40; // Slight slant + steering reactive
      const speedMultiplier = 1 + speedRatio * 1.6;

      for (const drop of this.rainDrops) {
        drop.x += (windX + (drop.layer - 1) * 30) * dt;
        drop.y += drop.speed * speedMultiplier * dt;

        // Reset if off-screen
        if (drop.y > 305 || drop.x < -30 || drop.x > 510) {
          drop.x = Math.random() * 520 - 20 - windX * 0.2;
          drop.y = -15 - Math.random() * 20;

          // Chance to spawn a ground splash if hitting lower screen
          if (Math.random() < 0.25 && weather.rainIntensity > 0.3) {
            this.triggerSplash(Math.random() * 460 + 10, 200 + Math.random() * 90);
          }
        }
      }

      // Windshield droplets
      for (const droplet of this.screenDroplets) {
        droplet.y += droplet.vy * (1 + speedRatio * 0.8) * dt;
        droplet.x += -turn * 40 * dt;
        droplet.life += dt;
        if (droplet.y > 295 || droplet.life > droplet.maxLife) {
          droplet.y = Math.random() * 80;
          droplet.x = Math.random() * 480;
          droplet.life = 0;
          droplet.maxLife = 2 + Math.random() * 3;
        }
      }

      // Update Splashes
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const sp = this.splashes[i];
        sp.radius += dt * 32;
        sp.alpha -= dt * 3.5;
        if (sp.alpha <= 0 || sp.radius >= sp.maxRadius) {
          this.splashes.splice(i, 1);
        }
      }

      // Lightning logic during storm
      if (weather.rainIntensity > 0.6) {
        this.lightningTimer -= dt;
        if (this.lightningTimer <= 0) {
          // Trigger lightning flash
          this.lightningDuration = 0.16 + Math.random() * 0.12;
          this.lightningIntensity = 1.0;
          this.isDoubleStrike = Math.random() > 0.45;
          this.lightningTimer = 4.0 + Math.random() * 6.5; // Next strike in 4-10s
        }

        if (this.lightningDuration > 0) {
          this.lightningDuration -= dt;
          if (this.lightningDuration <= 0) {
            if (this.isDoubleStrike) {
              this.isDoubleStrike = false;
              this.lightningDuration = 0.08;
              this.lightningIntensity = 0.85;
            } else {
              this.lightningIntensity = 0;
            }
          } else {
            this.lightningIntensity = Math.max(0, this.lightningDuration / 0.2);
          }
        }
      } else {
        this.lightningIntensity = 0;
      }
    }

    // 2. Update Desert Dust Particles
    if (weather.dustIntensity > 0.05) {
      const driftSpeed = (weather.dustIntensity * 320 + speedRatio * 280);
      for (const p of this.dustParticles) {
        p.x += (p.vx - speedRatio * 150) * dt;
        p.y += p.vy * dt + Math.sin(s.elapsed * 5 + p.x * 0.02) * 12 * dt;

        if (p.x < -20 || p.y < 0 || p.y > 300) {
          p.x = 500 + Math.random() * 50;
          p.y = 80 + Math.random() * 210;
        }
      }
    }
  }

  private triggerSplash(x: number, y: number): void {
    if (this.splashes.length < 25) {
      this.splashes.push({
        x,
        y,
        radius: 1,
        maxRadius: 3 + Math.random() * 5,
        alpha: 0.7,
      });
    }
  }

  /**
   * Main weather rendering function - drawn on top of road/sky layers
   */
  public render(ctx: CanvasRenderingContext2D, s: GameState, width: number, height: number): void {
    const weather = this.getCurrentWeather(s.z);
    const elapsed = s.elapsed;
    const speedRatio = clamp(s.speed / 9500, 0, 1.2);
    const turn = s.yaw;

    ctx.save();

    // -------------------------------------------------------------
    // 1. SKY & HORIZON COLOR GRADING / ATMOSPHERIC TINT
    // -------------------------------------------------------------
    if (weather.darkness > 0.02) {
      // Storm / overcast darkening
      ctx.fillStyle = `rgba(8, 14, 28, ${weather.darkness * 0.72})`;
      ctx.fillRect(0, 0, width, height);
    }

    if (weather.sunsetGlow > 0.05) {
      // Vibrant golden twilight sunset wash
      const sunsetGrad = ctx.createLinearGradient(0, 0, 0, 185);
      sunsetGrad.addColorStop(0, `rgba(255, 75, 43, ${weather.sunsetGlow * 0.38})`);
      sunsetGrad.addColorStop(0.5, `rgba(255, 160, 40, ${weather.sunsetGlow * 0.32})`);
      sunsetGrad.addColorStop(1, `rgba(255, 230, 110, ${weather.sunsetGlow * 0.18})`);
      ctx.fillStyle = sunsetGrad;
      ctx.fillRect(0, 0, width, 185);

      // Sun reflection sheen on the sea horizon
      const sunCenter = 330 - turn * 25;
      const flareGrad = ctx.createRadialGradient(sunCenter, 130, 2, sunCenter, 130, 110);
      flareGrad.addColorStop(0, `rgba(255, 250, 200, ${weather.sunsetGlow * 0.45})`);
      flareGrad.addColorStop(0.4, `rgba(255, 140, 60, ${weather.sunsetGlow * 0.2})`);
      flareGrad.addColorStop(1, 'rgba(255, 100, 50, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(sunCenter - 110, 20, 220, 165);
    }

    // -------------------------------------------------------------
    // 2. VOLUMETRIC FOG & MOUNTAIN MIST LAYERS
    // -------------------------------------------------------------
    if (weather.fogDensity > 0.05) {
      const fogAlpha = weather.fogDensity;

      // Layer A: Distant Horizon Fog Haze (blurs distant mountains and curves)
      const horizonFog = ctx.createLinearGradient(0, 120, 0, 195);
      horizonFog.addColorStop(0, `rgba(188, 214, 224, 0)`);
      horizonFog.addColorStop(0.4, `rgba(195, 220, 230, ${fogAlpha * 0.65})`);
      horizonFog.addColorStop(0.8, `rgba(215, 235, 242, ${fogAlpha * 0.85})`);
      horizonFog.addColorStop(1, `rgba(190, 215, 225, ${fogAlpha * 0.4})`);
      ctx.fillStyle = horizonFog;
      ctx.fillRect(0, 120, width, 75);

      // Layer B: Rolling Volumetric Mist Banks that drift across the road
      ctx.save();
      for (let layer = 0; layer < 3; layer++) {
        const layerY = 150 + layer * 38;
        const drift = (elapsed * (18 + layer * 14) + layer * 120) % (width + 200) - 100;
        const bankW = 240 + layer * 80;
        const bankH = 45 + layer * 20;

        const mistGrad = ctx.createRadialGradient(
          drift,
          layerY,
          bankW * 0.1,
          drift,
          layerY,
          bankW * 0.5
        );
        mistGrad.addColorStop(0, `rgba(225, 240, 248, ${fogAlpha * 0.42})`);
        mistGrad.addColorStop(0.6, `rgba(205, 225, 238, ${fogAlpha * 0.22})`);
        mistGrad.addColorStop(1, 'rgba(200, 220, 235, 0)');

        ctx.fillStyle = mistGrad;
        ctx.beginPath();
        ctx.ellipse(drift, layerY, bankW * 0.5, bankH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Layer C: Road-level tyre mist / moisture vapor
      const roadMist = ctx.createLinearGradient(0, 240, 0, 300);
      roadMist.addColorStop(0, 'rgba(220, 240, 250, 0)');
      roadMist.addColorStop(1, `rgba(210, 235, 245, ${fogAlpha * 0.32})`);
      ctx.fillStyle = roadMist;
      ctx.fillRect(0, 240, width, 60);
    }

    // -------------------------------------------------------------
    // 3. DESERT HEAT WAVE & DUST/SAND PARTICLES
    // -------------------------------------------------------------
    if (weather.dustIntensity > 0.05) {
      const dustAlpha = weather.dustIntensity;

      // Heat shimmer amber wash on lower road
      const heatGrad = ctx.createLinearGradient(0, 160, 0, 220);
      heatGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
      heatGrad.addColorStop(0.5, `rgba(234, 88, 12, ${dustAlpha * 0.2})`);
      heatGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = heatGrad;
      ctx.fillRect(0, 160, width, 60);

      // Fast streaming sand grains and dust motes
      ctx.save();
      for (const p of this.dustParticles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * dustAlpha;
        // Streak dust along velocity
        const streakLen = p.size * (2 + speedRatio * 3.5);
        ctx.fillRect(p.x, p.y, streakLen, p.size);
      }
      ctx.restore();
    }

    // -------------------------------------------------------------
    // 4. RAIN STREAKS, WATER SPLASHES & ROAD WETNESS
    // -------------------------------------------------------------
    if (weather.rainIntensity > 0.02) {
      const rainAlpha = weather.rainIntensity;
      const slant = -turn * 0.45 - 0.22; // Angled rain based on steering & crosswind

      ctx.save();
      // Wet asphalt glossy reflection sheen
      const wetRoadGrad = ctx.createLinearGradient(0, 200, 0, 300);
      wetRoadGrad.addColorStop(0, 'rgba(100, 140, 180, 0.04)');
      wetRoadGrad.addColorStop(1, `rgba(180, 220, 255, ${rainAlpha * 0.16})`);
      ctx.fillStyle = wetRoadGrad;
      ctx.fillRect(0, 200, width, 100);

      // Render rain drops
      ctx.lineWidth = 1.2;
      for (const drop of this.rainDrops) {
        const dropLen = drop.length * (1 + speedRatio * 1.5);
        ctx.strokeStyle =
          drop.layer === 2
            ? `rgba(225, 245, 255, ${drop.alpha * rainAlpha * 0.85})`
            : drop.layer === 1
            ? `rgba(185, 220, 245, ${drop.alpha * rainAlpha * 0.6})`
            : `rgba(150, 190, 225, ${drop.alpha * rainAlpha * 0.35})`;

        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + slant * dropLen, drop.y + dropLen);
        ctx.stroke();
      }

      // Render road droplet splashes
      ctx.lineWidth = 1;
      for (const sp of this.splashes) {
        ctx.strokeStyle = `rgba(220, 240, 255, ${sp.alpha * rainAlpha * 0.7})`;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sp.radius * 2.2, sp.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Windshield water droplets trickling
      for (const drop of this.screenDroplets) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * rainAlpha})`;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        ctx.fill();
        // Droplet specular highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(drop.x - 0.5, drop.y - 0.5, 1, 1);
      }
      ctx.restore();
    }

    // -------------------------------------------------------------
    // 5. DRAMATIC LIGHTNING FLASH
    // -------------------------------------------------------------
    if (weather.lightningIntensity > 0.01) {
      ctx.fillStyle = `rgba(235, 248, 255, ${weather.lightningIntensity * 0.65})`;
      ctx.fillRect(0, 0, width, height);

      // Forked lightning bolt silhouette in the distance
      if (weather.lightningIntensity > 0.5) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${weather.lightningIntensity * 0.9})`;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const startX = 160 + ((Math.floor(elapsed * 10) * 83) % 200);
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX + 18, 45);
        ctx.lineTo(startX + 8, 85);
        ctx.lineTo(startX + 28, 140);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

export const globalWeatherEngine = new WeatherEngine();
