export interface Stage {
  name: string;
  ko: string;
  subtitle?: string;
  accentColor?: string;
  secondaryColor?: string;
  ground: [string, string];
  sea?: boolean;
}

export interface TrafficCar {
  z: number;
  lane: number;
  speed: number;
  type: number;
  passed: boolean;
}

export interface RoadSpec {
  x: number;
  w: number;
  lanes: number;
}

export interface GameState {
  z: number;
  x: number;
  speed: number;
  time: number;
  elapsed: number;
  steer: number;
  yaw: number;
  hit: number;
  hits: number;
  score: number;
  route: string;
  checkpoint: number;
  over: boolean;
  won: boolean;
  traffic: TrafficCar[];
  crash?: number;
  crashSide?: number;
  skid?: number;
  smoke?: number;
  braking?: boolean;
  offroad?: boolean;
  stage?: number;
  stageNotice?: number;
  gear?: 'LOW' | 'HIGH';
}

export interface InputState {
  left?: boolean;
  right?: boolean;
  gas?: boolean;
  brake?: boolean;
  demo?: boolean;
  branch?: 'left' | 'right';
  gear?: 'LOW' | 'HIGH';
}

export interface ProjectedPoint {
  x: number;
  y: number;
  w: number;
}

export interface VisibleSegment {
  i: number;
  p: ProjectedPoint;
  q: ProjectedPoint;
  clip: number;
}
