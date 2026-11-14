import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

const mk = (d: React.ReactNode) => ({ size, ...p }: P) => <svg {...base(size)} {...p}>{d}</svg>;

export const IconPlay = mk(<path d="M7 4v16l13-8z" fill="currentColor" stroke="none" />);
export const IconPause = mk(<><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>);
export const IconStop = mk(<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" />);
export const IconLock = mk(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconFlame = mk(<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 .5 2 2 2.5 2 2.5S10 7 12 3z" fill="currentColor" stroke="none" />);
export const IconRotate = mk(<><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></>);
export const IconTag = mk(<><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>);
export const IconX = mk(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IconCheck = mk(<path d="m5 12 5 5L20 7" />);
export const IconMusic = mk(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>);
export const IconVolume = mk(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>);
export const IconMute = mk(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>);
export const IconBulb = mk(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></>);
export const IconSkip = mk(<><path d="m5 4 10 8-10 8z" /><path d="M19 5v14" /></>);
export const IconChevron = mk(<path d="m9 18 6-6-6-6" />);
export const IconChevronDown = mk(<path d="m6 9 6 6 6-6" />);
export const IconCpu = mk(<><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></>);
export const IconWrench = mk(<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />);
export const IconTrash = mk(<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></>);
export const IconReset = mk(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /></>);
export const IconCopy = mk(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>);
export const IconMax = mk(<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>);
export const IconBolt = mk(<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none" />);

/** 徽章圖示：六角形底＋符號 */
export function BadgeGlyph({ glyph, color, size = 46 }: { glyph: string; color: string; size?: number }) {
  const sym: Record<string, React.ReactNode> = {
    bulb: <path d="M21 31h6M22 35h4M24 13a8 8 0 0 0-5 14v2h10v-2a8 8 0 0 0-5-14z" />,
    ohm: <path d="M16 34h5v-3a9 9 0 1 1 6 0v3h5" />,
    button: <><rect x="15" y="15" width="18" height="18" rx="3" /><circle cx="24" cy="24" r="4.5" /></>,
    knob: <><circle cx="24" cy="25" r="9" /><path d="M24 25l5-6" /></>,
    ground: <path d="M24 12v12M15 24h18M18 29h12M21 34h6" />,
    wave: <path d="M14 30a14 14 0 0 1 20 0M17 26a9 9 0 0 1 14 0M20.5 22a4 4 0 0 1 7 0" />,
    shield: <><path d="M24 12l10 4v7c0 6-4 10-10 13-6-3-10-7-10-13v-7z" /><path d="m20 24 3 3 6-6" /></>,
    eye: <><path d="M12 24s4-8 12-8 12 8 12 8-4 8-12 8-12-8-12-8z" /><circle cx="24" cy="24" r="3.5" /></>,
    iron: <path d="M14 34l8-8M22 26l9-9 3 3-9 9zM31 17l3-3" />,
    book: <path d="M14 15h8a3 3 0 0 1 3 3v16a3 3 0 0 0-3-3h-8zM34 15h-8a3 3 0 0 0-3 3" />,
    spark: <path d="M24 12v6M24 30v6M12 24h6M30 24h6M16 16l4 4M28 28l4 4M32 16l-4 4M20 28l-4 4" />,
    flame: <path d="M24 12c1.5 5 7 7 7 13a7 7 0 0 1-14 0c0-3.5 2-5 3-7 .7 2.6 2.8 3.4 2.8 3.4S21 17 24 12z" />,
    crown: <path d="M14 32h20M15 30l-2-13 6 5 5-8 5 8 6-5-2 13z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M24 3l18 10.5v21L24 45 6 34.5v-21z" fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1.6} />
      <g fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{sym[glyph]}</g>
    </svg>
  );
}
