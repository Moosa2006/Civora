import * as React from "react"
import "../../styles/doodle-crew-footer.css"

/**
 * Doodle Crew Footer — customized for CIVORA.
 * Civora's name is stamped across the footer in dry-brush ink, and a crew of
 * hand-drawn characters lives on the letters: one leans against the first
 * letter, one perches on top, one sits with legs dangling, and one peeks over
 * the edge while ink doodles drift gently around them.
 *
 * Scroll it into view and it plays out like a short storyboard: the ground line
 * draws itself, the letters stamp down one by one with a puff of ink, the crew
 * pops up, plops down or rises from behind their letters, the doodles start to
 * fall, and the civic tagline and action buttons rise in last.
 *
 * Every eye follows your pointer (and blinks), the lines boil like hand-drawn
 * animation, letters wobble when hovered, clicking any character makes it hop
 * and share a civic note, and doodles scatter from the pointer and pop on click.
 */

// #region crew
// Pure: wordmark layout, seats, gaze, the doodle drift and the storyboard timing.

/** A small deterministic hash -> [0, 1), so every render lays the scene out the same way. */
export const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/**
 * Lays the wordmark out from per-letter advances (in font units): the left edge
 * of each letter, with `tracking` (in em) added between letters, and the total
 * width. A non-finite or negative advance counts as zero so one bad glyph can't
 * throw the whole word off the page.
 */
export const layoutWord = (
  advances: number[],
  tracking: number,
  fontSize: number,
): { x: number[]; w: number[]; width: number } => {
  const x: number[] = []
  const w: number[] = []
  let at = 0
  const gap = (Number.isFinite(tracking) ? tracking : 0) * fontSize
  for (let i = 0; i < advances.length; i++) {
    const a = Number.isFinite(advances[i]) && advances[i] > 0 ? advances[i] : 0
    x.push(at)
    w.push(a)
    at += a + (i < advances.length - 1 ? gap : 0)
  }
  return { x, w, width: Math.max(0, at) }
}

export type Seat = "front" | "top" | "behind"

/**
 * Where a crew member stands, in wordmark units (baseline at y = 0, up is
 * negative). `front` stands on the ground in front of the letter, `top` sits on
 * the letter's top edge, `behind` rises from behind the letter so only its top
 * shows above the edge. `offset` slides it along the letter, in letter widths.
 */
export const seatPoint = (
  seat: Seat,
  letterX: number,
  letterW: number,
  cap: number,
  offset: number,
  scale: number,
): { x: number; y: number } => {
  const x = letterX + letterW * (0.5 + (Number.isFinite(offset) ? offset : 0))
  if (seat === "top") return { x, y: -cap }
  if (seat === "behind") return { x, y: -cap + 30 * scale }
  return { x, y: 0 }
}

/**
 * Where a pupil sits inside its eye: pointed at the target, never further than
 * `max` from the centre, and easing off as the target comes close so the eye
 * doesn't snap when the pointer sits right on the face.
 */
export const lookAt = (
  ex: number,
  ey: number,
  tx: number,
  ty: number,
  max: number,
  reach: number,
): { x: number; y: number } => {
  const dx = tx - ex
  const dy = ty - ey
  const d = Math.hypot(dx, dy)
  if (!Number.isFinite(d) || d < 1e-6 || max <= 0) return { x: 0, y: 0 }
  const k = (max * Math.min(1, d / Math.max(1e-6, reach))) / d
  return { x: dx * k, y: dy * k }
}

export type Floater = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  fall: number
  phase: number
  /** Seconds left in a pop; 0 means alive. */
  pop: number
}

/**
 * One step of a doodle's drift: it falls at its own speed and sways, the
 * pointer pushes it away within `radius`, it eases back to its drift when let
 * go, and it wraps round the box so the sky never empties. A popped doodle
 * waits out its timer and comes back in from the top. `rand` supplies the new
 * x on a wrap.
 */
export const stepFloater = (
  f: Floater,
  dt: number,
  t: number,
  w: number,
  h: number,
  px: number,
  py: number,
  radius: number,
  rand: () => number,
): Floater => {
  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05)
  const m = 40
  if (f.pop > 0) {
    f.pop -= step
    if (f.pop <= 0) {
      f.pop = 0
      f.x = rand() * w
      f.y = -m
      f.vx = 0
      f.vy = f.fall
    }
    return f
  }
  const sway = Math.sin(t * 0.7 + f.phase) * 14
  if (Number.isFinite(px) && Number.isFinite(py) && radius > 0) {
    const dx = f.x - px
    const dy = f.y - py
    const d = Math.hypot(dx, dy)
    if (d < radius && d > 0.01) {
      const k = (1 - d / radius) * (1 - d / radius) * 2400
      f.vx += (dx / d) * k * step
      f.vy += (dy / d) * k * step
      f.vr += (dx > 0 ? 1 : -1) * k * 0.004 * step
    }
  }
  const ease = Math.min(1, step * 2.4)
  f.vx += (sway - f.vx) * ease
  f.vy += (f.fall - f.vy) * ease
  f.vr += (Math.sin(f.phase * 3) * 18 - f.vr) * Math.min(1, step * 0.8)
  f.x += f.vx * step
  f.y += f.vy * step
  f.rot = (f.rot + f.vr * step) % 360
  if (f.y > h + m) {
    f.y = -m
    f.x = rand() * w
  } else if (f.y < -m * 3) {
    f.y = h + m
  }
  if (f.x < -m) f.x = w + m
  else if (f.x > w + m) f.x = -m
  return f
}

/**
 * The storyboard, in ms from the moment the footer comes into view: the ground
 * line draws, letters stamp left to right, the crew arrives once the word is
 * down, then the doodles, the line of copy word by word, and the buttons.
 */
export const timeline = (letters: number, crew: number, words: number, actions: number) => {
  const L = Math.max(0, Math.floor(letters) || 0)
  const C = Math.max(0, Math.floor(crew) || 0)
  const W = Math.max(0, Math.floor(words) || 0)
  const A = Math.max(0, Math.floor(actions) || 0)
  const letter = (i: number) => 160 + i * 80
  const crewStart = letter(Math.max(0, L - 1)) + 420
  const member = (j: number) => crewStart + j * 130
  const doodles = crewStart + Math.max(0, C - 1) * 130 * 0.5
  const copy = crewStart + 260
  const word = (k: number) => copy + k * 45
  const actionsStart = word(W) + 120
  const action = (k: number) => actionsStart + k * 110
  const total = Math.max(
    member(Math.max(0, C - 1)) + 720,
    action(Math.max(0, A - 1)) + 600,
    letter(Math.max(0, L - 1)) + 560,
  )
  return { ground: 60, letter, crewStart, member, doodles, word, action, total }
}

// #endregion

export type CrewKind = "yeti" | "kid" | "bird" | "cat" | "ghost" | "mushroom"
export type DoodleKind = "flame" | "sandwich" | "star" | "heart" | "bolt" | "sparkle" | "spiral" | "plane"
export type DoodleCrewPreset = "auto" | "paper" | "night" | "riso" | "sunny"

export interface CrewMember {
  kind: CrewKind
  /** Index of the wordmark letter it lives on. */
  letter: number
  /** `front` stands before the letter, `top` sits on it, `behind` peeks over it. Defaults per kind. */
  seat?: Seat
  /** Slides it along the letter, in letter widths. 0 is centred. */
  offset?: number
  /** Size relative to the letter. Defaults to 1. */
  scale?: number
  /** Faces the other way. */
  flip?: boolean
  /** Used in its accessible label. */
  name?: string
  /** What it says when clicked. */
  says?: string
}

export interface FooterLink {
  label: string
  href?: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface FooterAction {
  label: string
  href?: string
  icon?: DoodleKind
  variant?: "solid" | "outline"
  onClick?: () => void
}

export interface DoodleCrewFooterProps {
  /** The giant word. Short, upper case, 4-9 letters reads best. */
  wordmark?: string
  /** Brand name, top left. */
  brand?: string
  /** Optional brand emblem image URL; falls back to inline hand-drawn emblem when omitted. */
  logoSrc?: string
  /** One or two sentences under the brand. */
  blurb?: string
  /** The line under the wordmark. */
  tagline?: string
  columns?: FooterColumn[]
  /** The pill buttons under the tagline. */
  actions?: FooterAction[]
  /** Bottom bar, left. */
  copyright?: string
  legal?: FooterLink[]
  socials?: FooterLink[]
  /** Shows a back-to-top button in the bottom bar. Defaults to true. */
  backToTop?: boolean
  backToTopLabel?: string
  crew?: CrewMember[]
  /** Which doodles drift around the word. An empty list turns them off. */
  doodles?: DoodleKind[]
  /** How many doodles at a time. Defaults to 12. */
  doodleCount?: number
  /** `auto` follows Civora's Light and Dark design system tokens automatically. */
  preset?: DoodleCrewPreset
  palette?: { background?: string; ink?: string; accent?: string }
  /** Display face for the wordmark. Heavy grotesks stamp best. */
  fontFamily?: string
  /** Face for the tagline. */
  serifFamily?: string
  /** Letter spacing of the wordmark, in em. Defaults to -0.02. */
  tracking?: number
  /** Pointer, hover and click play. Defaults to true. */
  interactive?: boolean
  /** Minimum height, a definite length. The footer grows past it if its content needs to. */
  height?: string
  /** Client-side SPA route navigation handler for internal paths. */
  onNavigate?: (href: string) => void
  className?: string
}

const PRESETS: Record<Exclude<DoodleCrewPreset, "auto">, { background: string; ink: string; accent: string }> = {
  paper: { background: "#ffffff", ink: "#0b3d2e", accent: "#10b981" },
  night: { background: "#111827", ink: "#f9fafb", accent: "#34d399" },
  riso: { background: "#f0fdf4", ink: "#0b3d2e", accent: "#059669" },
  sunny: { background: "#fef3c7", ink: "#0b3d2e", accent: "#0b6640" },
}

const DEFAULT_CREW: CrewMember[] = [
  { kind: "yeti", letter: 0, seat: "front", offset: -0.32, name: "Bruno", says: "Spotted a civic issue? Report it in seconds!" },
  { kind: "bird", letter: 1, seat: "top", offset: 0.02, name: "Pip", says: "Keeping watch over every ward!" },
  { kind: "mushroom", letter: 2, seat: "front", offset: 0.1, scale: 0.95, name: "Morel", says: "Clean streets help every neighbourhood bloom." },
  { kind: "kid", letter: 3, seat: "top", offset: 0, name: "Juno", says: "Public progress, right in plain sight!" },
  { kind: "ghost", letter: 4, seat: "behind", offset: 0.02, name: "Boo", says: "Zero ghost works — every fix is verified!" },
  { kind: "cat", letter: 5, seat: "front", offset: 0.42, flip: true, name: "Patch", says: "Tracking every tender and SLA timeline." },
]

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Explore",
    links: [
      { label: "Home", href: "/" },
      { label: "Transparency", href: "/transparency" },
      { label: "Tenders", href: "/tenders" },
      { label: "About", href: "/#about" },
    ],
  },
  {
    title: "Citizen Services",
    links: [
      { label: "Report Issue", href: "/report" },
      { label: "Track Complaint", href: "/track" },
      { label: "Civic Map", href: "/map" },
      { label: "Civic Engagement", href: "/engagement" },
    ],
  },
  {
    title: "Accountability",
    links: [
      { label: "My Complaints", href: "/my-complaints" },
      { label: "SLA & Escalations", href: "/sla" },
      { label: "Platform Rules", href: "/rules" },
    ],
  },
  {
    title: "Portals",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "Field Operations", href: "/official/workspace" },
      { label: "Contractor Portal", href: "/contractor" },
    ],
  },
]

const DEFAULT_ACTIONS: FooterAction[] = [
  { label: "Report an Issue", href: "/report", icon: "bolt", variant: "solid" },
  { label: "Transparency", href: "/transparency", icon: "sparkle", variant: "outline" },
]

const DEFAULT_DOODLES: DoodleKind[] = ["star", "sparkle", "plane", "bolt", "heart", "spiral", "flame", "sandwich"]

const DEFAULT_LEGAL: FooterLink[] = [
  { label: "Platform Rules", href: "/rules" },
  { label: "Transparency", href: "/transparency" },
  { label: "About", href: "/#about" },
]

const DEFAULT_SOCIALS: FooterLink[] = [
  { label: "Civic Map", href: "/map" },
  { label: "Track Complaint", href: "/track" },
  { label: "Civic Engagement", href: "/engagement" },
  { label: "Tenders", href: "/tenders" },
]

const ACCENT = {
  flame: "#f59e0b",
  flameCore: "#fde68a",
  gold: "#fbbf24",
  heart: "#f43f5e",
  bread: "#f2c48d",
  crumb: "#fff1d6",
  leaf: "#10b981",
  beak: "#f59e0b",
  cap: "#ef4444",
  sparkle: "#6ee7b7",
}

// ---- the crew's drawings --------------------------------------------------------
// Each kind is drawn in its own units: base centre at (0, 0), up is negative,
// about 144 units to a letter's cap height. Eyes are listed separately so the
// renderer can aim and blink them.

type Eye = { x: number; y: number; r: number; pupil: number; max: number }
type Art = {
  /** Size against the letters, before the member's own scale. */
  k: number
  box: { l: number; r: number; t: number; b: number }
  eyes: Eye[]
  seat: Seat
  body: (hatch: string) => React.ReactNode
  front?: () => React.ReactNode
  idle?: string
}

const ART: { [k: string]: Art } = {
  yeti: {
    k: 1,
    box: { l: -72, r: 60, t: -140, b: 6 },
    seat: "front",
    eyes: [
      { x: -15, y: -86, r: 8, pupil: 3.6, max: 3.6 },
      { x: 13, y: -88, r: 8, pupil: 3.6, max: 3.6 },
    ],
    body: (hatch) => (
      <>
        <ellipse className="dcf-shadow" cx="0" cy="2" rx="54" ry="5" />
        <path d="M-40 -92 C-62 -92 -70 -76 -68 -56 L-66 -30 C-64 -18 -54 -16 -44 -20 Z" />
        <path d="M-40 -92 C-62 -92 -70 -76 -68 -56 L-66 -30 C-64 -18 -54 -16 -44 -20 Z" fill={hatch} stroke="none" />
        <path className="n" d="M-67 -64 C-58 -59 -50 -59 -43 -64" />
        <path d="M-30 -104 C-40 -112 -44 -124 -40 -138 C-32 -129 -22 -122 -13 -114 Z" />
        <path d="M18 -114 C26 -124 36 -130 47 -133 C45 -120 41 -110 32 -101 Z" />
        <path className="n" d="M-38 -124 L-28 -119 M39 -125 L33 -116" />
        <path d="M-44 -2 C-54 -28 -54 -66 -42 -90 C-32 -110 -14 -118 2 -118 C22 -118 40 -108 48 -88 C58 -64 58 -28 48 -2 C30 4 -26 4 -44 -2 Z" />
        <path d="M40 -96 C54 -66 54 -30 46 -4 C40 -2 34 -1 30 0 C40 -30 42 -64 33 -101 Z" fill={hatch} stroke="none" />
        <path className="n" d="M-7 -117 C-5 -126 1 -128 3 -120 C5 -127 11 -126 11 -116" />
        <path className="n thin" d="M-14 -24 l-3 4 M8 -40 l3 4 M14 -46 l3 3 M20 -30 l3 3" />
        <path className="n" d="M-48 -62 C-22 -50 10 -32 49 -26 M-50 -52 C-24 -40 8 -22 49 -16" />
        <rect x="-12" y="-46" width="15" height="13" rx="2.5" transform="rotate(26 -4.5 -39.5)" />
        <path d="M-46 -60 C-62 -50 -63 -29 -51 -19 C-45 -15 -38 -19 -40 -28 C-43 -36 -40 -46 -36 -52" />
        <path d="M46 -58 C61 -46 61 -26 51 -18 C45 -14 38 -18 40 -26 C43 -34 41 -44 37 -50" />
        <path d="M-37 -2 C-41 -14 -23 -19 -16 -7 C-14 0 -26 4 -37 -2 Z" />
        <path d="M37 -2 C41 -14 23 -19 16 -7 C14 0 26 4 37 -2 Z" />
        <path className="n thin" d="M-30 -4 l1 -4 M-24 -3 l1 -4 M30 -4 l-1 -4 M24 -3 l-1 -4" />
        <path className="n" d="M-23 -98 L-9 -96 M6 -98 L20 -100" />
        <path className="n" d="M-12 -70 C-6 -64 6 -64 12 -71" />
        <path d="M3 -66.5 L5.5 -60 L8 -67.5 Z" />
      </>
    ),
  },
  kid: {
    k: 1.28,
    box: { l: -30, r: 30, t: -88, b: 42 },
    seat: "top",
    eyes: [
      { x: -6, y: -58, r: 0, pupil: 2.5, max: 1.8 },
      { x: 6.5, y: -58, r: 0, pupil: 2.5, max: 1.8 },
    ],
    body: (hatch) => (
      <>
        <path d="M-15 -6 L-3 -6 C-3 8 -5 20 -6 30 L-15 30 C-15 18 -16 6 -15 -6 Z" />
        <path d="M3 -6 L15 -6 C17 6 19 16 22 27 L12 30 C10 18 6 6 3 -6 Z" />
        <path d="M3 -6 L15 -6 C17 6 19 16 22 27 L12 30 C10 18 6 6 3 -6 Z" fill={hatch} stroke="none" />
        <path className="k" d="M-17 30 C-20 34 -20 40 -14 41 L-2 41 C2 40 0 34 -5 30 Z" />
        <path className="k" d="M11 29 C8 34 10 40 16 40 L26 38 C29 36 27 30 22 27 Z" />
        <path d="M-20 -4 C-22 -20 -18 -38 -10 -44 L10 -44 C18 -38 22 -20 20 -4 Z" />
        <path className="n thick" d="M-19.5 -14 L19.5 -14 M-18.5 -26 L18.5 -26 M-14 -36 L14 -36" />
        <path className="n" d="M-18 -36 C-28 -28 -30 -14 -26 -5" />
        <circle cx="-26" cy="-3" r="4" />
        <path className="n" d="M18 -36 C27 -30 30 -18 28 -7" />
        <circle cx="28" cy="-4" r="4" />
        <circle cx="-17" cy="-58" r="4" />
        <circle cx="17" cy="-58" r="4" />
        <circle cx="0" cy="-60" r="17" />
        <path className="n thin" d="M-11 -52 l2 -2 M-8 -52 l2 -2 M8 -52 l2 -2 M11 -52 l2 -2" />
        <path className="n" d="M-5 -50 C-2 -47 2 -47 5 -50" />
        <path d="M-15 -70 C-14 -87 14 -87 15 -70 Z" />
        <path d="M-27 -68 C-16 -75 16 -75 27 -68 C18 -63 -18 -63 -27 -68 Z" />
        <path className="n thick" d="M-14.5 -74 C-6 -77 6 -77 14.5 -74" />
      </>
    ),
  },
  bird: {
    k: 1.22,
    box: { l: -34, r: 30, t: -62, b: 2 },
    seat: "top",
    eyes: [
      { x: 3, y: -30, r: 4.6, pupil: 2.3, max: 2 },
      { x: 12, y: -31, r: 4.6, pupil: 2.3, max: 2 },
    ],
    idle: "dcf-peck",
    body: (hatch) => (
      <>
        <path className="n" d="M-5 0 L-5 -7 M-9 0 L-1 0 M5 0 L5 -7 M1 0 L9 0" />
        <path d="M-17 -16 C-26 -18 -31 -14 -33 -9 C-26 -10 -20 -8 -15 -10 Z" />
        <path d="M-18 -14 C-20 -30 -10 -40 2 -40 C16 -40 22 -28 20 -16 C18 -6 8 -4 0 -4 C-10 -4 -17 -8 -18 -14 Z" />
        <path d="M-11 -25 C-3 -26 1 -18 -3 -13 C-9 -12 -15 -17 -11 -25 Z" fill={hatch} />
        <path className="o" d="M19 -30 L29 -27 L19 -23 Z" />
        <path className="a" d="M-3 -38 L4 -59 L12 -37 Z" />
        <path className="n thin" d="M-1 -44 L10 -46 M1 -51 L8 -52" />
        <circle cx="4" cy="-60" r="2.8" />
      </>
    ),
  },
  cat: {
    k: 1.06,
    box: { l: -30, r: 52, t: -110, b: 4 },
    seat: "front",
    eyes: [{ x: 10, y: -76, r: 6, pupil: 2.8, max: 2.6 }],
    body: (hatch) => (
      <>
        <ellipse className="dcf-shadow" cx="4" cy="2" rx="32" ry="4" />
        <g className="dcf-tail">
          <path d="M18 -4 C42 -4 52 -24 46 -44 C44 -51 36 -53 34 -46 C40 -30 34 -16 16 -14 Z" />
          <path className="n thin" d="M40 -16 l5 4 M45 -30 l6 1 M43 -42 l6 -3" />
        </g>
        <path d="M-22 0 C-28 -18 -24 -42 -14 -52 L14 -52 C24 -42 28 -18 22 0 C10 3 -10 3 -22 0 Z" />
        <path d="M14 -46 C24 -36 26 -16 22 0 C18 1 14 2 12 2 C16 -14 16 -32 10 -46 Z" fill={hatch} stroke="none" />
        <path className="n" d="M-8 -30 L-9 -1 M8 -30 L9 -1" />
        <path d="M-16 1 C-16 -5 -3 -5 -3 1 Z M3 1 C3 -5 16 -5 16 1 Z" />
        <path className="a" d="M-18 -55 C-6 -49 6 -49 18 -55 L17 -46 C6 -40 -6 -40 -17 -46 Z" />
        <path className="a" d="M9 -45 L18 -32 L6 -37 Z" />
        <path d="M-22 -86 L-25 -107 L-7 -96 Z" />
        <path d="M8 -96 L23 -108 L22 -86 Z" />
        <path className="n thin" d="M-20 -92 L-21 -101 M18 -101 L18 -92" />
        <path d="M-26 -70 C-28 -88 -16 -98 0 -98 C16 -98 28 -88 26 -70 C24 -56 12 -50 0 -50 C-12 -50 -24 -56 -26 -70 Z" />
        <path className="n thin" d="M-4 -97 L-3 -90 M3 -97 L3 -91" />
        <path className="n" d="M-26 -80 C-14 -83 4 -87 25 -93" />
        <ellipse className="k" cx="-10" cy="-76" rx="7.5" ry="6.5" />
        <path className="k" d="M-2.5 -68 L2.5 -68 L0 -64.5 Z" />
        <path className="n" d="M0 -64.5 C-1 -60.5 -5 -60.5 -6 -62.5 M0 -64.5 C1 -60.5 5 -60.5 6 -62.5" />
        <path className="n thin" d="M-15 -66 L-29 -68 M-15 -63 L-28 -59 M15 -66 L29 -68 M15 -63 L28 -59" />
      </>
    ),
  },
  ghost: {
    k: 1.3,
    box: { l: -26, r: 26, t: -70, b: 0 },
    seat: "behind",
    eyes: [
      { x: -8, y: -44, r: 6.5, pupil: 3.2, max: 3 },
      { x: 9, y: -44, r: 6.5, pupil: 3.2, max: 3 },
    ],
    idle: "dcf-bob",
    body: (hatch) => (
      <>
        <path d="M-23 -14 L-23 -40 C-23 -59 -12 -67 0 -67 C12 -67 23 -59 23 -40 L23 -14 C12 -10 -12 -10 -23 -14 Z" />
        <path d="M13 -61 C21 -54 23 -46 23 -36 L23 -15 L15 -13 L15 -36 C15 -46 15 -54 13 -61 Z" fill={hatch} stroke="none" />
        <path className="n thin" d="M-16 -56 C-12 -61 -6 -63 -2 -63" />
        <path className="k" d="M-5 -33 C-3 -27 4 -27 6 -33 Z" />
        <path className="n thin" d="M-17 -35 l3 -2 M-14 -34 l3 -2 M14 -35 l3 -2 M17 -34 l3 -2" />
      </>
    ),
    front: () => (
      <>
        <path d="M-25 -32 C-27 -38 -21 -42 -17 -38 C-15 -42 -10 -41 -10 -36 L-11 -30 C-15 -28 -22 -28 -25 -32 Z" />
        <path d="M25 -32 C27 -38 21 -42 17 -38 C15 -42 10 -41 10 -36 L11 -30 C15 -28 22 -28 25 -32 Z" />
      </>
    ),
  },
  mushroom: {
    k: 1.12,
    box: { l: -27, r: 27, t: -56, b: 4 },
    seat: "front",
    eyes: [
      { x: -4.5, y: -16, r: 0, pupil: 1.9, max: 1.3 },
      { x: 4.5, y: -16, r: 0, pupil: 1.9, max: 1.3 },
    ],
    idle: "dcf-sway",
    body: (hatch) => (
      <>
        <ellipse className="dcf-shadow" cx="0" cy="2" rx="18" ry="3" />
        <path className="n" d="M-10 -15 L-17 -9 M10 -15 L17 -11" />
        <path d="M-10 0 C-12 -10 -10 -22 -8 -28 L8 -28 C10 -22 12 -10 10 0 C4 2 -4 2 -10 0 Z" />
        <path d="M5 -27 C9 -20 11 -10 10 0 C8 1 6 1.5 4 1.5 C6 -8 6 -18 2 -27 Z" fill={hatch} stroke="none" />
        <path className="r" d="M-25 -28 C-27 -45 -12 -55 0 -55 C12 -55 27 -45 25 -28 C14 -23 -14 -23 -25 -28 Z" />
        <circle cx="-12" cy="-40" r="4.2" />
        <circle cx="6" cy="-46" r="3.4" />
        <circle cx="15" cy="-34" r="3" />
        <circle cx="-2" cy="-33" r="2.4" />
        <path className="n" d="M-2 -10 C-1 -8 1 -8 2 -10" />
      </>
    ),
  },
}

/** Each doodle in a 32-unit box centred on (0, 0). */
const Doodle = ({ kind }: { kind: DoodleKind }) => {
  switch (kind) {
    case "flame":
      return (
        <>
          <path fill={ACCENT.flame} d="M0 14 C-9 14 -12 6 -10 0 C-8 -5 -4 -6 -4 -12 C1 -9 3 -5 2 -1 C4 -3 5 -6 5 -8 C10 -3 11 4 8 9 C6 12 3 14 0 14 Z" />
          <path fill={ACCENT.flameCore} d="M0 11.5 C-4 11.5 -6 8 -5 5 C-4 2 -1 1 -1 -3 C2 -1 4 3 3 6 C4 5 5 4 5 3 C7 6 5 11.5 0 11.5 Z" />
        </>
      )
    case "sandwich":
      return (
        <>
          <path fill={ACCENT.bread} d="M-13 5 L13 5 L12.5 9.5 C4 11 -4 11 -12.5 9.5 Z" />
          <path fill={ACCENT.gold} d="M-12 2 L12 2 L11 5 L5 5 L3 9 L1 5 L-12 5 Z" />
          <path fill="none" stroke={ACCENT.leaf} strokeWidth="2.6" d="M-13 1 q2.2 2.4 4.4 0 q2.2 2.4 4.4 0 q2.2 2.4 4.4 0 q2.2 2.4 4.4 0 q2.2 2.4 4.4 0 q2.2 2.4 4.4 0" />
          <path fill={ACCENT.bread} d="M-13 -1 C-14 -8 -10 -11 -6 -10 C-3 -13.5 3 -13.5 6 -10 C10 -11 14 -8 13 -1 Z" />
          <path fill="none" strokeWidth="1.2" d="M-6 -6 l1.5 -1 M0 -8 l1.5 -1 M6 -6 l1.5 -1" />
        </>
      )
    case "star":
      return <path fill={ACCENT.gold} d="M0 -13 L3.6 -4.4 L13 -4 L5.8 2.2 L8.2 12 L0 6.6 L-8.2 12 L-5.8 2.2 L-13 -4 L-3.6 -4.4 Z" />
    case "heart":
      return <path fill={ACCENT.heart} d="M0 11 C-6 6 -13 1 -13 -5 C-13 -10 -8 -13 -4 -11 C-2 -10 -1 -8 0 -6 C1 -8 2 -10 4 -11 C8 -13 13 -10 13 -5 C13 1 6 6 0 11 Z" />
    case "bolt":
      return <path fill={ACCENT.gold} d="M3 -14 L-8 2 L-1 2 L-4 14 L8 -3 L1 -3 Z" />
    case "sparkle":
      return <path fill={ACCENT.sparkle} d="M0 -13 C1 -4 4 -1 13 0 C4 1 1 4 0 13 C-1 4 -4 1 -13 0 C-4 -1 -1 -4 0 -13 Z" />
    case "spiral":
      return <path fill="none" d="M0 0 C2 -2 4 0 3 3 C1 6 -4 5 -5 1 C-6 -4 -1 -8 4 -7 C9 -5 10 2 7 6" />
    case "plane":
      return (
        <>
          <path className="dcf-paperfill" d="M-13 -1 L13 -10 L4 12 L0 3 Z" />
          <path fill="none" d="M0 3 L13 -10 M0 3 L-2 9 L2 5" />
        </>
      )
  }
  return null
}

const DoodleIcon = ({ kind, size = 18 }: { kind: DoodleKind; size?: number }) => (
  <svg className="dcf-icon" viewBox="-16 -16 32 32" width={size} height={size} aria-hidden="true">
    <Doodle kind={kind} />
  </svg>
)

type Metrics = { advances: number[]; cap: number }

const FONT_SIZE = 200
const DEFAULT_FONT = '"Times New Roman", Times, serif'
const DEFAULT_SERIF = '"Times New Roman", Times, serif'

const estimate = (word: string): Metrics => ({
  advances: Array.from(word).map((c) => (c === " " ? 0.3 : /[IJ1]/.test(c) ? 0.42 : /[MW]/.test(c) ? 0.98 : 0.76) * FONT_SIZE),
  cap: 0.73 * FONT_SIZE,
})

const measure = (word: string, family: string): Metrics | null => {
  if (typeof document === "undefined") return null
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return null
  ctx.font = "900 " + FONT_SIZE + "px " + family
  const chars = Array.from(word)
  const advances: number[] = []
  let prev = 0
  for (let i = 0; i < chars.length; i++) {
    const wNow = ctx.measureText(chars.slice(0, i + 1).join("")).width
    advances.push(wNow - prev)
    prev = wNow
  }
  const m = ctx.measureText(word.replace(/\s/g, "") || "H")
  const cap = m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : 0.73 * FONT_SIZE
  return { advances, cap }
}

const useIso = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function isInternalHref(href?: string): href is string {
  return Boolean(href && href.startsWith("/"))
}

const FooterNavLink = ({
  link,
  className,
  onNavigate,
}: {
  link: FooterLink
  className?: string
  onNavigate?: (href: string) => void
}) => {
  if (!link.href) {
    return <span className={className}>{link.label}</span>
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      onNavigate &&
      isInternalHref(link.href) &&
      !e.defaultPrevented &&
      e.button === 0 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey
    ) {
      e.preventDefault()
      onNavigate(link.href)
    }
  }

  return (
    <a className={className} href={link.href} onClick={handleClick}>
      <span>{link.label}</span>
      <svg className="dcf-squiggle" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength={1} d="M1 5 C10 1 16 7 25 4 S40 1 50 4 S66 7 75 4 S90 1 99 4" />
      </svg>
    </a>
  )
}

export default function DoodleCrewFooter({
  wordmark = "CIVORA",
  brand = "Civora",
  logoSrc = "/civora_icon.jpeg",
  blurb = "Civora is a public civic reporting and accountability platform empowering citizens to report local issues, track municipal action, and verify resolutions transparently.",
  tagline = "The Voice of the People, The Will of the Nation.",
  columns = DEFAULT_COLUMNS,
  actions = DEFAULT_ACTIONS,
  copyright = "© 2026 Civora Public Service Platform. All rights reserved.",
  legal = DEFAULT_LEGAL,
  socials = DEFAULT_SOCIALS,
  backToTop = true,
  backToTopLabel = "Back to top",
  crew = DEFAULT_CREW,
  doodles = DEFAULT_DOODLES,
  doodleCount = 12,
  preset = "auto",
  palette,
  fontFamily = DEFAULT_FONT,
  serifFamily = DEFAULT_SERIF,
  tracking = -0.02,
  interactive = true,
  height = "720px",
  onNavigate,
  className,
}: DoodleCrewFooterProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const word = wordmark.toUpperCase()
  const chars = React.useMemo(() => Array.from(word), [word])
  const presetColors = preset === "auto" ? undefined : PRESETS[preset]

  const rootRef = React.useRef(null as HTMLElement | null)
  const svgRef = React.useRef(null as SVGSVGElement | null)
  const worldRef = React.useRef(null as HTMLDivElement | null)
  const crewLayerRefs = React.useRef([] as (SVGGElement | null)[])
  const eyeRefs = React.useRef([] as { blink: SVGGElement | null; pupil: SVGGElement | null }[][])
  const doodleRefs = React.useRef([] as (HTMLDivElement | null)[])

  const [metrics, setMetrics] = React.useState(() => estimate(word))
  const [play, setPlay] = React.useState(false)
  const [reduced, setReduced] = React.useState(false)
  const [talking, setTalking] = React.useState(-1)
  const [hopping, setHopping] = React.useState(-1)
  const talkTimer = React.useRef(0)

  // ---- measure the real face, again once late web fonts land ----
  useIso(() => {
    const run = () => {
      const m = measure(word, fontFamily)
      if (m) setMetrics(m)
    }
    run()
    const fonts = typeof document !== "undefined" ? document.fonts : undefined
    if (!fonts) return
    let alive = true
    fonts.ready.then(() => alive && run())
    fonts.addEventListener?.("loadingdone", run)
    return () => {
      alive = false
      fonts.removeEventListener?.("loadingdone", run)
    }
  }, [word, fontFamily])

  const layout = React.useMemo(() => layoutWord(metrics.advances, tracking, FONT_SIZE), [metrics, tracking])
  const cap = metrics.cap

  const placed = React.useMemo(
    () =>
      crew
        .map((m, i) => {
          const art = ART[m.kind]
          if (!art || !chars.length) return null
          const li = clamp(Math.floor(m.letter) || 0, 0, chars.length - 1)
          const scale = (cap / 144) * art.k * (m.scale ?? 1)
          const seat = m.seat || art.seat
          const p = seatPoint(seat, layout.x[li], layout.w[li], cap, m.offset ?? 0, scale)
          return { i, m, art, seat, scale, ...p, flip: m.flip ? -1 : 1 }
        })
        .filter(Boolean) as {
        i: number
        m: CrewMember
        art: Art
        seat: Seat
        scale: number
        x: number
        y: number
        flip: number
      }[],
    [crew, chars.length, layout, cap],
  )

  // The viewBox hugs the word, the crew and the ground.
  const view = React.useMemo(() => {
    let l = 0
    let r = layout.width
    let t = -cap
    let b = 30
    for (const p of placed) {
      const bx = p.flip > 0 ? [p.art.box.l, p.art.box.r] : [-p.art.box.r, -p.art.box.l]
      l = Math.min(l, p.x + bx[0] * p.scale)
      r = Math.max(r, p.x + bx[1] * p.scale)
      t = Math.min(t, p.y + p.art.box.t * p.scale)
      b = Math.max(b, p.y + p.art.box.b * p.scale)
    }
    const pad = 24
    return { x: l - pad, y: t - pad, w: r - l + pad * 2, h: b - t + pad * 2 }
  }, [layout, placed, cap])

  const words = tagline.split(/\s+/).filter(Boolean)
  const tl = timeline(chars.length, placed.length, words.length, actions.length)

  const ground = React.useMemo(() => {
    const x0 = view.x + 6
    const x1 = view.x + view.w - 6
    let d = "M" + x0.toFixed(1) + " 6"
    const n = 14
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n
      d +=
        " Q" +
        (x - (x1 - x0) / n / 2).toFixed(1) +
        " " +
        (6 + (hash(k * 3.1) - 0.5) * 5).toFixed(1) +
        " " +
        x.toFixed(1) +
        " " +
        (6 + (hash(k * 7.7) - 0.5) * 2).toFixed(1)
    }
    let tufts = ""
    for (let k = 0; k < 22; k++) {
      const x = x0 + 20 + hash(k * 11.3) * (x1 - x0 - 40)
      const s = 0.7 + hash(k * 5.9) * 0.6
      tufts +=
        "M" +
        x.toFixed(1) +
        " 6 l" +
        (2 * s).toFixed(1) +
        " " +
        (-9 * s).toFixed(1) +
        " M" +
        (x + 3 * s).toFixed(1) +
        " 6 l" +
        (1 * s).toFixed(1) +
        " " +
        (-12 * s).toFixed(1) +
        " M" +
        (x + 6 * s).toFixed(1) +
        " 6 l" +
        (-1 * s).toFixed(1) +
        " " +
        (-7 * s).toFixed(1) +
        " "
    }
    const pebbles = Array.from({ length: 9 }, (_, k) => ({
      x: x0 + 40 + hash(k * 17.1) * (x1 - x0 - 80),
      y: 14 + hash(k * 2.3) * 8,
      r: 2 + hash(k * 9.4) * 2.6,
    }))
    return { d, tufts, pebbles }
  }, [view])

  // ---- doodles ----
  const doodleList = React.useMemo(() => {
    const kinds = doodles.length ? doodles : []
    const n = kinds.length ? clamp(Math.floor(doodleCount) || 0, 0, 40) : 0
    return Array.from({ length: n }, (_, k) => ({
      kind: kinds[k % kinds.length],
      size: 22 + hash(k * 4.7) * 14,
      seed: k,
    }))
  }, [doodles, doodleCount])

  const sim = React.useRef({
    floaters: [] as Floater[],
    w: 0,
    h: 0,
    px: NaN,
    py: NaN,
    inside: false,
    visible: false,
    gaze: [] as { x: number; y: number; tx: number; ty: number; next: number; blinkAt: number; blink: number }[],
    seed: 1,
    start: 0,
  })

  const paintDoodles = React.useCallback(() => {
    const s = sim.current
    const k = clamp(s.w / 1100, 0.5, 1)
    for (let i = 0; i < s.floaters.length; i++) {
      const el = doodleRefs.current[i]
      const f = s.floaters[i]
      if (!el || !f) continue
      let sc = k
      let op = 1
      if (f.pop > 0) {
        const age = 1.4 - f.pop
        sc = k * (1 + Math.min(1, age / 0.3) * 0.7)
        op = Math.max(0, 1 - age / 0.3)
      }
      el.style.transform =
        "translate3d(" +
        f.x.toFixed(1) +
        "px," +
        f.y.toFixed(1) +
        "px,0) rotate(" +
        f.rot.toFixed(1) +
        "deg) scale(" +
        sc.toFixed(3) +
        ")"
      el.style.opacity = String(op)
    }
  }, [])

  // Lay the doodles out once the world has a size; keep them when it resizes.
  useIso(() => {
    const el = worldRef.current
    if (!el) return
    const s = sim.current
    const size = () => {
      const r = el.getBoundingClientRect()
      const ow = s.w
      const oh = s.h
      s.w = r.width
      s.h = r.height
      if (s.floaters.length !== doodleList.length || !ow) {
        s.floaters = doodleList.map((_, k) => ({
          x: (0.04 + 0.92 * ((k + hash(k * 9.1) * 0.8) / Math.max(1, doodleList.length))) * r.width,
          y: (0.02 + hash(k * 3.3) * 0.56) * r.height,
          vx: 0,
          vy: 0,
          rot: (hash(k * 1.7) - 0.5) * 50,
          vr: (hash(k * 6.1) - 0.5) * 30,
          fall: 9 + hash(k * 2.9) * 16,
          phase: hash(k * 8.3) * Math.PI * 2,
          pop: 0,
        }))
      } else if (ow && oh) {
        for (const f of s.floaters) {
          f.x *= r.width / ow
          f.y *= r.height / oh
        }
      }
      paintDoodles()
    }
    size()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(size)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doodleList, paintDoodles])

  // ---- reduced motion (OS + Civora in-app Accessibility setting) ----
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
    const syncReduced = () => {
      const appReduced = document.documentElement.dataset.reducedMotion === "true"
      setReduced(Boolean(mq?.matches || appReduced))
    }
    syncReduced()
    mq?.addEventListener?.("change", syncReduced)
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(syncReduced)
        : null
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduced-motion"] })
    return () => {
      mq?.removeEventListener?.("change", syncReduced)
      mo?.disconnect()
    }
  }, [])

  // ---- the storyboard starts when the footer comes into view; the loop sleeps off-screen ----
  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const s = sim.current
    if (typeof IntersectionObserver === "undefined") {
      s.visible = true
      setPlay(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          s.visible = e.isIntersecting
          if (e.isIntersecting && e.intersectionRatio > 0.12) setPlay(true)
        }
      },
      { threshold: [0, 0.12, 0.3] },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [])

  React.useEffect(() => {
    if (play && !sim.current.start) sim.current.start = performance.now()
  }, [play])

  // ---- the living loop: eyes, blinks, doodles, line boil ----
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const s = sim.current
    let raf = 0
    let last = performance.now()
    let boilAt = 0
    let boil = 0
    const rand = () => {
      s.seed = (s.seed * 16807) % 2147483647
      return s.seed / 2147483647
    }
    const svgPoint = (svg: SVGSVGElement, cx: number, cy: number) => {
      const m = svg.getScreenCTM()
      if (!m) return null
      const inv = m.inverse()
      return { x: inv.a * cx + inv.c * cy + inv.e, y: inv.b * cx + inv.d * cy + inv.f }
    }
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!s.visible || document.hidden) {
        last = now
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const svg = svgRef.current
      const world = worldRef.current

      // eyes
      let target = null as null | { x: number; y: number }
      if (svg && s.inside && interactive) target = svgPoint(svg, s.px, s.py)
      for (let c = 0; c < placed.length; c++) {
        const p = placed[c]
        const g = (s.gaze[c] ||= {
          x: 0,
          y: 0,
          tx: 0,
          ty: 0,
          next: 0,
          blinkAt: t + 1 + hash(c * 3.7) * 3,
          blink: 0,
        })
        if (!target && t > g.next) {
          const other = placed[(c + 1 + Math.floor(rand() * Math.max(1, placed.length - 1))) % placed.length]
          if (other && rand() < 0.45) {
            g.tx = other.x
            g.ty = other.y - 60 * other.scale
          } else {
            g.tx = p.x + (rand() - 0.5) * 900
            g.ty = p.y - 80 * p.scale + (rand() - 0.5) * 500
          }
          g.next = t + 1.4 + rand() * 2.6
        }
        if (t > g.blinkAt) {
          g.blink = 0.16
          g.blinkAt = t + 2.2 + rand() * 4
        }
        g.blink = Math.max(0, g.blink - dt)
        const lid = g.blink > 0 ? 0.12 + (Math.abs(g.blink - 0.08) / 0.08) * 0.88 : 1
        const eyes = eyeRefs.current[c] || []
        for (let e = 0; e < p.art.eyes.length; e++) {
          const eye = p.art.eyes[e]
          const ex = p.x + eye.x * p.scale * p.flip
          const ey = p.y + eye.y * p.scale
          const tx = target ? target.x : g.tx
          const ty = target ? target.y : g.ty
          const o = lookAt(ex, ey, tx, ty, eye.max, 220)
          const ref = eyes[e]
          if (!ref) continue
          const key = "_o" + e
          const prev = (g as unknown as { [k: string]: { x: number; y: number } })[key] || { x: 0, y: 0 }
          const ease = Math.min(1, dt * (target ? 14 : 6))
          const nx = prev.x + (o.x * p.flip - prev.x) * ease
          const ny = prev.y + (o.y - prev.y) * ease
          ;(g as unknown as { [k: string]: { x: number; y: number } })[key] = { x: nx, y: ny }
          if (ref.pupil) ref.pupil.setAttribute("transform", "translate(" + nx.toFixed(2) + " " + ny.toFixed(2) + ")")
          if (ref.blink) {
            ref.blink.setAttribute(
              "transform",
              "translate(0 " + (eye.y * (1 - lid)).toFixed(2) + ") scale(1 " + lid.toFixed(3) + ")",
            )
          }
        }
      }

      // doodles
      if (world && s.floaters.length) {
        const started = play && s.start ? now - s.start > tl.doodles || reduced : false
        if (started) {
          const r = world.getBoundingClientRect()
          const px = s.inside && interactive ? s.px - r.left : NaN
          const py = s.inside && interactive ? s.py - r.top : NaN
          if (!reduced) for (const f of s.floaters) stepFloater(f, dt, t, s.w, s.h, px, py, 110, rand)
          paintDoodles()
        }
      }

      // line boil: three hand-drawn takes swapped at 8 fps
      if (!reduced && now - boilAt > 125) {
        boilAt = now
        boil = (boil + 1) % 3
        const f = "url(#" + uid + "-boil" + boil + ")"
        for (const el of crewLayerRefs.current) if (el) el.setAttribute("filter", f)
      } else if (reduced) {
        for (const el of crewLayerRefs.current) if (el) el.removeAttribute("filter")
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [placed, play, reduced, interactive, uid, tl.doodles, paintDoodles])

  React.useEffect(() => () => window.clearTimeout(talkTimer.current), [])

  const onPointerMove = (e: React.PointerEvent) => {
    const s = sim.current
    s.px = e.clientX
    s.py = e.clientY
    s.inside = true
  }
  const onPointerLeave = () => {
    sim.current.inside = false
  }

  const poke = (c: number) => {
    if (!interactive) return
    setTalking(c)
    setHopping(-1)
    requestAnimationFrame(() => setHopping(c))
    window.clearTimeout(talkTimer.current)
    talkTimer.current = window.setTimeout(() => {
      setTalking(-1)
      setHopping(-1)
    }, 2600)
  }

  const popDoodle = (k: number) => {
    if (!interactive) return
    const f = sim.current.floaters[k]
    if (f && f.pop <= 0) {
      f.pop = 1.4
      paintDoodles()
    }
  }

  const toTop = () => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
  }

  const handleBrandClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onNavigate && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      onNavigate("/")
    }
  }

  const hatch = "url(#" + uid + "-hatch)"
  const customBg = palette?.background ?? presetColors?.background
  const customInk = palette?.ink ?? presetColors?.ink
  const customAccent = palette?.accent ?? presetColors?.accent

  const vars: Record<string, string | undefined> = {
    "--dcf-serif": serifFamily,
    "--dcf-display": fontFamily,
    minHeight: height,
  }
  if (customBg) vars["--dcf-bg"] = customBg
  if (customInk) vars["--dcf-ink"] = customInk
  if (customAccent) vars["--dcf-accent"] = customAccent

  const pct = (v: number, base: number, span: number) => (((v - base) / span) * 100).toFixed(3) + "%"

  const renderCrew = (p: (typeof placed)[number], part: "body" | "front") => (
    <g
      key={p.i + part}
      transform={
        "translate(" +
        p.x.toFixed(2) +
        " " +
        p.y.toFixed(2) +
        ") scale(" +
        (p.scale * p.flip).toFixed(4) +
        " " +
        p.scale.toFixed(4) +
        ")"
      }
    >
      <g className={"dcf-arrive dcf-arrive-" + p.seat} style={{ "--d": tl.member(p.i) + "ms" } as React.CSSProperties}>
        <g className={"dcf-hopper" + (hopping === p.i ? " is-hop" : "")}>
          <g className={"dcf-art" + (p.art.idle ? " " + p.art.idle : "")} style={{ "--i": p.i } as React.CSSProperties}>
            {part === "body" ? (
              <>
                {p.art.body(hatch)}
                {p.art.eyes.map((eye, e) => (
                  <g
                    key={e}
                    ref={(el) => {
                      ;(eyeRefs.current[p.i] ||= [])[e] = { ...(eyeRefs.current[p.i]?.[e] || { pupil: null }), blink: el }
                    }}
                  >
                    {eye.r > 0 && <circle cx={eye.x} cy={eye.y} r={eye.r} />}
                    <g
                      ref={(el) => {
                        ;(eyeRefs.current[p.i] ||= [])[e] = { ...(eyeRefs.current[p.i]?.[e] || { blink: null }), pupil: el }
                      }}
                    >
                      <circle className="k" cx={eye.x} cy={eye.y} r={eye.pupil} />
                      <circle
                        className="dcf-glint"
                        cx={eye.x + eye.pupil * 0.35}
                        cy={eye.y - eye.pupil * 0.4}
                        r={eye.pupil * 0.32}
                      />
                    </g>
                  </g>
                ))}
              </>
            ) : (
              p.art.front?.()
            )}
          </g>
        </g>
      </g>
    </g>
  )

  return (
    <footer
      ref={rootRef}
      className={"dcf" + (className ? " " + className : "")}
      data-play={play || reduced ? "1" : "0"}
      data-interactive={interactive ? "1" : "0"}
      style={vars as React.CSSProperties}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="dcf-top dcf-rise" style={{ "--d": "0ms" } as React.CSSProperties}>
        <a href="/" className="dcf-brand" onClick={handleBrandClick} aria-label={brand + " Home"}>
          <span className="dcf-logo" aria-hidden="true">
            {logoSrc ? (
              <img src={logoSrc} alt="" />
            ) : (
              <svg viewBox="-60 -150 120 120" width="30" height="30">
                <g className="dcf-art">
                  <path d="M-30 -104 C-40 -112 -44 -124 -40 -138 C-32 -129 -22 -122 -13 -114 Z" />
                  <path d="M18 -114 C26 -124 36 -130 47 -133 C45 -120 41 -110 32 -101 Z" />
                  <path d="M-44 -30 C-54 -56 -54 -70 -42 -90 C-32 -110 -14 -118 2 -118 C22 -118 40 -108 48 -88 C58 -68 56 -54 48 -30 Z" />
                  <circle className="k" cx="-15" cy="-84" r="5.5" />
                  <circle className="k" cx="13" cy="-86" r="5.5" />
                  <path className="n" d="M-12 -66 C-6 -60 6 -60 12 -67" />
                </g>
              </svg>
            )}
          </span>
          <span className="dcf-brandname">{brand}</span>
        </a>
        {blurb && <p className="dcf-blurb">{blurb}</p>}
        {columns.length > 0 && (
          <nav className="dcf-cols" aria-label="Footer">
            {columns.map((col) => (
              <div className="dcf-col" key={col.title}>
                <h3 className="dcf-coltitle">{col.title}</h3>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterNavLink link={l} className="dcf-link" onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </div>

      <div className="dcf-world" ref={worldRef}>
        <div className="dcf-stage">
          <h2 className="dcf-sr">{wordmark}</h2>
          <svg
            ref={svgRef}
            className="dcf-svg"
            viewBox={view.x.toFixed(1) + " " + view.y.toFixed(1) + " " + view.w.toFixed(1) + " " + view.h.toFixed(1)}
            aria-hidden="false"
            role="group"
            aria-label={wordmark + " — civic crew"}
          >
            <defs>
              <pattern id={uid + "-hatch"} width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
                <line x1="0" y1="0" x2="0" y2="4.6" style={{ stroke: "var(--dcf-active-ink)" }} strokeWidth="1.25" />
              </pattern>
              {[0, 1, 2].map((k) => (
                <filter key={k} id={uid + "-boil" + k} x="-10%" y="-10%" width="120%" height="120%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={k * 7 + 3} result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              ))}
              <filter id={uid + "-ink"} x="-4%" y="-6%" width="108%" height="112%">
                <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="edge" />
                <feDisplacementMap in="SourceGraphic" in2="edge" scale="5" xChannelSelector="R" yChannelSelector="G" result="rough" />
                <feTurbulence type="fractalNoise" baseFrequency="0.018 0.32" numOctaves="2" seed="4" result="streak" />
                <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 5.6" result="streakA" />
                <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="9" result="speck" />
                <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -24 7.0" result="speckA" />
                <feComposite in="streakA" in2="speckA" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="holes" />
                <feComposite in="rough" in2="holes" operator="out" />
              </filter>
            </defs>

            <g ref={(el) => void (crewLayerRefs.current[0] = el)}>
              <g className="dcf-ground">
                <path className="dcf-draw" pathLength={1} d={ground.d} style={{ "--d": tl.ground + "ms" } as React.CSSProperties} />
                <path className="dcf-tufts dcf-fade" d={ground.tufts} style={{ "--d": tl.ground + 500 + "ms" } as React.CSSProperties} />
                {ground.pebbles.map((pb, k) => (
                  <ellipse
                    key={k}
                    className="dcf-pebble dcf-fade"
                    cx={pb.x}
                    cy={pb.y}
                    rx={pb.r * 1.5}
                    ry={pb.r}
                    style={{ "--d": tl.ground + 600 + "ms" } as React.CSSProperties}
                  />
                ))}
              </g>
              {placed.filter((p) => p.seat === "behind").map((p) => renderCrew(p, "body"))}
            </g>

            {chars.map((c, i) =>
              c === " " ? null : (
                <g
                  key={i}
                  className="dcf-letter"
                  style={
                    {
                      "--d": tl.letter(i) + "ms",
                      "--r": ((hash(i * 2.3) - 0.5) * 9).toFixed(2) + "deg",
                    } as React.CSSProperties
                  }
                >
                  <g className="dcf-glyph">
                    <text x={layout.x[i]} y={0} fontSize={FONT_SIZE} fontWeight={900} style={{ fontFamily }} filter={"url(#" + uid + "-ink)"}>
                      {c}
                    </text>
                  </g>
                  <path
                    className="dcf-dust"
                    d={
                      "M" +
                      (layout.x[i] - 6) +
                      " -6 l-16 -6 M" +
                      (layout.x[i] - 4) +
                      " -16 l-12 -12 M" +
                      (layout.x[i] + layout.w[i] + 6) +
                      " -6 l16 -6 M" +
                      (layout.x[i] + layout.w[i] + 4) +
                      " -16 l12 -12"
                    }
                  />
                </g>
              ),
            )}

            <g ref={(el) => void (crewLayerRefs.current[1] = el)}>
              {placed.filter((p) => p.seat === "behind").map((p) => renderCrew(p, "front"))}
              {placed.filter((p) => p.seat !== "behind").map((p) => renderCrew(p, "body"))}
            </g>

            {interactive &&
              placed.map((p) => {
                const bx = p.flip > 0 ? [p.art.box.l, p.art.box.r] : [-p.art.box.r, -p.art.box.l]
                const top = p.art.box.t
                const bottom = p.seat === "behind" ? -30 : p.art.box.b
                return (
                  <rect
                    key={"hit" + p.i}
                    className="dcf-hit"
                    x={p.x + bx[0] * p.scale}
                    y={p.y + top * p.scale}
                    width={(bx[1] - bx[0]) * p.scale}
                    height={(bottom - top) * p.scale}
                    rx={12}
                    role="button"
                    tabIndex={0}
                    aria-label={(p.m.name || p.m.kind) + (p.m.says ? ": " + p.m.says : "")}
                    onClick={() => poke(p.i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        poke(p.i)
                      }
                    }}
                  />
                )
              })}
          </svg>

          <div className="dcf-bubbles" aria-live="polite">
            {placed.map((p) =>
              talking === p.i && p.m.says ? (
                <div
                  key={p.i}
                  className={
                    "dcf-bubble" +
                    (p.x > view.x + view.w * 0.72
                      ? " is-left"
                      : p.x < view.x + view.w * 0.28
                        ? " is-right"
                        : "")
                  }
                  style={{
                    left: pct(p.x, view.x, view.w),
                    top: pct(p.y + p.art.box.t * p.scale - 6, view.y, view.h),
                  }}
                >
                  {p.m.says}
                </div>
              ) : null,
            )}
          </div>
        </div>

        {doodleList.length > 0 && (
          <div className="dcf-doodles" aria-hidden="true">
            {doodleList.map((d, k) => (
              <div
                key={k}
                className="dcf-doodle"
                ref={(el) => void (doodleRefs.current[k] = el)}
                style={{ width: d.size, height: d.size, marginLeft: -d.size / 2, marginTop: -d.size / 2 }}
                onPointerDown={() => popDoodle(k)}
              >
                <span className="dcf-doodle-in" style={{ "--d": tl.doodles + k * 70 + "ms" } as React.CSSProperties}>
                  <svg viewBox="-16 -16 32 32" width={d.size} height={d.size}>
                    <Doodle kind={d.kind} />
                  </svg>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="dcf-cta">
          <p className="dcf-tagline">
            {words.map((w, k) => (
              <span key={k} className="dcf-word" style={{ "--d": tl.word(k) + "ms" } as React.CSSProperties}>
                {w}{" "}
              </span>
            ))}
          </p>
          {actions.length > 0 && (
            <div className="dcf-actions">
              {actions.map((a, k) => {
                const inner = (
                  <>
                    {a.icon && <DoodleIcon kind={a.icon} />}
                    <span>{a.label}</span>
                  </>
                )
                const cls = "dcf-btn dcf-pop " + (a.variant === "outline" ? "is-outline" : "is-solid")
                const st = { "--d": tl.action(k) + "ms" } as React.CSSProperties
                return a.href ? (
                  <a
                    key={a.label}
                    className={cls}
                    style={st}
                    href={a.href}
                    onClick={(e) => {
                      a.onClick?.()
                      if (
                        onNavigate &&
                        isInternalHref(a.href) &&
                        !e.defaultPrevented &&
                        e.button === 0 &&
                        !e.metaKey &&
                        !e.ctrlKey &&
                        !e.altKey &&
                        !e.shiftKey
                      ) {
                        e.preventDefault()
                        onNavigate(a.href)
                      }
                    }}
                  >
                    {inner}
                  </a>
                ) : (
                  <button key={a.label} type="button" className={cls} style={st} onClick={a.onClick}>
                    {inner}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="dcf-bar dcf-rise" style={{ "--d": "120ms" } as React.CSSProperties}>
        <p className="dcf-copy">{copyright}</p>
        {legal.length > 0 && (
          <ul className="dcf-inline">
            {legal.map((l) => (
              <li key={l.label}>
                <FooterNavLink link={l} className="dcf-link" onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        )}
        {socials.length > 0 && (
          <ul className="dcf-inline dcf-socials">
            {socials.map((l) => (
              <li key={l.label}>
                <FooterNavLink link={l} className="dcf-link" onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        )}
        {backToTop && (
          <button type="button" className="dcf-totop" onClick={toTop}>
            <span>{backToTopLabel}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 20 C11 14 12.5 9 12 4 M6 10 C8 8 10 6 12 4 C14 6 16 8 18.5 9.5" />
            </svg>
          </button>
        )}
      </div>
    </footer>
  )
}

