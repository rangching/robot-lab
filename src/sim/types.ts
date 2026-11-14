export type CompType = 'led' | 'resistor' | 'button' | 'pot' | 'buzzer' | 'servo' | 'hcsr04' | 'psu';

export interface Comp {
  id: string;
  type: CompType;
  x: number;
  z: number;
  props: { color?: string; ohms?: number };
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
