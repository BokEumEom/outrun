import { GameState, InputState, RoadSpec, Stage, TrafficCar } from './types';

export const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const mix = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const smooth = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

export const STAGE_LENGTH = 440000;
export const END = STAGE_LENGTH * 6;
export const MAX = 9500;
export const SEG = 200;

export const STAGES: Stage[] = [
  {
    name: 'PALM COAST',
    ko: '해안',
    subtitle: '에메랄드빛 해변과 야자수 도로',
    accentColor: '#38bdf8',
    secondaryColor: '#f59e0b',
    ground: ['#e9d7bc', '#ecdbc1'],
    sea: true,
  },
  {
    name: 'RIVIERA',
    ko: '리조트 거리',
    subtitle: '낭만적인 카페와 지중해풍 상점가',
    accentColor: '#06b6d4',
    secondaryColor: '#f43f5e',
    ground: ['#d7c6aa', '#dfcdb0'],
    sea: true,
  },
  {
    name: 'ALPINE RUN',
    ko: '고원',
    subtitle: '굽이치는 와인딩 산악 도로',
    accentColor: '#10b981',
    secondaryColor: '#facc15',
    ground: ['#719452', '#789c59'],
  },
  {
    name: 'RED CANYON',
    ko: '사막',
    subtitle: '끝없이 펼쳐진 붉은 협곡과 직선주로',
    accentColor: '#f97316',
    secondaryColor: '#ef4444',
    ground: ['#cd945d', '#dca16a'],
  },
  {
    name: 'ANCIENT ROAD',
    ko: '유적',
    subtitle: '신비로운 고대 유적과 역사적인 석조로',
    accentColor: '#84cc16',
    secondaryColor: '#d97706',
    ground: ['#a6aa75', '#b0b47d'],
  },
  {
    name: 'SUNSET BAY',
    ko: '석양의 만',
    subtitle: '황혼의 붉은 노을빛 바다와 최종 결승선',
    accentColor: '#ec4899',
    secondaryColor: '#f59e0b',
    ground: ['#b89b93', '#c1a49a'],
    sea: true,
  },
];

export function stageIndex(z: number): number {
  return clamp(Math.floor(z / STAGE_LENGTH), 0, 5);
}

export function curve(z: number): number {
  const local = ((z % STAGE_LENGTH) + STAGE_LENGTH) % STAGE_LENGTH;
  const bend = (a: number, b: number) =>
    smooth((local - a) / 10000) * (1 - smooth((local - b) / 10000));
  return (
    0.3 * Math.sin(z / 26500) * smooth(z / 32000) +
    0.15 * Math.sin(z / 58000) +
    2.3 * bend(285000, 312000) -
    2.2 * bend(353000, 378000)
  );
}

export function hill(z: number): number {
  return 3400 * Math.sin(z / 25000) + 1700 * Math.sin(z / 12000);
}

export function fork(z: number): number {
  return smooth((z - 120000) / 27000) * (1 - smooth((z - 218000) / 26000));
}

export function roads(z: number): RoadSpec[] {
  const f = fork(z);
  return f < 0.001
    ? [{ x: 0, w: 1, lanes: 6 }]
    : [
        { x: -0.5 - f * 0.65, w: 0.5, lanes: 3 },
        { x: 0.5 + f * 0.65, w: 0.5, lanes: 3 },
      ];
}

export function nearest(z: number, x: number): RoadSpec {
  return roads(z).reduce((a, b) => (Math.abs(x - b.x) < Math.abs(x - a.x) ? b : a));
}

export function trafficX(t: TrafficCar): number {
  const f = fork(t.z);
  const left = t.lane < 3;
  return (left ? -0.5 : 0.5) + (left ? -1 : 1) * f * 0.65 + ((t.lane % 3) - 1) / 3;
}

export function create(): GameState {
  return {
    z: 0,
    x: -0.17,
    speed: 0,
    time: 45,
    elapsed: 0,
    steer: 0,
    yaw: 0,
    hit: 0,
    hits: 0,
    score: 0,
    route: '',
    checkpoint: 0,
    over: false,
    won: false,
    traffic: Array.from({ length: 230 }, (_, i) => ({
      z: 11000 + i * 11200,
      lane: i % 6,
      speed: 3000 + (i % 4) * 420,
      type: i % 5 === 0 ? 5 : 4,
      passed: false,
    })),
  };
}

export function update(s: GameState, dt: number, input: InputState = {}): void {
  if (s.over) return;
  dt = clamp(dt, 0, 0.05);
  s.elapsed += dt;
  s.time -= dt;

  if (s.crash && s.crash > 0) {
    s.crash = Math.max(0, s.crash - dt);
    s.speed = 0;
    s.hit = 2;
    s.skid = 0;
    for (const t of s.traffic) {
      t.z += t.speed * dt * 1.8;
    }
    if (!s.crash) {
      s.x = nearest(s.z, s.x).x;
      s.speed = 1800;
    }
    if (s.time <= 0) {
      s.time = 0;
      s.over = true;
    }
    return;
  }

  s.hit = Math.max(0, s.hit - dt);
  const ratio = s.speed / MAX;
  const oldZ = s.z;
  let steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const c = curve(s.z);
  const pull = clamp(c * 0.95, -1.85, 1.85);
  let brake = !!input.brake;

  if (input.demo) {
    const upcoming = Math.max(Math.abs(c), Math.abs(curve(s.z + 12000)));
    brake = upcoming > 1.2 && ratio > 0.82;
    const targetRoad =
      roads(s.z + 3500).find((r) =>
        input.branch === 'right' ? r.x >= 0 : r.x <= 0
      ) || roads(s.z + 3500)[0];
    let target = targetRoad.x - 0.12;
    for (const t of [...s.traffic].sort((a, b) => a.z - b.z)) {
      const dz = t.z - s.z;
      if (dz > 0 && dz < 10000 && Math.abs(trafficX(t) - target) < 0.36) {
        target = targetRoad.x + (trafficX(t) > targetRoad.x ? -0.6 : 0.6) * targetRoad.w;
        break;
      }
    }
    steering = clamp((target - s.x) * 6 + (pull * ratio * ratio) / (0.24 + ratio * 1.15), -1, 1);
  }

  s.braking = brake;
  s.skid = clamp((Math.abs(c) * ratio * ratio - 0.65) * 1.2, 0, 1);
  if (brake && ratio > 0.6) s.skid = Math.max(s.skid, 0.55);
  s.smoke = (brake && s.speed > 1500) || s.skid > 0.15 ? 0.65 : Math.max(0, (s.smoke || 0) - dt);
  s.steer = steering;
  s.yaw = mix(s.yaw, steering, 1 - Math.exp(-dt * 8));
  s.speed = clamp(
    s.speed + (brake ? -13000 : input.gas || input.demo ? 3700 : -2500) * dt,
    0,
    MAX
  );
  s.x = clamp(
    s.x + steering * dt * 1.8 * (0.24 + ratio * 1.15) - pull * ratio * ratio * dt * 1.8,
    -2.7,
    2.7
  );

  const road = nearest(s.z, s.x);
  s.offroad = Math.abs(s.x - road.x) > road.w - 0.03;
  if (s.offroad && s.speed > 3300) {
    s.speed = Math.max(3300, s.speed - 6500 * dt);
  }
  s.z += s.speed * dt * 1.8;

  for (const t of s.traffic) {
    const before = t.z - oldZ;
    t.z += t.speed * dt * 1.8;
    const after = t.z - s.z;
    if (!s.hit && before > -240 && after < 260 && after > -300 && Math.abs(trafficX(t) - s.x) < 0.23) {
      s.crash = s.speed > MAX * 0.72 ? 2.8 : 0;
      s.crashSide = s.x > trafficX(t) ? 1 : -1;
      s.hit = s.crash ? 3 : 1;
      s.hits++;
      s.speed = Math.min(s.speed, 3800);
    }
    if (!t.passed && after < 0) {
      t.passed = true;
      s.score += 500;
    }
  }

  if (!s.route && s.z > 152000) {
    s.route = s.x < 0 ? 'SEASIDE' : 'HIGHLAND';
  }
  if (s.z > 250000 && !s.checkpoint) {
    s.checkpoint = 1;
    s.time += 10;
  }
  const stage = stageIndex(s.z);
  if (stage > (s.stage || 0)) {
    s.time += 27;
    s.stage = stage;
    s.stageNotice = 3;
  }
  s.stageNotice = Math.max(0, (s.stageNotice || 0) - dt);
  s.score += s.speed * dt * 0.02;

  if (s.z >= END) {
    s.z = END;
    s.won = true;
    s.over = true;
  } else if (s.time <= 0) {
    s.time = 0;
    s.over = true;
  }
}
