export type CompType = 'led' | 'resistor' | 'button' | 'pot' | 'buzzer' | 'servo' | 'hcsr04' | 'psu' | 'prop' | 'lipo';

export interface Comp {
  id: string;
  type: CompType;
  x: number;
  z: number;
  /** dir：螺旋槳的轉向（cw 順時針槳、ccw 逆時針槳） */
  props: { color?: string; ohms?: number; dir?: 'cw' | 'ccw' };
}

/** 端點格式：'mcu:D9'（開發板）、'c3:A'（元件） */
export type Endpoint = string;

export interface Wire {
  id: string;
  a: Endpoint;
  b: Endpoint;
  color: string;
}

export interface Issue {
  level: 'error' | 'warn';
  code: string;
  text: string;
  endpoints: Endpoint[];
}

export const ep = (owner: string, pin: string): Endpoint => `${owner}:${pin}`;
export const splitEp = (e: Endpoint) => {
  const i = e.indexOf(':');
  return [e.slice(0, i), e.slice(i + 1)] as const;
};
