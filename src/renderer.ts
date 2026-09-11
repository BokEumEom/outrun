import * as Drive from './engine';
import { GameState, ProjectedPoint, TrafficCar, VisibleSegment } from './types';
import { globalWeatherEngine } from './weather';

export const W = 480;
export const H = 300;

export interface Assets {
  loaded: boolean;
  carAtlas: HTMLCanvasElement | null;
  skyImage: HTMLImageElement | null;
  shopsAtlas: HTMLCanvasElement | null;
  crowdAtlas: HTMLCanvasElement | null;
  natureAtlas: HTMLCanvasElement | null;
  stageAtlas: HTMLCanvasElement | null;
  endingAtlas: HTMLCanvasElement | null;
  emptyAtlas: HTMLCanvasElement | null;
  walkAtlas: HTMLCanvasElement | null;
}

const CAR_RECTS: [number, number, number, number][] = [
  [23, 126, 480, 231],
  [553, 126, 427, 230],
  [1035, 126, 482, 231],
  [108, 460, 321, 545],
  [569, 646, 397, 249],
  [1094, 505, 398, 415],
];

const spriteCache = new WeakMap<CanvasImageSource, Map<string, HTMLCanvasElement>>();

export function drawAsset(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  let cache = spriteCache.get(source);
  if (!cache) {
    cache = new Map();
    spriteCache.set(source, cache);
  }
  const key = [sx, sy, sw, sh].join(',');
  let small = cache.get(key);
  if (!small) {
    small = document.createElement('canvas');
    const scale = Math.min(1, 240 / sw);
    small.width = Math.max(1, Math.round(sw * scale));
    small.height = Math.max(1, Math.round(sh * scale));
    const c = small.getContext('2d');
    if (c) {
      c.imageSmoothingEnabled = false;
      c.drawImage(source, sx, sy, sw, sh, 0, 0, small.width, small.height);
    }
    cache.set(key, small);
  }
  ctx.drawImage(small, dx, dy, dw, dh);
}

function processChromaKey(img: HTMLImageElement, width = 1536, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, width, height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 135 && d[i + 2] > 135 && d[i + 1] < 125 && Math.min(d[i], d[i + 2]) - d[i + 1] > 70) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}

export function loadAllAssets(
  onProgress?: (loadedCount: number, total: number) => void
): Promise<Assets> {
  const assets: Assets = {
    loaded: false,
    carAtlas: null,
    skyImage: null,
    shopsAtlas: null,
    crowdAtlas: null,
    natureAtlas: null,
    stageAtlas: null,
    endingAtlas: null,
    emptyAtlas: null,
    walkAtlas: null,
  };

  const imagesToLoad: { key: keyof Assets; url: string; chroma?: boolean; customDimensions?: [number, number] }[] = [
    { key: 'carAtlas', url: '/media/CAR_SHEET.png', chroma: true },
    { key: 'skyImage', url: '/media/SKY_DATA.png', chroma: false },
    { key: 'shopsAtlas', url: '/media/SHOP_DATA.png', chroma: true },
    { key: 'crowdAtlas', url: '/media/CROWD_DATA.png', chroma: true },
    { key: 'natureAtlas', url: '/media/NATURE_DATA.png', chroma: true },
    { key: 'stageAtlas', url: '/media/STAGE_DATA.png', chroma: true },
    { key: 'endingAtlas', url: '/media/ENDING_DATA.png', chroma: true },
    { key: 'emptyAtlas', url: '/media/EMPTY_DATA.png', chroma: true },
    { key: 'walkAtlas', url: '/media/WALK_DATA.png', chroma: true },
  ];

  let loadedCount = 0;
  return new Promise((resolve) => {
    imagesToLoad.forEach(({ key, url, chroma }) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (key === 'skyImage') {
          assets.skyImage = img;
        } else if (chroma) {
          const w = img.width || 1536;
          const h = img.height || 1024;
          (assets as unknown as Record<string, unknown>)[key] = processChromaKey(img, w, h);
        }
        loadedCount++;
        if (onProgress) onProgress(loadedCount, imagesToLoad.length);
        if (loadedCount === imagesToLoad.length) {
          assets.loaded = true;
          resolve(assets);
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load ${url}`);
        loadedCount++;
        if (onProgress) onProgress(loadedCount, imagesToLoad.length);
        if (loadedCount === imagesToLoad.length) {
          assets.loaded = true;
          resolve(assets);
        }
      };
      img.src = url;
    });
  });
}

export function drawSpeedometer(
  ctx: CanvasRenderingContext2D,
  s: GameState
): void {
  const kmh = Math.round((s.speed / Drive.MAX) * 294);
  const ratio = Math.max(0, Math.min(1, s.speed / Drive.MAX));

  const bx = 8;
  const by = 222;
  const bw = 126;
  const bh = 88;

  ctx.save();

  // 1. Cluster bezel background with subtle gradient & border
  ctx.fillStyle = 'rgba(4, 15, 26, 0.88)';
  ctx.strokeStyle = ratio > 0.92 ? '#ef4444' : 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.5;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
  }

  // 2. Analog Dial Gauge
  const cx = bx + 36;
  const cy = by + 39;
  const r = 25;
  const startAngle = 0.75 * Math.PI; // 135 deg
  const totalSweep = 1.5 * Math.PI;  // 270 deg
  const endAngle = startAngle + totalSweep;
  const currentAngle = startAngle + ratio * totalSweep;

  // Background track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, false);
  ctx.strokeStyle = 'rgba(25, 52, 70, 0.8)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Redline background track section (last 20% of arc)
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle + totalSweep * 0.8, endAngle, false);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Graduation tick marks
  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) {
    const tAngle = startAngle + (i / tickCount) * totalSweep;
    const isRedline = i >= 5;
    const tickLen = i % 2 === 0 ? 4.5 : 2.5;
    const innerR = r - 5;
    const outerR = innerR - tickLen;

    const x1 = cx + Math.cos(tAngle) * innerR;
    const y1 = cy + Math.sin(tAngle) * innerR;
    const x2 = cx + Math.cos(tAngle) * outerR;
    const y2 = cy + Math.sin(tAngle) * outerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isRedline ? '#ef4444' : 'rgba(200, 230, 245, 0.6)';
    ctx.lineWidth = i % 2 === 0 ? 1.5 : 1;
    ctx.stroke();
  }

  // Active colored speed arc fill
  if (ratio > 0.01) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, currentAngle, false);
    if (ratio < 0.5) {
      ctx.strokeStyle = '#38bdf8'; // Electric cyan
    } else if (ratio < 0.82) {
      ctx.strokeStyle = '#facc15'; // Warm amber
    } else {
      ctx.strokeStyle = '#ef4444'; // Redline crimson
    }
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Speedometer Needle with high-speed vibration
  const jitter = ratio > 0.94 ? (Math.random() - 0.5) * 0.04 : 0;
  const needleAngle = currentAngle + jitter;
  const needleLen = r - 3;
  const nx = cx + Math.cos(needleAngle) * needleLen;
  const ny = cy + Math.sin(needleAngle) * needleLen;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = ratio > 0.85 ? '#ff5252' : '#ffda85';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center pivot pin
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffda85';
  ctx.fill();
  ctx.strokeStyle = '#05111c';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3. Digital Readout (Right Side)
  const tx = bx + 72;
  const speedStr = String(kmh).padStart(3, '0');
  const digitColor = ratio > 0.92 ? '#ff5e5e' : '#fff5cc';

  drawText(ctx, speedStr, tx, by + 26, 17, digitColor);
  drawText(ctx, 'km/h', tx + 35, by + 25, 9, '#83eddf');

  // Gear indicator & Status pill
  const isTopGear = s.gear ? s.gear === 'HIGH' : kmh >= 160;
  const gearText = isTopGear ? 'GEAR:TOP' : 'GEAR:LOW';
  const gearColor = isTopGear ? '#4ade80' : '#38bdf8';
  drawText(ctx, gearText, tx, by + 39, 9, gearColor);

  // Dynamic Status Badge
  if (s.braking) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.fillRect(tx, by + 44, 46, 12);
    ctx.strokeRect(tx, by + 44, 46, 12);
    drawText(ctx, 'BRAKE', tx + 8, by + 53, 8, '#ff8080');
  } else if ((s.skid || 0) > 0.2) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.fillRect(tx, by + 44, 46, 12);
    ctx.strokeRect(tx, by + 44, 46, 12);
    drawText(ctx, 'DRIFT', tx + 9, by + 53, 8, '#fcd34d');
  } else if (ratio > 0.96) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1;
    ctx.fillRect(tx, by + 44, 46, 12);
    ctx.strokeRect(tx, by + 44, 46, 12);
    drawText(ctx, 'MAX SPD', tx + 4, by + 53, 8, '#ff9999');
  } else {
    drawText(ctx, 'RPM/REV', tx, by + 53, 8, '#86a8b4');
  }

  // 4. Horizontal 8-Segment LED Throttle / Rev Bar at bottom
  const barY = by + 72;
  const barX = bx + 8;
  const segW = 12;
  const segH = 5;
  const segGap = 2;
  const totalSegs = 8;

  for (let i = 0; i < totalSegs; i++) {
    const sx = barX + i * (segW + segGap);
    const segRatio = (i + 1) / totalSegs;
    const isLit = ratio >= segRatio - 0.05;

    let litColor = '#22c55e'; // Green (1-4)
    let dimColor = 'rgba(34, 197, 94, 0.15)';
    if (i >= 4 && i < 6) {
      litColor = '#eab308'; // Yellow (5-6)
      dimColor = 'rgba(234, 179, 8, 0.15)';
    } else if (i >= 6) {
      litColor = '#ef4444'; // Red (7-8)
      dimColor = 'rgba(239, 68, 68, 0.15)';
    }

    ctx.fillStyle = isLit ? litColor : dimColor;
    ctx.fillRect(sx, barY, segW, segH);
  }

  ctx.restore();
}

export function drawCourseRadar(
  ctx: CanvasRenderingContext2D,
  s: GameState
): void {
  const currentStage = Drive.stageIndex(s.z);
  const stg = Drive.STAGES[currentStage] || Drive.STAGES[0];
  const weatherState = globalWeatherEngine.getCurrentWeather(s.z);

  const bw = 132;
  const bh = 76;
  const bx = W - bw - 8;
  const by = 220;

  ctx.save();

  // 1. Matching arcade cluster bezel background
  ctx.fillStyle = 'rgba(4, 15, 26, 0.90)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.5;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
  }

  // Metallic bezel corner rivets
  for (const [rx, ry] of [
    [bx + 4, by + 4],
    [bx + bw - 4, by + 4],
    [bx + 4, by + bh - 4],
    [bx + bw - 4, by + bh - 4],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#64748b';
    ctx.fill();
  }

  // 2. Stage Header & Progress Meter
  drawText(ctx, `STAGE ${currentStage + 1}/6`, bx + 8, by + 12, 9, '#38bdf8');
  drawText(ctx, stg.name, bx + bw - 8, by + 12, 9, '#ffff98', 'right');

  // Stage progress horizontal bar
  const stageZ = s.z % Drive.STAGE_LENGTH;
  const stageProgress = Math.min(1, stageZ / Drive.STAGE_LENGTH);
  const pBarX = bx + 8;
  const pBarY = by + 17;
  const pBarW = bw - 16;
  const pBarH = 3.5;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pBarX, pBarY, pBarW, pBarH);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(pBarX, pBarY, pBarW * stageProgress, pBarH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(pBarX, pBarY, pBarW, pBarH);

  // 3. Mini OutRun Branching Course Map Radar (Wireframe Pyramid)
  // 5 tiers:
  // Tier 0: Stage 1 (1 node)
  // Tier 1: Stage 2 (2 nodes)
  // Tier 2: Stage 3 (3 nodes)
  // Tier 3: Stage 4 (4 nodes)
  // Tier 4: Goals A B C D E (5 nodes)
  const mapCx = bx + bw / 2;
  const mapBaseY = by + 26;
  const rowH = 6.5;
  const colW = 9;

  // Draw wireframe route circuit lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 1;

  for (let tier = 0; tier < 4; tier++) {
    const y1 = mapBaseY + tier * rowH;
    const y2 = mapBaseY + (tier + 1) * rowH;
    const count1 = tier + 1;
    const startX1 = mapCx - ((count1 - 1) * colW) / 2;
    const count2 = tier + 2;
    const startX2 = mapCx - ((count2 - 1) * colW) / 2;

    for (let i = 0; i < count1; i++) {
      const x1 = startX1 + i * colW;
      const x2Left = startX2 + i * colW;
      const x2Right = startX2 + (i + 1) * colW;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2Left, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2Right, y2);
      ctx.stroke();
    }
  }

  // Draw node points with player radar beacon
  for (let tier = 0; tier < 5; tier++) {
    const y = mapBaseY + tier * rowH;
    const count = tier + 1;
    const startX = mapCx - ((count - 1) * colW) / 2;

    for (let i = 0; i < count; i++) {
      const x = startX + i * colW;
      const isCurrentTier = Math.min(4, currentStage) === tier;
      const isPlayerNode =
        isCurrentTier &&
        (tier === 0 || (s.route === 'HIGHLAND' ? i >= 1 : i === 0));

      ctx.beginPath();
      ctx.arc(x, y, isPlayerNode ? 2.5 : 1.5, 0, Math.PI * 2);

      if (isPlayerNode) {
        const pulse = (Math.sin(s.elapsed * 10) + 1) * 0.5;
        ctx.fillStyle = pulse > 0.4 ? '#ef4444' : '#facc15';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (tier < currentStage) {
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      } else {
        ctx.fillStyle = '#334155';
        ctx.fill();
      }
    }
  }

  // 4. Bottom Weather & Route Indicator
  const footerY = by + 68;
  drawText(
    ctx,
    `${weatherState.currentProfile.icon} ${weatherState.currentProfile.ko}`,
    bx + 8,
    footerY,
    8,
    '#ffd18c'
  );
  drawText(
    ctx,
    s.route ? `ROUTE:${s.route}` : 'ROUTE:COAST',
    bx + bw - 8,
    footerY,
    8,
    '#7dd3fc',
    'right'
  );

  ctx.restore();
}

/**
 * Stylized Pixel-Art Mini-Map at the bottom center of the screen
 * Displays the current stage path with authentic retro 8-bit curves,
 * checkpoints, fork route indicators, and an animated pixel-art player Ferrari.
 */
export function drawPixelMiniMap(
  ctx: CanvasRenderingContext2D,
  s: GameState
): void {
  const currentStage = Drive.stageIndex(s.z);
  const stg = Drive.STAGES[currentStage] || Drive.STAGES[0];
  const stageZ = ((s.z % Drive.STAGE_LENGTH) + Drive.STAGE_LENGTH) % Drive.STAGE_LENGTH;
  const stageProgress = Drive.clamp(stageZ / Drive.STAGE_LENGTH, 0, 1);

  // Position: bottom center between Speedometer (x:8..140) and Course Radar (x:340..472)
  const bw = 188;
  const bh = 32;
  const bx = Math.round((W - bw) / 2); // 146
  const by = 264; // Aligns bottom edge with y=296, exactly matching side clusters

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. Pixel-art Bezel Housing
  // Dark CRT background with slight tint
  ctx.fillStyle = 'rgba(3, 10, 18, 0.94)';
  ctx.fillRect(bx, by, bw, bh);

  // Stepped Pixel Border (Authentic 8-bit notched corners)
  ctx.strokeStyle = '#f59e0b'; // Sega Arcade Amber
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  // Corner Pixel Bolts (Brass rivets)
  ctx.fillStyle = '#d97706';
  ctx.fillRect(bx + 2, by + 2, 2, 2);
  ctx.fillRect(bx + bw - 4, by + 2, 2, 2);
  ctx.fillRect(bx + 2, by + bh - 4, 2, 2);
  ctx.fillRect(bx + bw - 4, by + bh - 4, 2, 2);

  // 2. Stage Header & Progress %
  const stageTitle = `STG ${currentStage + 1} ${stg.name}`;
  drawText(ctx, stageTitle, bx + 7, by + 8, 7, '#38bdf8');

  const pct = Math.floor(stageProgress * 100);
  const pctStr = `${pct}%`;
  drawText(ctx, pctStr, bx + bw - 7, by + 8, 7, '#4ade80', 'right');

  // Center Mini Checkpoint indicator
  const kmRemaining = ((Drive.STAGE_LENGTH - stageZ) / 10000).toFixed(1);
  drawText(ctx, `${kmRemaining}km`, bx + bw / 2, by + 8, 7, '#fef08a', 'center');

  // 3. Pixel-Art Track Path
  const startX = bx + 14;
  const endX = bx + bw - 14;
  const pathWidth = endX - startX;
  const trackBaseY = by + 21;
  const numSegments = 24;

  // Calculate track coordinates matching the actual stage curves
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const px = Math.round(startX + t * pathWidth);
    const sampleZ = currentStage * Drive.STAGE_LENGTH + t * Drive.STAGE_LENGTH;
    const curveOffset = Drive.clamp(Drive.curve(sampleZ) * 2.2, -5, 5);
    const py = Math.round(trackBaseY - curveOffset);
    points.push({ x: px, y: py });
  }

  // Draw Pixel-Art Road Path (Road bed, curbs, center lines)
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Asphalt surface (4px tall)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(p1.x, p1.y - 1, p2.x - p1.x + 1, 4);

    // Top & Bottom alternating red/white pixel curbs
    const isRedCurb = i % 2 === 0;
    ctx.fillStyle = isRedCurb ? '#ef4444' : '#f8fafc';
    ctx.fillRect(p1.x, p1.y - 2, p2.x - p1.x + 1, 1);
    ctx.fillRect(p1.x, p1.y + 3, p2.x - p1.x + 1, 1);

    // Dashed center yellow lane pixels
    if (i % 2 === 1) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(p1.x + 1, p1.y + 1, 2, 1);
    }
  }

  // Checkered START line flag pattern (at startX)
  const startY = points[0].y;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(startX - 3, startY - 2, 3, 5);
  ctx.fillStyle = '#000000';
  ctx.fillRect(startX - 3, startY - 2, 2, 2);
  ctx.fillRect(startX - 1, startY + 1, 2, 2);

  // Mid-stage Checkpoint Marker (50%)
  const midIdx = Math.floor(numSegments / 2);
  const midPoint = points[midIdx];
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(midPoint.x - 1, midPoint.y - 4, 2, 7);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(midPoint.x, midPoint.y - 4, 3, 2); // tiny yellow pennant

  // Checkered FINISH line flag or Fork Branch (at endX)
  const endPoint = points[points.length - 1];
  const isForkStage = currentStage === 0 || s.z > 90000;
  if (isForkStage && currentStage === 0) {
    // Branch split: show upper (L: SEA) and lower (R: MTN) pixel branches
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(endPoint.x - 4, endPoint.y - 4, 4, 2);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(endPoint.x - 4, endPoint.y + 3, 4, 2);
  } else {
    // Finish checkered flag
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(endPoint.x, endPoint.y - 2, 3, 5);
    ctx.fillStyle = '#000000';
    ctx.fillRect(endPoint.x, endPoint.y - 2, 2, 2);
    ctx.fillRect(endPoint.x + 1, endPoint.y + 1, 2, 2);
  }

  // 4. Pixel-Art Player Car (Ferrari Testarossa)
  const playerX = Math.round(startX + stageProgress * pathWidth);
  const playerCurve = Drive.clamp(Drive.curve(s.z) * 2.2, -5, 5);
  const playerY = Math.round(trackBaseY - playerCurve);

  // Animated exhaust smoke puff behind player car when speeding
  if (s.speed > 2000 && Math.floor(s.elapsed * 12) % 2 === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(playerX - 7, playerY, 2, 2);
    ctx.fillStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.fillRect(playerX - 9, playerY - 1, 2, 2);
  }

  // Draw 10x6 Pixel Ferrari Sprite
  // Row 0: Roof
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(playerX - 3, playerY - 3, 6, 1);
  // Row 1: Windshield (cyan)
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(playerX - 2, playerY - 2, 4, 1);
  // Row 2: Red Body
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(playerX - 5, playerY - 1, 10, 2);
  // Headlights
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(playerX + 4, playerY - 1, 1, 1);
  // Row 3: Tires & Fender
  ctx.fillStyle = '#020617';
  ctx.fillRect(playerX - 4, playerY + 1, 2, 1);
  ctx.fillRect(playerX + 2, playerY + 1, 2, 1);

  // Animated pulsating locator arrow (▼) above the player's car
  const flash = Math.sin(s.elapsed * 8) > 0;
  ctx.fillStyle = flash ? '#facc15' : '#ffffff';
  ctx.fillRect(playerX - 1, playerY - 6, 3, 1);
  ctx.fillRect(playerX, playerY - 5, 1, 1);

  ctx.restore();
}

export function drawRetroTopHUD(
  ctx: CanvasRenderingContext2D,
  s: GameState
): void {
  ctx.save();

  // 1. TIME Plate (Top Left)
  const timeBoxX = 8;
  const timeBoxY = 6;
  const timeBoxW = 90;
  const timeBoxH = 24;

  const isLowTime = s.time <= 9;
  const flashTime = isLowTime && Math.floor(s.elapsed * 6) % 2 === 0;

  ctx.fillStyle = flashTime ? 'rgba(185, 28, 28, 0.95)' : 'rgba(4, 15, 26, 0.90)';
  ctx.strokeStyle = isLowTime ? '#ef4444' : '#f59e0b';
  ctx.lineWidth = 1.5;

  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(timeBoxX, timeBoxY, timeBoxW, timeBoxH, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(timeBoxX, timeBoxY, timeBoxW, timeBoxH);
    ctx.strokeRect(timeBoxX, timeBoxY, timeBoxW, timeBoxH);
  }

  // Red/Orange TIME badge
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(timeBoxX + 4, timeBoxY + 4, 30, timeBoxH - 8);
  drawText(ctx, 'TIME', timeBoxX + 6, timeBoxY + 16, 9, '#ffffff');

  // Large 7-segment digital time readout
  const timeStr = String(Math.ceil(s.time)).padStart(2, '0');
  drawText(
    ctx,
    timeStr,
    timeBoxX + 44,
    timeBoxY + 18,
    16,
    isLowTime ? '#ff4d4d' : '#ffff55'
  );

  // 2. SCORE Plate (Top Center/Left)
  const scoreBoxX = 104;
  const scoreBoxY = 6;
  const scoreBoxW = 120;
  const scoreBoxH = 24;

  ctx.fillStyle = 'rgba(4, 15, 26, 0.90)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.5;

  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH);
    ctx.strokeRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH);
  }

  // Hot pink SCORE badge
  ctx.fillStyle = '#be185d';
  ctx.fillRect(scoreBoxX + 4, scoreBoxY + 4, 34, scoreBoxH - 8);
  drawText(ctx, 'SCORE', scoreBoxX + 6, scoreBoxY + 16, 8, '#ffffff');

  // 7-digit electronic green/gold score
  const scoreStr = String(Math.floor(s.score)).padStart(7, '0');
  drawText(ctx, scoreStr, scoreBoxX + 44, scoreBoxY + 17, 13, '#4ade80');

  // 3. Retro OUT RUN Chrome Banner (Top Right)
  const logoBoxX = W - 110;
  const logoBoxY = 6;
  const logoBoxW = 102;
  const logoBoxH = 24;

  ctx.fillStyle = 'rgba(4, 15, 26, 0.90)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;

  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH);
    ctx.strokeRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH);
  }

  // Sega Chrome Gradient Styled "OUT RUN" Banner
  drawText(ctx, '★ OUT RUN ★', logoBoxX + logoBoxW / 2, logoBoxY + 17, 12, '#38bdf8', 'center');

  ctx.restore();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number = 10,
  color: string = '#fff5da',
  align: CanvasTextAlign = 'left'
): void {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = '#122c48';
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function bar(
  ctx: CanvasRenderingContext2D,
  color: string,
  y: number,
  left: number,
  right: number
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(left), y, Math.ceil(right) - Math.floor(left), 1);
}

function sprite(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement | null,
  i: number,
  x: number,
  y: number,
  width: number,
  clip: number | null = H
): void {
  if (!atlas) return;
  const r = CAR_RECTS[i];
  const height = (width * r[3]) / r[2];
  ctx.save();
  if (clip !== null) {
    ctx.beginPath();
    ctx.rect(0, 0, W, clip);
    ctx.clip();
  }
  drawAsset(
    ctx,
    atlas,
    r[0],
    r[1],
    r[2],
    r[3],
    Math.round(x - width / 2),
    Math.round(y - height),
    Math.round(width),
    Math.round(height)
  );
  ctx.restore();
}

function nature(
  ctx: CanvasRenderingContext2D,
  natureAtlas: HTMLCanvasElement | null,
  which: number,
  x: number,
  y: number,
  w: number,
  clip: number
): void {
  if (!natureAtlas) return;
  const r: [number, number, number, number][] = [
    [8, 240, 834, 535],
    [842, 390, 678, 395],
    [140, 790, 195, 195],
  ];
  const target = r[which];
  const h = (w * target[3]) / target[2];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  if (which === 2) {
    ctx.fillStyle = '#e6fff4';
    ctx.fillRect(x - w * 0.6, y - 1, w * 1.2, 1);
  }
  drawAsset(
    ctx,
    natureAtlas,
    target[0],
    target[1],
    target[2],
    target[3],
    Math.round(x - w / 2),
    Math.round(y - h),
    Math.round(w),
    Math.round(h)
  );
  ctx.restore();
}

function treeShadow(
  ctx: CanvasRenderingContext2D,
  p: ProjectedPoint,
  edge: number,
  clip: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  ctx.fillStyle = '#20352d35';
  const x = p.x + p.w * (edge + 0.33);
  const y = p.y;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - p.w * 0.9, y + p.w * 0.025);
  ctx.lineTo(x - p.w * 0.95, y - p.w * 0.015);
  ctx.lineTo(x, y - p.w * 0.014);
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.ellipse(
      x - p.w * 0.87,
      y - p.w * 0.015,
      p.w * (0.17 + (k % 2) * 0.07),
      p.w * 0.015,
      (k - 2) * 0.18,
      0,
      7
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawCrowd(
  ctx: CanvasRenderingContext2D,
  crowdAtlas: HTMLCanvasElement | null,
  p: ProjectedPoint,
  clip: number
): void {
  if (!crowdAtlas) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  for (const side of [-1, 1]) {
    const w = p.w * 0.7;
    const h = w * 0.28;
    const x = p.x + side * p.w * 1.45;
    ctx.fillStyle = '#334a3e40';
    ctx.fillRect(x - w * 0.5, p.y - 2, w, 4);
    drawAsset(
      ctx,
      crowdAtlas,
      0,
      290,
      1536,
      425,
      Math.round(x - w / 2),
      Math.round(p.y - h),
      Math.round(w),
      Math.round(h)
    );
  }
  ctx.restore();
}

function startGate(ctx: CanvasRenderingContext2D, p: ProjectedPoint, clip: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  const left = p.x - p.w * 1.05;
  const right = p.x + p.w * 1.05;
  const top = p.y - p.w * 0.67;
  const bottom = top + p.w * 0.22;
  ctx.fillStyle = '#e1e7e8';
  ctx.fillRect(left, top, p.w * 0.018, p.y - top);
  ctx.fillRect(right, top, p.w * 0.018, p.y - top);
  ctx.fillStyle = '#fff8e8';
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = '#d5d3c7';
  ctx.fillRect(left, bottom - p.w * 0.025, right - left, p.w * 0.025);
  drawText(ctx, 'START', p.x, bottom - p.w * 0.04, p.w * 0.2, '#e72728', 'center');
  for (const side of [-1, 1]) {
    const x = p.x + side * p.w * 1.13;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = ['#ed724e', '#fff3b2', '#40b9bd'][k];
      ctx.fillRect(x - p.w * 0.095, bottom + k * p.w * 0.13, p.w * 0.19, p.w * 0.1);
      drawText(
        ctx,
        ['COAST', '86', 'GO!'][k],
        x,
        bottom + (k * 0.13 + 0.072) * p.w,
        p.w * 0.047,
        '#173547',
        'center'
      );
    }
  }
  ctx.restore();
}

function drawShop(
  ctx: CanvasRenderingContext2D,
  shopsAtlas: HTMLCanvasElement | null,
  which: number,
  p: ProjectedPoint,
  edge: number,
  clip: number
): void {
  if (!shopsAtlas) return;
  const r: [number, number, number, number] = which
    ? [774, 75, 750, 690]
    : [12, 45, 742, 706];
  const side = which ? -1 : 1;
  const w = p.w * 0.95;
  const h = (w * r[3]) / r[2];
  const x = p.x + side * p.w * (edge + 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  drawAsset(
    ctx,
    shopsAtlas,
    r[0],
    r[1],
    r[2],
    r[3],
    Math.round(x - w / 2),
    Math.round(p.y - h),
    Math.round(w),
    Math.round(h)
  );
  ctx.restore();
}

function stageObject(
  ctx: CanvasRenderingContext2D,
  stageAtlas: HTMLCanvasElement | null,
  i: number,
  p: ProjectedPoint,
  edge: number,
  clip: number,
  side: number
): void {
  if (!stageAtlas) return;
  const w = p.w * (i === 2 ? 1.1 : 0.85);
  const h = w;
  const x = p.x + side * p.w * (edge + 0.65);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  ctx.fillStyle = '#25312c45';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.12, p.y, w * 0.48, w * 0.045, 0, 0, 7);
  ctx.fill();
  drawAsset(
    ctx,
    stageAtlas,
    (i % 3) * 512,
    Math.floor(i / 3) * 512,
    512,
    512,
    Math.round(x - w / 2),
    Math.round(p.y - h),
    Math.round(w),
    Math.round(h)
  );
  ctx.restore();
}

function stageBackground(
  ctx: CanvasRenderingContext2D,
  s: GameState
): void {
  const k = Drive.stageIndex(s.z);
  if (!k) return;
  if (k === 5) {
    ctx.fillStyle = '#e9756655';
    ctx.fillRect(0, 0, W, 174);
    ctx.fillStyle = '#ffe2a0';
    ctx.beginPath();
    ctx.arc(330, 128, 24, 0, 7);
    ctx.fill();
  }
  if (k >= 2 && k <= 4) {
    const colors =
      k === 3
        ? ['#c58c6e', '#ab7157']
        : k === 4
        ? ['#a6b79b', '#7b9477']
        : ['#91b6ba', '#648f97'];
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = colors[layer];
      for (let x = 0; x < W; x += 3) {
        const height =
          18 +
          Math.sin((x + s.z * 0.0002) * 0.022 + layer) * 14 +
          Math.sin(x * 0.053 + layer) * 9;
        ctx.fillRect(x, 174 - height - layer * 4, 3, 126 + height + layer * 4);
      }
    }
  }
}

function finishGate(
  ctx: CanvasRenderingContext2D,
  p: ProjectedPoint,
  clip: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, clip);
  ctx.clip();
  const w = p.w;
  const top = p.y - w * 0.68;
  ctx.fillStyle = '#ece8d9';
  for (const side of [-1, 1]) {
    ctx.fillRect(p.x + side * w, top, w * 0.025, w * 0.68);
  }
  ctx.fillRect(p.x - w, top, 2 * w, w * 0.2);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : '#17202b';
    ctx.fillRect(p.x - w + i * w * 0.1, top, w * 0.1, w * 0.035);
  }
  drawText(ctx, 'GOAL', p.x, top + w * 0.16, w * 0.15, '#ef4438', 'center');
  ctx.fillStyle = '#fff';
  ctx.fillRect(p.x - w, p.y - w * 0.04, w * 2, w * 0.04);
  ctx.restore();
}

function background(
  ctx: CanvasRenderingContext2D,
  skyImage: HTMLImageElement | null,
  s: GameState
): void {
  const weather = globalWeatherEngine.getCurrentWeather(s.z);

  // Dynamic sky color tone based on weather
  let baseSky = '#0795ef';
  if (weather.darkness > 0.1) {
    baseSky = '#141e2b'; // Dark storm clouds
  } else if (weather.sunsetGlow > 0.15) {
    baseSky = '#dc4e37'; // Sunset red/orange
  } else if (weather.dustIntensity > 0.25) {
    baseSky = '#c96f2e'; // Canyon amber
  } else if (weather.fogDensity > 0.45) {
    baseSky = '#5f8899'; // Alpine cool misty blue
  }

  ctx.fillStyle = baseSky;
  ctx.fillRect(0, 0, W, H);
  if (skyImage && skyImage.complete && skyImage.naturalWidth) {
    const drift = Math.sin(s.z / 44000) * 20;
    if (weather.darkness > 0.15) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.35, 1 - weather.darkness * 0.75);
      ctx.drawImage(skyImage, -30 + drift, -5, 540, 184);
      ctx.restore();
    } else {
      ctx.drawImage(skyImage, -30 + drift, -5, 540, 184);
    }
  }

  // Sea / Horizon
  const seaBase = weather.darkness > 0.2 ? '#1e5362' : weather.sunsetGlow > 0.2 ? '#bd5a4b' : '#43dbc9';
  ctx.fillStyle = seaBase;
  ctx.fillRect(0, 174, W, 126);
  for (let y = 175; y < 300; y += 4) {
    ctx.fillStyle = y % 8 ? (weather.darkness > 0.2 ? '#2a6a7c' : '#b8f9df') : (weather.darkness > 0.2 ? '#174755' : '#74ecdf');
    ctx.fillRect(0, y, W, 1);
  }
  ctx.fillStyle = weather.darkness > 0.2 ? '#1b4138' : '#48ae80';
  for (let x = 0; x < W; x += 7) {
    const y = 171 - Math.sin(x * 0.021) * 3;
    ctx.fillRect(x, y, 8, 6);
  }
}

export function drawActor(
  ctx: CanvasRenderingContext2D,
  endingAtlas: HTMLCanvasElement | null,
  i: number,
  x: number,
  y: number,
  h: number
): void {
  if (!endingAtlas) return;
  const r: [number, number, number, number][] = [
    [110, 5, 290, 490],
    [680, 5, 180, 490],
    [1080, 5, 350, 495],
    [45, 515, 365, 485],
    [640, 505, 250, 490],
    [1090, 550, 380, 430],
  ];
  const target = r[i];
  const w = (h * target[2]) / target[3];
  drawAsset(
    ctx,
    endingAtlas,
    target[0],
    target[1],
    target[2],
    target[3],
    x - w / 2,
    y - h,
    w,
    h
  );
}

export function drawOfficial(
  ctx: CanvasRenderingContext2D,
  walkAtlas: HTMLCanvasElement | null,
  frame: number,
  x: number,
  y: number,
  h: number
): void {
  if (!walkAtlas) return;
  const w = (h * 384) / 930;
  drawAsset(ctx, walkAtlas, frame * 384, 30, 384, 930, x - w / 2, y - h, w, h);
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  assets: Assets,
  paused: boolean,
  demo: boolean
): void {
  background(ctx, assets.skyImage, s);
  stageBackground(ctx, s);

  const cameraZ = s.z - 1300;
  const base = Math.floor(cameraZ / 200);
  const fraction = cameraZ / 200 - base;
  const camY = Drive.hill(s.z) + 950;
  let offset = 0;
  let dx = -Drive.curve(cameraZ) * fraction * 7;
  let maxY = H;
  const visible: VisibleSegment[] = [];
  const trafficBySegment = new Map<number, TrafficCar[]>();

  for (const car of s.traffic) {
    const segment = Math.floor(car.z / 200);
    if (segment < base || segment > base + 170) continue;
    if (!trafficBySegment.has(segment)) trafficBySegment.set(segment, []);
    trafficBySegment.get(segment)!.push(car);
  }

  const project = (i: number, x: number): ProjectedPoint => {
    const dist = i * 200 - cameraZ;
    const scale = 0.84 / Math.max(1, dist);
    return {
      x: W / 2 + (scale * (x - s.x * 3000) * W) / 2,
      y: 169 - (scale * (Drive.hill(i * 200) - camY) * H) / 2,
      w: (scale * 3000 * W) / 2,
    };
  };

  for (let n = 0; n < 170; n++) {
    const i = base + n;
    const p = project(i, offset);
    const q = project(i + 1, offset + dx);
    offset += dx;
    dx += Drive.curve(i * 200) * 7;
    if (q.y >= p.y || q.y >= maxY) continue;
    const clip = maxY;
    const nearY = Math.min(H - 1, Math.ceil(maxY) - 1, Math.ceil(p.y) - 1);
    const farY = Math.max(0, Math.ceil(q.y));

    for (let y = nearY; y >= farY; y--) {
      const f = Drive.clamp((y - p.y) / (q.y - p.y), 0, 1);
      const cx = Drive.mix(p.x, q.x, f);
      const w = Drive.mix(p.w, q.w, f);
      const z = (i + f) * 200;
      const road = Drive.roads(z);
      const shade = Math.floor(z / 1700) % 2;
      const theme = Drive.STAGES[Drive.stageIndex(z)];
      bar(ctx, theme.ground[shade], y, 0, W);

      if (theme.sea) {
        const coast = cx - w * 1.9;
        bar(ctx, shade ? '#2bd2ce' : '#6be9d4', y, 0, coast);
        const foam =
          coast - Math.abs(Math.sin(z / 1600 - s.elapsed * 1.8)) * w * 0.055;
        bar(ctx, '#d5fff1', y, foam, foam + w * 0.018);
        if (y % 3 === 0) bar(ctx, '#8af4df', y, foam - w * 0.11, foam - w * 0.1);
      }

      for (const r of road) {
        const center = cx + w * r.x;
        const width = w * r.w;
        bar(ctx, '#f7f3e6', y, center - width * 1.014, center + width * 1.014);
        bar(ctx, shade ? '#929799' : '#959a9c', y, center - width, center + width);
        if (Math.floor(z / 700) % 2 === 0) {
          for (let lane = 1; lane < r.lanes; lane++) {
            const laneX = center - width + (2 * width * lane) / r.lanes;
            bar(
              ctx,
              '#f7f6e9',
              y,
              laneX - Math.max(0.65, w * 0.004),
              laneX + Math.max(0.65, w * 0.004)
            );
          }
        }
      }
    }
    visible.push({ i, p, q, clip });
    maxY = Math.min(maxY, q.y);
  }

  for (let n = visible.length - 1; n >= 0; n--) {
    const v = visible[n];
    const p = v.p;
    const z = v.i * 200;
    const roadList = Drive.roads(z);
    const edge = roadList[roadList.length - 1].x + roadList[roadList.length - 1].w;
    const stage = Drive.stageIndex(z);

    if (stage >= 1 && v.i % 24 === 0) {
      stageObject(
        ctx,
        assets.stageAtlas,
        stage === 4 ? (v.i % 48 === 0 ? 3 : 4) : stage === 5 ? 5 : stage - 1,
        p,
        edge,
        v.clip,
        v.i % 48 === 0 ? -1 : 1
      );
    }

    if ((stage === 0 || stage === 1 || stage === 5) && v.i % 16 === 0) {
      const low =
        (z > 50000 && z < 115000) || (z > 175000 && z < 315000);
      treeShadow(ctx, p, edge, v.clip);
      if (low) {
        nature(
          ctx,
          assets.natureAtlas,
          v.i % 48 === 0 ? 0 : 1,
          p.x + p.w * (edge + 0.38),
          p.y,
          p.w * 0.65,
          v.clip
        );
        if (v.i % 48 === 0) {
          nature(
            ctx,
            assets.natureAtlas,
            1,
            p.x - p.w * (edge + 0.4),
            p.y,
            p.w * 0.48,
            v.clip
          );
        }
      } else {
        sprite(
          ctx,
          assets.carAtlas,
          3,
          p.x + p.w * (edge + 0.33),
          p.y,
          p.w * 0.52,
          v.clip
        );
        if (v.i % 48 === 0) {
          sprite(
            ctx,
            assets.carAtlas,
            3,
            p.x - p.w * (edge + 0.45),
            p.y,
            p.w * 0.48,
            v.clip
          );
        }
      }
    }

    if (
      ((z > 35000 && z < 115000) || (z > 265000 && z < 335000)) &&
      v.i % 29 === 0
    ) {
      nature(
        ctx,
        assets.natureAtlas,
        2,
        p.x - p.w * (2.25 + (v.i % 3) * 0.25),
        p.y + Math.sin(s.elapsed * 2 + v.i) * p.w * 0.005,
        p.w * 0.27,
        v.clip
      );
    }

    if (v.i >= 0 && v.i < 85 && v.i % 12 === 0) {
      drawCrowd(ctx, assets.crowdAtlas, p, v.clip);
    }
    if (v.i === 5) {
      startGate(ctx, p, v.clip);
    }
    if (v.i === Math.floor(Drive.END / 200)) {
      finishGate(ctx, p, v.clip);
    }
    if (stage < 2 && v.i > 0 && v.i % 125 === 45) {
      drawShop(ctx, assets.shopsAtlas, Math.floor(v.i / 125) % 2, p, edge, v.clip);
    }

    if (v.i % 55 === 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, v.clip);
      ctx.clip();
      const x = p.x + p.w * (edge + 0.13);
      const size = p.w * 0.15;
      const y = p.y;
      ctx.fillStyle = '#eae6d8';
      ctx.fillRect(x, y - size * 2, size * 0.08, size * 2);
      ctx.fillStyle = '#186a85';
      ctx.fillRect(x - size * 0.6, y - size * 2.1, size * 1.3, size * 0.75);
      drawText(
        ctx,
        Drive.curve(z) > 0 ? '›' : '‹',
        x + size * 0.05,
        y - size * 1.49,
        size * 0.8,
        '#ffed9d',
        'center'
      );
      ctx.restore();
    }

    for (const t of trafficBySegment.get(v.i) || []) {
      const f = t.z / 200 - v.i;
      const x = Drive.mix(p.x, v.q.x, f);
      const w = Drive.mix(p.w, v.q.w, f);
      const y = Drive.mix(p.y, v.q.y, f);
      sprite(
        ctx,
        assets.carAtlas,
        t.type,
        x + w * Drive.trafficX(t),
        y,
        w * (t.type === 5 ? 0.22 : 0.17),
        v.clip
      );
    }

    if (v.i === 560 || v.i === 1170) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, v.clip);
      ctx.clip();
      const y = p.y - p.w * 0.37;
      ctx.fillStyle = '#e7eeee';
      ctx.fillRect(p.x - p.w, p.y - p.w * 0.5, p.w * 0.025, p.w * 0.5);
      ctx.fillRect(p.x + p.w, p.y - p.w * 0.5, p.w * 0.025, p.w * 0.5);
      ctx.fillStyle = '#075d7b';
      ctx.fillRect(p.x - p.w, y - p.w * 0.18, p.w * 2, p.w * 0.2);
      drawText(
        ctx,
        v.i === 560 ? '← SEASIDE   HIGHLAND →' : 'MERGE / CHECKPOINT',
        p.x,
        y - p.w * 0.035,
        Math.max(3, p.w * 0.085),
        '#fff5d6',
        'center'
      );
      ctx.restore();
    }
  }

  // Draw Player Car & FX
  const x = W / 2 + s.x * 9;
  const y = 285 + (s.speed > 100 ? Math.sin(s.elapsed * 33) * 0.55 : 0);
  const turn = s.yaw;

  ctx.fillStyle = '#142b3d66';
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 80, 8, 0, 0, 7);
  ctx.fill();

  if (
    s.speed > 1500 &&
    ((s.smoke || 0) > 0 || (s.speed > 6800 && (Math.abs(turn) > 0.48 || s.offroad)))
  ) {
    for (let k = 0; k < 10; k++) {
      const f = (s.elapsed * 3 + k / 10) % 1;
      ctx.fillStyle = f > 0.55 ? '#edead677' : '#fff9debb';
      ctx.fillRect(
        x + (k % 2 ? 68 : -71) + turn * f * 12,
        y - 2 + f * 12,
        2 + f * 9,
        2 + f * 5
      );
    }
  }

  const crashAge = s.crash ? 2.8 - s.crash : 0;
  const flight = Math.min(1, crashAge / 1.7);
  const jump = s.crash ? Math.sin(flight * Math.PI) * 125 : 0;
  const throwX = s.crash
    ? Math.sin(flight * Math.PI * 0.5) * 65 * (s.crashSide || 1)
    : 0;

  ctx.save();
  ctx.translate(x + throwX, y - jump - (s.crash ? 70 : 0));
  ctx.rotate(s.crash ? flight * Math.PI : turn * 0.02);
  ctx.scale(1.5, 1.12);

  if (s.crash && assets.emptyAtlas) {
    drawAsset(ctx, assets.emptyAtlas, 553, 126, 427, 230, -56, -60, 112, 60);
  } else {
    if (s.hit > 0) ctx.globalAlpha = 0.82;
    sprite(
      ctx,
      assets.carAtlas,
      turn < -0.22 ? 0 : turn > 0.22 ? 2 : 1,
      0,
      0,
      turn === 0 ? 112 : 117,
      null
    );
  }
  ctx.restore();

  if (s.crash) {
    for (let who = 0; who < 2; who++) {
      const side = who === 0 ? -1 : 1;
      const px = x + side * (28 + flight * 90);
      const py = 266 - Math.sin(flight * Math.PI) * (145 + who * 12);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(flight * Math.PI * 2 * side);
      drawActor(ctx, assets.endingAtlas, who === 0 ? 3 : 4, 0, 0, 54);
      ctx.restore();
    }
    if (crashAge >= 1.7) {
      drawText(ctx, '...!', x, 170, 17, '#fff18a', 'center');
    }
  }

  // Dynamic Weather Effects (Rain streaks, rolling fog mist, desert sand particles, lightning)
  globalWeatherEngine.render(ctx, s, W, H);

  // Authentic 1986 Arcade Cockpit HUD
  drawRetroTopHUD(ctx, s);

  // Speedometer Cluster (Bottom Left)
  drawSpeedometer(ctx, s);

  // Pixel-Art Stage Progress Mini-Map (Bottom Center)
  drawPixelMiniMap(ctx, s);

  // Course Radar & Route Map Cluster (Bottom Right)
  drawCourseRadar(ctx, s);

  if ((s.stageNotice || 0) > 0) {
    const stgIdx = Drive.stageIndex(s.z);
    const stg = Drive.STAGES[stgIdx];
    ctx.save();
    ctx.fillStyle = 'rgba(7, 26, 40, 0.88)';
    ctx.strokeStyle = stg?.accentColor || '#ffda85';
    ctx.lineWidth = 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(W / 2 - 130, 68, 260, 32, 4);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(W / 2 - 130, 68, 260, 32);
      ctx.strokeRect(W / 2 - 130, 68, 260, 32);
    }
    drawText(
      ctx,
      `STAGE ${stgIdx + 1} [${stg?.ko || ''}]  TIME +27`,
      W / 2,
      83,
      13,
      '#fff391',
      'center'
    );
    ctx.restore();
  }
  if (s.z > 96000 && s.z < 143000) {
    drawText(
      ctx,
      '← 해안 루트     산길 루트 →',
      W / 2,
      65,
      12,
      '#fff391',
      'center'
    );
  }
  if (s.z > 249000 && s.z < 270000) {
    drawText(ctx, 'CHECKPOINT +10', W / 2, 65, 14, '#fff391', 'center');
  }
  if (paused) {
    drawText(ctx, 'PAUSED', W / 2, 105, 18, '#fff291', 'center');
  } else if (demo) {
    drawText(ctx, 'DEMO DRIVE', W / 2, 38, 9, '#dfffee', 'center');
  }
}

export function renderEnding(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  assets: Assets,
  ending: number,
  onEndingComplete: () => void
): void {
  if (ending < 4) {
    s.z = Drive.END + ending * 6500;
    s.speed = Drive.MAX * (1 - ending * 0.09);
    s.x = Drive.mix(s.x, 0.5, 0.015);
    renderGame(ctx, s, assets, false, false);
    drawText(ctx, 'GOAL!  VICTORY LAP', 240, 65, 17, '#fff18a', 'center');
    return;
  }

  s.speed = 0;
  background(ctx, assets.skyImage, s);
  stageBackground(ctx, s);
  ctx.fillStyle = '#b5a3a0';
  ctx.fillRect(0, 183, W, 117);
  finishGate(ctx, { x: 240, y: 186, w: 180 }, H);
  drawText(ctx, 'FINISH!  ALL 6 STAGES CLEAR', 240, 29, 15, '#fff18a', 'center');

  const t = ending - 4;
  const park = Drive.smooth(t / 2.7);
  const carX = 240 + park * 55;
  const carY = 280 - park * 48;

  if (t < 3) {
    sprite(ctx, assets.carAtlas, t > 0.4 ? 0 : 1, carX, carY, 150, null);
    if (t > 2 && t < 2.7) {
      ctx.fillStyle = '#fff8dc99';
      ctx.fillRect(carX - 70, carY - 4, 18, 7);
      ctx.fillRect(carX + 50, carY - 4, 18, 7);
    }
  } else {
    const exit = Drive.smooth((t - 3) / 2.5);
    const boyX = carX - 25 - exit * 85;
    const girlX = carX + 25 + exit * 45;
    const feet = carY + 40;
    const bodyY = feet + (1 - exit) * 22;

    if (exit < 1) {
      drawActor(ctx, assets.endingAtlas, 0, boyX, bodyY, 100);
      drawActor(ctx, assets.endingAtlas, 1, girlX, bodyY, 100);
    }
    if (assets.emptyAtlas) {
      drawAsset(
        ctx,
        assets.emptyAtlas,
        23,
        126,
        480,
        231,
        carX - 75,
        carY - (150 * 231) / 480,
        150,
        (150 * 231) / 480
      );
    }
    ctx.save();
    ctx.beginPath();
    if (exit < 1) {
      ctx.rect(0, 0, carX - 72, H);
      ctx.rect(carX + 72, 0, W - carX - 72, H);
      ctx.clip();
    }
    drawActor(ctx, assets.endingAtlas, t > 12 ? 3 : 0, boyX, feet, 100);
    drawActor(
      ctx,
      assets.endingAtlas,
      t > 12 ? 4 : 1,
      girlX,
      feet - (t > 12 ? Math.abs(Math.sin(t * 5)) * 5 : 0),
      100
    );
    ctx.restore();
  }

  if (t > 5.5) {
    if (t < 12) {
      const approach = Drive.smooth((t - 5.5) / 6.5);
      const px = 185 + approach * 130;
      const py = 204 + approach * 73;
      const h = 58 + approach * 50;
      drawOfficial(
        ctx,
        assets.walkAtlas,
        Math.floor((t - 5.5) * 7) % 4,
        px,
        py,
        h
      );
    } else {
      drawActor(ctx, assets.endingAtlas, 2, 315, 277, 108);
      drawActor(ctx, assets.endingAtlas, 5, 365, 163, 38);
    }
  }

  if (t > 7 && t < 11) {
    drawText(ctx, 'FOR ME?', 185, 151, 11, '#fff', 'center');
  }

  if (t > 12) {
    drawText(ctx, 'THE REAL CHAMPION!', 365, 124, 12, '#ffe96a', 'center');
    drawText(ctx, '...HEY!', 180, 151, 12, '#fff', 'center');
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['#ffd56b', '#ff6985', '#7af4df'][i % 3];
      ctx.fillRect((i * 73) % W, 60 + ((i * 31 + t * 23) % 195), 3, 4);
    }
  }

  if (t >= 18) {
    drawText(ctx, 'THANK YOU FOR PLAYING', 240, 293, 12, '#fff', 'center');
    onEndingComplete();
  }
}
