import type { ViewName } from '../app/params';
import type { Expression } from '../character/types';

/**
 * Hand-drawn doodle icons in the reference sheet's style: thin round-capped ink strokes
 * (`currentColor`, so they invert on active buttons), soft pink blush, light-blue tears.
 */

const BLUSH = '#f4aeb6';
const TEAR = '#8fb8e6';

function svg(viewBox: string, body: string, className: string): string {
  return `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const heart = (className = 'heart'): string =>
  svg('0 0 16 16', '<path d="M8 13.2C3.6 10.3 2 8 2 5.9 2 4.2 3.3 3 4.8 3 6.2 3 7.3 3.8 8 5c.7-1.2 1.8-2 3.2-2C12.7 3 14 4.2 14 5.9c0 2.1-1.6 4.4-6 7.3Z"/>', className);

// ---------------------------------------------------------------- expression faces

const HEAD = '<circle cx="17" cy="19.5" r="11.5"/><path d="M16.4 8.1c-.9-2.6.8-4.6 3.5-4.1"/>';
const cheeks = (opacity: number): string =>
  `<g fill="${BLUSH}" stroke="none" opacity="${opacity}"><ellipse cx="10.4" cy="24" rx="2.3" ry="1.3"/><ellipse cx="23.6" cy="24" rx="2.3" ry="1.3"/></g>`;
const dotEye = (cx: number): string => `<ellipse cx="${cx}" cy="20" rx="1.45" ry="1.85" fill="currentColor" stroke="none"/>`;
const arcUp = (x: number): string => `<path d="M${x - 2} 20.8q2-2.8 4 0"/>`;
const arcDown = (x: number): string => `<path d="M${x - 2} 19.6q2 2.4 4 0"/>`;
const L = 12.6;
const R = 21.4;

const FACES: Record<Expression, string> = {
  normal: `${cheeks(0.55)}${dotEye(L)}${dotEye(R)}<path d="M15.9 25.3h2.2"/>`,
  smile:
    `${cheeks(0.8)}${arcUp(L)}${arcUp(R)}<path d="M15.1 24.3q1.9 3 3.8 0Z" fill="currentColor"/>` +
    '<path d="M28.4 3.6v4.3M31.3 5c0-1.5 3.1-1.5 3.1 0 0 1.2-1.5 1.4-1.5 2.9" stroke-width="1.3"/>' +
    '<circle cx="28.4" cy="10.2" r=".75" fill="currentColor" stroke="none"/><circle cx="32.9" cy="10.2" r=".75" fill="currentColor" stroke="none"/>',
  wink:
    `${cheeks(0.7)}${dotEye(L)}${arcUp(R)}<path d="M15.6 24.6q1.4 1.5 2.8 0"/>` +
    '<path d="M31.4 3.4v6.4M31.4 3.4q2.2.5 2.6 2.6" stroke-width="1.3"/><ellipse cx="30" cy="10" rx="1.5" ry="1.1" fill="currentColor" stroke="none"/>',
  surprised:
    `${cheeks(0.45)}<circle cx="${L}" cy="19.8" r="2.3"/><circle cx="${R}" cy="19.8" r="2.3"/>` +
    `<circle cx="${L}" cy="19.8" r=".8" fill="currentColor" stroke="none"/><circle cx="${R}" cy="19.8" r=".8" fill="currentColor" stroke="none"/>` +
    '<circle cx="17" cy="25.5" r="1.3"/>' +
    '<path d="M30.6 3.4q2.3 3.1 2.3 4.6a2.3 2.3 0 0 1-4.6 0q0-1.5 2.3-4.6Z" stroke-width="1.3"/>',
  angry:
    `${cheeks(0.85)}<path d="M10.2 18.9h4.8M19 18.9h4.8"/>` +
    `<path d="M11.2 18.9a1.4 1.5 0 0 0 2.8 0M20 18.9a1.4 1.5 0 0 0 2.8 0" fill="currentColor"/>` +
    '<path d="M10.8 15.6l3.4 1.2M23.2 15.6l-3.4 1.2"/><path d="M15.5 25.9q1.5-1.6 3 0"/>' +
    '<path d="M28 3.6q.3 1.9 2 2.2M33.6 3.6q-.3 1.9-2 2.2M28 9.6q.3-1.9 2-2.2M33.6 9.6q-.3-1.9-2-2.2" stroke-width="1.3"/>',
  crying:
    `${cheeks(0.6)}${arcDown(L)}${arcDown(R)}` +
    `<path d="M${L - 0.3} 22.4q-.5 2.4.2 4.8M${R + 0.3} 22.4q.5 2.4-.2 4.8" stroke="${TEAR}" stroke-width="1.7"/>` +
    '<path d="M14.6 25.9q.8-1.1 1.6 0t1.6 0 1.6 0"/>' +
    `<path d="M31 3.6q1.9 2.5 1.9 3.8a1.9 1.9 0 0 1-3.8 0q0-1.3 1.9-3.8Z" stroke="${TEAR}" stroke-width="1.3"/>`,
  sleepy:
    `${cheeks(0.55)}${arcDown(L)}${arcDown(R)}<path d="M16 25.2q1 .9 2 0"/>` +
    '<path d="M26.2 9.4h2.2l-2.2 2.4h2.2M29.6 3.4h3.6l-3.6 3.8h3.6" stroke-width="1.3"/>',
  blush:
    `${cheeks(1)}<path d="M9.3 25l1.1-1.8M10.9 25.2l1.1-1.8M22.3 25l1.1-1.8M23.9 25.2l1.1-1.8" stroke="#e0808e" stroke-width=".9"/>` +
    '<path d="M11.2 18.5l2.7 1.5-2.7 1.5M22.8 18.5 20.1 20l2.7 1.5"/>' +
    '<path d="M14.8 25.6q.55-.8 1.1 0t1.1 0 1.1 0 1.1 0"/>' +
    `<path d="M31 9.6c-2.5-1.6-3.3-2.9-3.3-4 0-.9.7-1.6 1.6-1.6.8 0 1.4.4 1.7 1.1.3-.7.9-1.1 1.7-1.1.9 0 1.6.7 1.6 1.6 0 1.1-.8 2.4-3.3 4Z" fill="${BLUSH}" stroke-width="1.1"/>`,
};

export const faceIcon = (expr: Expression): string => svg('0 0 36 36', HEAD + FACES[expr], 'face-icon');

// ---------------------------------------------------------------- camera views

const VIEW_ICONS: Record<Exclude<ViewName, 'free'>, string> = {
  front:
    '<circle cx="12" cy="13" r="7.5"/><path d="M11.6 5.5c-.5-2 .8-3.4 2.9-3"/>' +
    '<circle cx="9.5" cy="14" r=".95" fill="currentColor" stroke="none"/><circle cx="14.5" cy="14" r=".95" fill="currentColor" stroke="none"/>',
  side:
    '<circle cx="12" cy="13" r="7.5"/><path d="M11.6 5.5c-.5-2 .8-3.4 2.9-3"/>' +
    '<circle cx="6.9" cy="14" r=".95" fill="currentColor" stroke="none"/><path d="M14.2 8.6q2.6 3.4 1.6 9"/>',
  back:
    '<circle cx="12" cy="13" r="7.5"/><path d="M11.6 5.5c-.5-2 .8-3.4 2.9-3"/>' +
    '<path d="M8.6 8q1 3.6.2 7.4M15.4 8q-1 3.6-.2 7.4M12 6v5.5"/><path d="M9.6 19.4l2.4-1.2 2.4 1.2v-2.4l-2.4 1.2-2.4-1.2Z" fill="currentColor" stroke-width="1"/>',
  threequarter:
    '<circle cx="12" cy="13" r="7.5"/><path d="M11.6 5.5c-.5-2 .8-3.4 2.9-3"/>' +
    '<circle cx="8.2" cy="14" r=".95" fill="currentColor" stroke="none"/><circle cx="12.9" cy="14" r=".95" fill="currentColor" stroke="none"/><path d="M16.6 9.6q1.4 3 .6 6.4"/>',
  face:
    '<path d="M3 7.5V3.5h4M17 3.5h4v4M21 16.5v4h-4M7 20.5H3v-4"/><circle cx="12" cy="12" r="5"/>' +
    '<circle cx="10.2" cy="12.6" r=".85" fill="currentColor" stroke="none"/><circle cx="13.8" cy="12.6" r=".85" fill="currentColor" stroke="none"/>',
};

export const viewIcon = (view: Exclude<ViewName, 'free'>): string => svg('0 0 24 24', VIEW_ICONS[view], 'view-icon');

// ---------------------------------------------------------------- tools & doodles

export const toolIcon = {
  turntable: svg(
    '0 0 24 24',
    '<ellipse cx="12" cy="16.5" rx="8.5" ry="3"/><path d="M12 13.5V5.2"/><circle cx="12" cy="4.6" r="1.6"/><path d="M18.6 9.2q2.6 1.2 2.6 2.8M20.2 9.1l-1.6.1.4 1.5"/>',
    'tool-icon',
  ),
  reset: svg('0 0 24 24', '<path d="M4.6 10.2A7.6 7.6 0 1 1 6 16.6"/><path d="M4.2 5.6v4.8H9"/>', 'tool-icon'),
  hide: svg(
    '0 0 24 24',
    '<path d="M3 12s3.3-6 9-6c2 0 3.7.7 5 1.7M21 12s-3.3 6-9 6c-2 0-3.7-.7-5-1.7"/><path d="M9.9 14.1a3 3 0 0 1 4.2-4.2M4 20 20 4"/>',
    'tool-icon',
  ),
  show: svg('0 0 24 24', '<path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/>', 'tool-icon'),
};

/** Cat-face doodle that sits beside the title (white chalk-like lines). */
export const catDoodle = svg(
  '0 0 64 56',
  '<path d="M9 30c-1-8 0-17 3-24 5 2 9 6 11 9 6-2 12-2 18 0 2-3 6-7 11-9 3 7 4 16 3 24 0 12-11 20-23 20S9 42 9 30Z" stroke-width="2.6"/>' +
    '<circle cx="23" cy="31" r="2.6" stroke-width="2.2"/><circle cx="41" cy="31" r="2.6" stroke-width="2.2"/>' +
    '<path d="M29.6 36.4l4.8 3.2M34.4 36.4l-4.8 3.2" stroke-width="2.2"/>' +
    '<path d="M3 31.5l7 .9M3.6 37.4l6.8-1.8M61 31.5l-7 .9M60.4 37.4l-6.8-1.8" stroke-width="1.8"/>' +
    '<path d="M15 12.5l2.6 4.2M49 12.5l-2.6 4.2" stroke-width="1.6"/>',
  'cat-doodle',
);

/** Sparkles + round glasses doodle trailing the title. */
export const sparkleDoodle = svg(
  '0 0 80 40',
  '<path d="M8 6v8M4 10h8M5.4 7.4l5.2 5.2M10.6 7.4l-5.2 5.2" stroke-width="1.4"/>' +
    '<path d="M14 25v5M11.5 27.5h5" stroke-width="1.4"/>' +
    '<circle cx="34" cy="23" r="7" stroke-width="2"/><circle cx="56" cy="23" r="7" stroke-width="2"/>' +
    '<path d="M41 22q4-2.6 8 0M27 21l-4-2.4M63 21l5-1.6M31 19.6q1.6-1.6 3.6-1.4M53 19.6q1.6-1.6 3.6-1.4" stroke-width="2"/>' +
    '<path d="M74 28v4M72 30h4" stroke-width="1.2"/>',
  'sparkle-doodle',
);

// ---------------------------------------------------------------- actions

export type ActionIconName = 'walk' | 'talk' | 'wave' | 'nod' | 'bow' | 'cheer' | 'shy';

const ACTION_ICONS: Record<ActionIconName, string> = {
  walk:
    '<path d="M7.6 4.2c1.9 0 2.9 2 2.6 4.6-.3 2.2-1.3 3.4-2.6 3.4S5.3 11 5 8.8C4.7 6.2 5.7 4.2 7.6 4.2Z"/><path d="M5.6 14.6h4"/>' +
    '<path d="M16.4 9.8c1.9 0 2.9 2 2.6 4.6-.3 2.2-1.3 3.4-2.6 3.4s-2.3-1.2-2.6-3.4c-.3-2.6.7-4.6 2.6-4.6Z"/><path d="M14.4 20.2h4"/>',
  talk:
    '<path d="M4 6.4C4 5 5 4 6.4 4h11.2C19 4 20 5 20 6.4v7.2c0 1.4-1 2.4-2.4 2.4H11l-4.4 3.6V16h-.2C5 16 4 15 4 13.6Z"/>' +
    '<path d="M8.4 10h.01M12 10h.01M15.6 10h.01" stroke-width="2.2"/>',
  wave:
    '<path d="M8.6 12.6V6.2a1.3 1.3 0 0 1 2.6 0v5M11.2 11V4.8a1.3 1.3 0 0 1 2.6 0V11M13.8 11V5.8a1.3 1.3 0 0 1 2.6 0v6.6"/>' +
    '<path d="M16.4 12.4c0-1.2.6-2.2 1.6-2.2s1.2.8 1.2 1.8c0 4.4-2.4 8-6.4 8-3.2 0-4.8-1.8-6.2-4.6l-1.6-3.2c-.4-.8 0-1.6.8-1.8.6-.2 1.2.1 1.6.7l1.2 1.8"/>' +
    '<path d="M3.4 5.4q.8-1.6 2.4-2.2M20.6 5.4q-.8-1.6-2.4-2.2" stroke-width="1.2"/>',
  nod:
    '<circle cx="12" cy="10" r="6"/><circle cx="9.8" cy="11.2" r=".8" fill="currentColor" stroke="none"/><circle cx="14.2" cy="11.2" r=".8" fill="currentColor" stroke="none"/>' +
    '<path d="M12 18.4v3.2M10.2 20l1.8 1.8 1.8-1.8"/>',
  bow:
    '<circle cx="15.6" cy="9.4" r="3.2"/><path d="M12.8 11.6 8 9.6c-1.2-.5-2.4.4-2.4 1.6v9.2M8.6 13.4V20.4M5.6 20.4h3"/>',
  cheer:
    '<circle cx="12" cy="8.4" r="3.2"/><path d="M12 11.6v5.2M12 13 7 7.4M12 13l5-5.6M12 16.8l-2.6 4M12 16.8l2.6 4"/>' +
    '<path d="M4 4.2v2.6M2.7 5.5h2.6M20 4.2v2.6M18.7 5.5h2.6" stroke-width="1.2"/>',
  shy:
    '<circle cx="12" cy="12.4" r="7.4"/><path d="M9.2 12.2q1-.8 2 0M12.8 12.2q1-.8 2 0M11 16q1 .7 2 0"/>' +
    `<g fill="${BLUSH}" stroke="none"><ellipse cx="7.8" cy="14.6" rx="1.6" ry=".9"/><ellipse cx="16.2" cy="14.6" rx="1.6" ry=".9"/></g>`,
};

export const actionIcon = (name: ActionIconName): string => svg('0 0 24 24', ACTION_ICONS[name], 'action-icon');
