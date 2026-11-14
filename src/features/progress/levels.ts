export const LEVELS = [
  { min: 0, name: '實習生', en: 'INTERN' },
  { min: 150, name: '助理工程師', en: 'JUNIOR' },
  { min: 400, name: '韌體工程師', en: 'FIRMWARE' },
  { min: 750, name: '機器人工程師', en: 'ROBOTICS' },
  { min: 1150, name: '首席工程師', en: 'PRINCIPAL' },
];

export function levelOf(xp: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) index = i;
  const cur = LEVELS[index];
  const next = LEVELS[index + 1];
  const into = xp - cur.min;
  const span = next ? next.min - cur.min : 1;
  return {
    index,
    name: cur.name,
    en: cur.en,
    nextName: next?.name ?? null,
    into,
    span,
    pct: next ? Math.min(1, into / span) : 1,
    toNext: next ? next.min - xp : 0,
  };
}
