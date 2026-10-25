/**
 * ============================================================================
 * InteractiveDotWave.ts (ParkJom 3D Transit Matrix Engine)
 *
 * Ultra-smooth 60/120fps ProMotion Canvas 2D 3D-Perspective Transit Matrix
 * for ParkJom. Transforms abstract dots into an interactive transit ecosystem
 * featuring:
 *   - 🅿️  Parking Bays (with dynamic availability status & slot numbers)
 *   - 🚆 LRT / MRT Transit Hubs (with authentic Rapid KL station beacons)
 *   - 🚗 Commuter Vehicles (with dynamic heading steering & photon headlights)
 *   - ✦  Transit Network Nodes (maintaining the fluid 3D wave fabric)
 *
 * Strictly monochromatic base theme + Apple System Blue (#0071E3 / #0A84FF).
 * ============================================================================
 */

export type TransitNodeType = 'node' | 'parking' | 'station' | 'car';

export interface DotWaveOptions {
  /** 3D Grid density in world units (default: 48 for clean Apple HIG spacing) */
  gap: number;
  /** Unscaled baseline radius of grid dots in CSS px (default: 1.2px) */
  baseRadius: number;
  /** Interaction radius around cursor in screen px (default: 180px) */
  interactionRadius: number;
  /** Maximum lateral pull distance toward cursor (default: 38px) */
  magneticPullXY: number;
  /** Distance objects surge forward in 3D (Z) toward camera when attracted (default: 55px) */
  magneticPullZ: number;
  /** Legacy alias */
  magneticPullStrength?: number;
  /** Apple-grade spring physics stiffness (default: 0.08) */
  stiffness: number;
  /** Apple-grade spring physics damping (default: 0.82) */
  damping: number;
  /** Speed of continuous idle 3D undulating wave (default: 0.0016) */
  waveSpeed: number;
  /** 3D depth (Z) wave amplitude (default: 22px) */
  waveAmplitudeZ: number;
  /** 3D vertical (Y) wave amplitude (default: 14px) */
  waveAmplitudeY: number;
  /** Legacy alias */
  waveAmplitude?: number;
  /** Wave spatial frequency X (default: 0.0055) */
  waveFrequencyX: number;
  /** Wave spatial frequency Y (default: 0.005) */
  waveFrequencyY: number;
  /** 3D perspective pitch tilt angle in degrees (default: 36°) */
  pitchAngleDeg: number;
  /** Camera focal length / FOV (default: 720) */
  fov: number;
  /** Camera distance Z (default: 620) */
  cameraZ: number;
  /** Max scale multiplier under cursor (default: 2.0x) */
  maxScale: number;
  /** Luminous Apple System Blue radial bloom under cursor (default: true) */
  glowEnabled: boolean;
  /** Speed of color lerp during theme toggle (default: 0.12) */
  themeTransitionSpeed: number;
  themeTargetElement?: HTMLElement | null;
}

export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface TransitNode3D {
  col: number;
  row: number;
  type: TransitNodeType;
  /** Rest 3D world coordinates */
  baseWorldX: number;
  baseWorldY: number;
  baseWorldZ: number;
  /** Dynamic 3D coordinates */
  x: number;
  y: number;
  z: number;
  /** 3D spring velocities */
  vx: number;
  vy: number;
  vz: number;
  /** Projected 2D screen coordinates */
  screenX: number;
  screenY: number;
  scale: number;
  radius: number;
  phase: number;
  depthRatio: number;

  // Transit domain properties
  label?: string;
  stationCode?: string;
  isAvailable?: boolean;
  heading: number;
  targetHeading: number;
  pulseTimer: number;
}

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
  strength: number;
  lastClickX: number;
  lastClickY: number;
  clickTime: number;
}

const AUTHENTIC_STATIONS = [
  { name: 'KL Sentral', code: 'KJ15' },
  { name: 'Bangsar LRT', code: 'KJ16' },
  { name: 'Kerinchi', code: 'KJ18' },
  { name: 'Asia Jaya', code: 'KJ21' },
  { name: 'Cheras LRT', code: 'SP12' },
  { name: 'Ampang Park', code: 'KJ9' },
  { name: 'Bukit Bintang', code: 'KG18' },
  { name: 'Pasar Seni', code: 'KJ14' },
  { name: 'Abdullah Hukum', code: 'KJ17' },
  { name: 'Subang Jaya', code: 'KJ28' },
  { name: 'Damai LRT', code: 'KJ8' },
  { name: 'Universiti', code: 'KJ19' },
];

export const DEFAULT_DOT_WAVE_OPTIONS: DotWaveOptions = {
  gap: 48,
  baseRadius: 1.2,
  interactionRadius: 180,
  magneticPullXY: 38,
  magneticPullZ: 55,
  stiffness: 0.08,
  damping: 0.82,
  waveSpeed: 0.0016,
  waveAmplitudeZ: 22,
  waveAmplitudeY: 14,
  waveFrequencyX: 0.0055,
  waveFrequencyY: 0.005,
  pitchAngleDeg: 36,
  fov: 720,
  cameraZ: 620,
  maxScale: 2.0,
  glowEnabled: true,
  themeTransitionSpeed: 0.12,
  themeTargetElement: null,
};

export function mergeDotWaveOptions(
  defaults: DotWaveOptions,
  overrides?: Partial<DotWaveOptions>
): DotWaveOptions {
  if (!overrides) return { ...defaults };
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof DotWaveOptions)[]) {
    const val = overrides[key];
    if (val !== undefined && val !== null) {
      (result as any)[key] = val;
    }
  }
  return result;
}

export function parseCssColor(raw: string | null | undefined, fallback: RGBAColor): RGBAColor {
  if (!raw) return { ...fallback };
  const trimmed = raw.trim();
  if (!trimmed) return { ...fallback };

  const tupleMatch = trimmed.match(/^(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})(?:[,\s/]+([\d.]+))?$/);
  if (tupleMatch) {
    return {
      r: Math.min(255, Math.max(0, parseInt(tupleMatch[1], 10))),
      g: Math.min(255, Math.max(0, parseInt(tupleMatch[2], 10))),
      b: Math.min(255, Math.max(0, parseInt(tupleMatch[3], 10))),
      a: tupleMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(tupleMatch[4]))) : fallback.a,
    };
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : fallback.a;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : fallback.a;
      return { r, g, b, a };
    }
  }

  const rgbaMatch = trimmed.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)/i);
  if (rgbaMatch) {
    return {
      r: Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10))),
      g: Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10))),
      b: Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10))),
      a: rgbaMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]))) : 1,
    };
  }

  return { ...fallback };
}

function lerpColor(c1: RGBAColor, c2: RGBAColor, t: number, out: RGBAColor): void {
  const safeT = Number.isNaN(t) ? 1 : Math.max(0, Math.min(1, t));
  out.r = c1.r + (c2.r - c1.r) * safeT;
  out.g = c1.g + (c2.g - c1.g) * safeT;
  out.b = c1.b + (c2.b - c1.b) * safeT;
  out.a = c1.a + (c2.a - c1.a) * safeT;
}

export class InteractiveDotWave {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: DotWaveOptions;

  private dots: TransitNode3D[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  private pointer: PointerState = {
    x: -9999,
    y: -9999,
    active: false,
    strength: 0,
    lastClickX: -9999,
    lastClickY: -9999,
    clickTime: 0,
  };

  // Pure Apple System Colors: Surface + Monochrome Base Dots + System Blue Accent
  private targetBgColor: RGBAColor = { r: 245, g: 245, b: 247, a: 1 };
  private currentBgColor: RGBAColor = { r: 245, g: 245, b: 247, a: 1 };

  private targetDotBaseColor: RGBAColor = { r: 0, g: 0, b: 0, a: 0.14 };
  private currentDotBaseColor: RGBAColor = { r: 0, g: 0, b: 0, a: 0.14 };

  // System Blue: Light #0071E3 (0, 113, 227) / Dark #0A84FF (10, 132, 255)
  private targetSystemBlue: RGBAColor = { r: 0, g: 113, b: 227, a: 0.95 };
  private currentSystemBlue: RGBAColor = { r: 0, g: 113, b: 227, a: 0.95 };

  private animFrameId: number | null = null;
  private lastTimestamp = 0;
  private resizeObserver: ResizeObserver | null = null;
  private themeMutationObserver: MutationObserver | null = null;
  private mediaQueryList: MediaQueryList | null = null;
  private isDestroyed = false;

  private scratchColor: RGBAColor = { r: 0, g: 0, b: 0, a: 1 };
  private hoveredNode: TransitNode3D | null = null;

  constructor(canvas: HTMLCanvasElement, options?: Partial<DotWaveOptions>) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('InteractiveDotWave: Unable to obtain 2D rendering context from canvas.');
    }
    this.ctx = context;
    this.options = mergeDotWaveOptions(DEFAULT_DOT_WAVE_OPTIONS, options);

    this.initEvents();
    this.syncThemeColors(true);
    this.resize();
    this.start();
  }

  public updateOptions(newOptions: Partial<DotWaveOptions>): void {
    const oldGap = this.options.gap;
    const oldTilt = this.options.pitchAngleDeg;
    this.options = mergeDotWaveOptions(this.options, newOptions);
    if (newOptions.gap !== undefined && (newOptions.gap !== oldGap || newOptions.pitchAngleDeg !== oldTilt)) {
      this.rebuild3DTransitGrid(false);
    }
    this.syncThemeColors(false);
  }

  public setPointerPosition(x: number | null, y: number | null): void {
    if (x === null || y === null) {
      this.pointer.active = false;
    } else {
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.active = true;
    }
  }

  public start(): void {
    if (this.animFrameId !== null) return;
    this.lastTimestamp = performance.now();
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stop();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.themeMutationObserver) {
      this.themeMutationObserver.disconnect();
      this.themeMutationObserver = null;
    }
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener('change', this.handleMediaChange);
      this.mediaQueryList = null;
    }

    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseleave', this.handleMouseLeave);
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener('touchstart', this.handleTouchMove, { capture: true });
    window.removeEventListener('touchmove', this.handleTouchMove, { capture: true });
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('touchcancel', this.handleTouchEnd);

    this.dots = [];
  }

  public refreshColors(immediate = false): void {
    this.syncThemeColors(immediate);
  }

  // --------------------------------------------------------------------------
  // Event Handlers & Theme Sync
  // --------------------------------------------------------------------------

  private initEvents(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(this.canvas.parentElement || document.body);
    } else {
      window.addEventListener('resize', () => this.resize(), { passive: true });
    }

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleMediaChange = this.handleMediaChange.bind(this);

    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', this.handleMouseLeave, { passive: true });
    window.addEventListener('click', this.handleClick, { passive: true });
    window.addEventListener('touchstart', this.handleTouchMove, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.handleTouchEnd, { passive: true });

    if (typeof MutationObserver !== 'undefined') {
      this.themeMutationObserver = new MutationObserver(() => {
        this.syncThemeColors(false);
      });
      this.themeMutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      });
    }

    if (typeof window.matchMedia === 'function') {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQueryList.addEventListener('change', this.handleMediaChange);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointer.active = true;
  }

  private handleMouseLeave(): void {
    this.pointer.active = false;
    this.hoveredNode = null;
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    this.pointer.lastClickX = cx;
    this.pointer.lastClickY = cy;
    this.pointer.clickTime = performance.now();

    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];
      if (dot.type === 'node') continue;
      const dist = Math.hypot(dot.screenX - cx, dot.screenY - cy);
      if (dist < 26) {
        if (dot.type === 'parking') {
          dot.isAvailable = !dot.isAvailable;
          dot.vz -= 45;
        } else if (dot.type === 'station') {
          dot.pulseTimer = 1.0;
          dot.vz -= 55;
        } else if (dot.type === 'car') {
          dot.vz -= 35;
          dot.heading += Math.PI * 0.5;
        }
        break;
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = touch.clientX - rect.left;
    this.pointer.y = touch.clientY - rect.top;
    this.pointer.active = true;
  }

  private handleTouchEnd(): void {
    this.pointer.active = false;
    this.hoveredNode = null;
  }

  private handleMediaChange(): void {
    this.syncThemeColors(false);
  }

  private syncThemeColors(immediate: boolean): void {
    const target = this.options.themeTargetElement || document.documentElement;
    const computed = window.getComputedStyle(target);
    const hasExplicitDark = target.dataset.theme === 'dark' || target.classList.contains('dark');
    const hasExplicitLight = target.dataset.theme === 'light' || target.classList.contains('light');
    const isDark = hasExplicitDark
      ? true
      : hasExplicitLight
        ? false
        : (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ?? false;

    const fallbackBg: RGBAColor = isDark
      ? { r: 9, g: 10, b: 15, a: 1 } // #090A0F Apple Deep Space Dark
      : { r: 245, g: 245, b: 247, a: 1 }; // #F5F5F7 Apple Light

    const fallbackDot: RGBAColor = isDark
      ? { r: 255, g: 255, b: 255, a: 0.16 }
      : { r: 0, g: 0, b: 0, a: 0.14 };

    // Pure Apple System Blue
    const fallbackBlue: RGBAColor = isDark
      ? { r: 10, g: 132, b: 255, a: 0.95 } // Apple Dark Blue #0A84FF
      : { r: 0, g: 113, b: 227, a: 0.95 }; // Apple Light Blue #0071E3

    const bgProp = computed.getPropertyValue('--bg-surface')?.trim();
    const dotProp = computed.getPropertyValue('--dot-base')?.trim();
    const blueProp =
      computed.getPropertyValue('--system-primary')?.trim() ||
      computed.getPropertyValue('--system-primary-rgb')?.trim() ||
      computed.getPropertyValue('--color-accent')?.trim();

    if (isDark) {
      // If dark mode, ensure surface is dark even if root CSS variable was not overridden
      const isLightBg = bgProp && (bgProp.includes('245') || bgProp.includes('#f5') || bgProp.includes('#fff'));
      this.targetBgColor = (!bgProp || isLightBg) ? fallbackBg : parseCssColor(bgProp, fallbackBg);
      const isLightDot = dotProp && dotProp.includes('0, 0, 0');
      this.targetDotBaseColor = (!dotProp || isLightDot) ? fallbackDot : parseCssColor(dotProp, fallbackDot);
      this.targetSystemBlue = blueProp ? parseCssColor(blueProp, fallbackBlue) : fallbackBlue;
    } else {
      const isDarkBg = bgProp && (bgProp.includes('#09') || bgProp.includes('#000') || bgProp.includes('rgb(0') || bgProp.includes('rgb(9'));
      this.targetBgColor = (!bgProp || isDarkBg) ? fallbackBg : parseCssColor(bgProp, fallbackBg);
      this.targetDotBaseColor = parseCssColor(dotProp, fallbackDot);
      this.targetSystemBlue = parseCssColor(blueProp, fallbackBlue);
    }

    if (immediate) {
      this.currentBgColor = { ...this.targetBgColor };
      this.currentDotBaseColor = { ...this.targetDotBaseColor };
      this.currentSystemBlue = { ...this.targetSystemBlue };
    }
  }

  // --------------------------------------------------------------------------
  // 3D Transit Matrix Grid Generation
  // --------------------------------------------------------------------------

  public resize(): void {
    if (this.isDestroyed) return;
    const parent = this.canvas.parentElement;
    const displayWidth = parent ? parent.clientWidth : window.innerWidth;
    const displayHeight = parent ? parent.clientHeight : window.innerHeight;

    if (displayWidth === 0 || displayHeight === 0) return;

    this.width = displayWidth;
    this.height = displayHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);

    const physicalWidth = Math.round(displayWidth * this.dpr);
    const physicalHeight = Math.round(displayHeight * this.dpr);

    if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
      this.canvas.width = physicalWidth;
      this.canvas.height = physicalHeight;
      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    this.rebuild3DTransitGrid(true);
  }

  private rebuild3DTransitGrid(preserveVelocities: boolean): void {
    const { gap, pitchAngleDeg, cameraZ } = this.options;
    const tiltRad = (pitchAngleDeg * Math.PI) / 180;
    const sinTilt = Math.sin(tiltRad);
    const cosTilt = Math.cos(tiltRad);

    const halfWidth = this.width * 0.75;
    const halfHeight = this.height * 0.75;

    const cols = Math.ceil((halfWidth * 2) / gap) + 1;
    const rows = Math.ceil((halfHeight * 2) / gap) + 1;

    const existingMap = new Map<string, TransitNode3D>();
    if (preserveVelocities) {
      for (let i = 0; i < this.dots.length; i++) {
        const d = this.dots[i];
        existingMap.set(`${d.col}_${d.row}`, d);
      }
    }

    const nextDots: TransitNode3D[] = [];
    const minGridY = -halfHeight;
    let stationIndex = 0;
    let bayNumber = 1;

    // Ordered back-to-front for O(1) painter's depth sorting
    for (let r = 0; r < rows; r++) {
      const gy = minGridY + r * gap;
      const baseWorldZ = cameraZ + gy * sinTilt;
      const baseWorldY = gy * cosTilt;
      const depthRatio = Math.max(
        0,
        Math.min(1, (baseWorldZ - (cameraZ - halfHeight * sinTilt)) / (halfHeight * 2 * sinTilt || 1))
      );

      for (let c = 0; c < cols; c++) {
        const gx = -halfWidth + c * gap;
        const baseWorldX = gx;
        const key = `${c}_${r}`;
        const existing = existingMap.get(key);

        if (existing) {
          existing.baseWorldX = baseWorldX;
          existing.baseWorldY = baseWorldY;
          existing.baseWorldZ = baseWorldZ;
          existing.depthRatio = depthRatio;
          nextDots.push(existing);
        } else {
          // Elegant sparse distribution:
          // ~3.5% Stations, ~8% Parking, ~6% Cars, remainder clean micro-dots
          const hash = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
          const pseudoRand = hash - Math.floor(hash);

          let type: TransitNodeType = 'node';
          let label = undefined;
          let stationCode = undefined;
          let isAvailable = undefined;
          let heading = (c * 0.4 + r * 0.7) % (Math.PI * 2);

          const isInterior = c > 2 && c < cols - 3 && r > 2 && r < rows - 2;

          if (isInterior && pseudoRand < 0.035) {
            type = 'station';
            const st = AUTHENTIC_STATIONS[stationIndex % AUTHENTIC_STATIONS.length];
            label = st.name;
            stationCode = st.code;
            stationIndex++;
          } else if (isInterior && pseudoRand >= 0.035 && pseudoRand < 0.11) {
            type = 'parking';
            label = `Bay P-${String(bayNumber++).padStart(2, '0')}`;
            isAvailable = pseudoRand > 0.07;
          } else if (isInterior && pseudoRand >= 0.11 && pseudoRand < 0.17) {
            type = 'car';
            label = 'Commuter Car';
          }

          nextDots.push({
            col: c,
            row: r,
            type,
            label,
            stationCode,
            isAvailable,
            heading,
            targetHeading: heading,
            pulseTimer: 0,
            baseWorldX,
            baseWorldY,
            baseWorldZ,
            x: baseWorldX,
            y: baseWorldY,
            z: baseWorldZ,
            vx: 0,
            vy: 0,
            vz: 0,
            screenX: 0,
            screenY: 0,
            scale: 1,
            radius: this.options.baseRadius,
            phase: (c * 0.16 + r * 0.22) % (Math.PI * 2),
            depthRatio,
          });
        }
      }
    }

    this.dots = nextDots;
  }

  // --------------------------------------------------------------------------
  // Core Physics & 120fps Animation Loop
  // --------------------------------------------------------------------------

  private tick(timestamp: number): void {
    if (this.isDestroyed) return;

    const rawDelta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const dt = Math.max(0.5, Math.min(2.5, rawDelta / 16.6667));

    this.updateColors(dt);
    this.updatePointer(dt);
    this.render(timestamp, dt);

    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private updateColors(dt: number): void {
    const rate = Math.min(1, this.options.themeTransitionSpeed * dt);
    lerpColor(this.currentBgColor, this.targetBgColor, rate, this.currentBgColor);
    lerpColor(this.currentDotBaseColor, this.targetDotBaseColor, rate, this.currentDotBaseColor);
    lerpColor(this.currentSystemBlue, this.targetSystemBlue, rate, this.currentSystemBlue);
  }

  private updatePointer(dt: number): void {
    const targetStrength = this.pointer.active ? 1.0 : 0.0;
    this.pointer.strength += (targetStrength - this.pointer.strength) * Math.min(1.0, 0.14 * dt);
    if (this.pointer.strength < 0.001) {
      this.pointer.strength = 0;
    }
  }

  private render(time: number, dt: number): void {
    const {
      baseRadius,
      interactionRadius,
      magneticPullXY,
      magneticPullZ,
      stiffness,
      damping,
      waveSpeed,
      waveAmplitudeZ,
      waveAmplitudeY,
      waveFrequencyX,
      waveFrequencyY,
      fov,
      maxScale,
      glowEnabled,
    } = this.options;

    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    // 1. Draw solid background surface
    ctx.fillStyle = `rgb(${this.currentBgColor.r | 0},${this.currentBgColor.g | 0},${this.currentBgColor.b | 0})`;
    ctx.fillRect(0, 0, width, height);

    const pointerStrength = this.pointer.strength;
    const px = this.pointer.x;
    const py = this.pointer.y;

    // 2. Cursor Luminous Radial Bloom in System Blue
    if (glowEnabled && pointerStrength > 0.01) {
      const glowRadius = interactionRadius * 1.35;
      const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
      const pr = this.currentSystemBlue.r | 0;
      const pg = this.currentSystemBlue.g | 0;
      const pb = this.currentSystemBlue.b | 0;
      const alphaPeak = (0.13 * pointerStrength).toFixed(4);

      glowGrad.addColorStop(0, `rgba(${pr},${pg},${pb},${alphaPeak})`);
      glowGrad.addColorStop(0.5, `rgba(${pr},${pg},${pb},${(parseFloat(alphaPeak) * 0.35).toFixed(4)})`);
      glowGrad.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 3D Simulation & Depth-ordered Rendering
    const radiusSq = interactionRadius * interactionRadius;
    const baseCol = this.currentDotBaseColor;
    const blueCol = this.currentSystemBlue;
    const dampingDt = Math.pow(damping, dt);
    const totalDots = this.dots.length;

    let closestHoveredNode: TransitNode3D | null = null;
    let closestHoveredDist = 32;

    for (let i = 0; i < totalDots; i++) {
      const dot = this.dots[i];

      // Idle 3D wave ripples (depth Z + height Y)
      const angle1 =
        dot.baseWorldX * waveFrequencyX + dot.baseWorldY * waveFrequencyY - time * waveSpeed + dot.phase * 0.2;
      const angle2 =
        dot.baseWorldX * 0.003 - dot.baseWorldY * 0.006 + time * (waveSpeed * 0.7);

      const sin1 = Math.sin(angle1);
      const cos2 = Math.cos(angle2);
      const waveVal = sin1 * 0.65 + cos2 * 0.35;

      const idleOffsetZ = sin1 * waveAmplitudeZ;
      const idleOffsetY = Math.cos(angle1) * waveAmplitudeY;
      const idleOffsetX = Math.sin(angle2) * (waveAmplitudeY * 0.4);

      let targetWorldX = dot.baseWorldX + idleOffsetX;
      let targetWorldY = dot.baseWorldY + idleOffsetY;
      let targetWorldZ = dot.baseWorldZ + idleOffsetZ;

      const currentScale = fov / Math.max(50, dot.z);
      const currentSx = centerX + dot.x * currentScale;
      const currentSy = centerY + dot.y * currentScale;

      let influence = 0;

      // 3D Magnetic Attraction & Object Reactivity
      if (pointerStrength > 0.01) {
        const dx = px - currentSx;
        const dy = py - currentSy;
        const distSq = dx * dx + dy * dy;

        if (distSq < radiusSq) {
          const dist = Math.sqrt(distSq);
          const normDist = 1 - dist / interactionRadius;
          influence = normDist * normDist * (3 - 2 * normDist) * pointerStrength;

          targetWorldZ -= magneticPullZ * influence;
          const pullFactor = (magneticPullXY / (currentScale || 1)) * influence;
          const invDist = dist > 0.001 ? 1 / dist : 0;
          targetWorldX += dx * invDist * pullFactor;
          targetWorldY += dy * invDist * pullFactor;

          if (dot.type === 'car') {
            const angleToCursor = Math.atan2(dy, dx);
            let diff = angleToCursor - dot.heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            dot.heading += diff * Math.min(1.0, 0.08 * dt);
          }

          if (dot.type !== 'node' && dist < closestHoveredDist) {
            closestHoveredDist = dist;
            closestHoveredNode = dot;
          }
        }
      }

      const forceX = (targetWorldX - dot.x) * stiffness;
      const forceY = (targetWorldY - dot.y) * stiffness;
      const forceZ = (targetWorldZ - dot.z) * stiffness;

      dot.vx = (dot.vx + forceX * dt) * dampingDt;
      dot.vy = (dot.vy + forceY * dt) * dampingDt;
      dot.vz = (dot.vz + forceZ * dt) * dampingDt;

      dot.x += dot.vx * dt;
      dot.y += dot.vy * dt;
      dot.z += dot.vz * dt;

      const projScale = fov / Math.max(50, dot.z);
      dot.screenX = centerX + dot.x * projScale;
      dot.screenY = centerY + dot.y * projScale;
      dot.scale = projScale;

      if (
        dot.screenX < -35 ||
        dot.screenX > width + 35 ||
        dot.screenY < -35 ||
        dot.screenY > height + 35
      ) {
        continue;
      }

      const depthScaleFactor = Math.max(0.45, Math.min(1.4, projScale));
      const targetRadius =
        baseRadius *
        depthScaleFactor *
        (1.0 + waveVal * 0.16) *
        (1.0 + influence * (maxScale - 1.0));

      dot.radius += (targetRadius - dot.radius) * Math.min(1.0, 0.28 * dt);

      const depthAlpha = Math.max(0.2, Math.min(1.0, 1.25 - dot.depthRatio * 0.8));

      // Draw object
      if (dot.type === 'station') {
        this.drawStation(ctx, dot, depthScaleFactor, influence, depthAlpha, baseCol, blueCol, time);
      } else if (dot.type === 'parking') {
        this.drawParkingBay(ctx, dot, depthScaleFactor, influence, depthAlpha, baseCol, blueCol);
      } else if (dot.type === 'car') {
        this.drawCar(ctx, dot, depthScaleFactor, influence, depthAlpha, baseCol, blueCol);
      } else {
        this.drawGridDot(ctx, dot, waveVal, influence, depthAlpha, baseCol, blueCol);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Transit Vector Renderers (Retina Crisp & Strictly System Blue Aligned)
  // --------------------------------------------------------------------------

  private drawStation(
    ctx: CanvasRenderingContext2D,
    dot: TransitNode3D,
    scale: number,
    influence: number,
    depthAlpha: number,
    baseCol: RGBAColor,
    blueCol: RGBAColor,
    time: number
  ): void {
    const sx = dot.screenX;
    const sy = dot.screenY;
    const r = Math.max(4.5, 6.5 * scale * (1.0 + influence * 0.3));

    // Radar pulse ring
    const pulseFactor = (time * 0.0025 + dot.phase) % 1;
    const radarRadius = r * (1.4 + pulseFactor * 1.8);
    const radarAlpha = (1 - pulseFactor) * 0.4 * Math.max(0.3, influence) * depthAlpha;

    ctx.strokeStyle = `rgba(${blueCol.r | 0},${blueCol.g | 0},${blueCol.b | 0},${radarAlpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(0.8, 1.0 * scale);
    ctx.beginPath();
    ctx.arc(sx, sy, radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Beacon Outer Disc
    lerpColor(baseCol, blueCol, Math.max(influence, 0.55), this.scratchColor);
    const alpha = Math.min(1.0, (baseCol.a + 0.6) * depthAlpha);

    ctx.fillStyle = `rgba(${this.scratchColor.r | 0},${this.scratchColor.g | 0},${this.scratchColor.b | 0},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Center Core Light
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawParkingBay(
    ctx: CanvasRenderingContext2D,
    dot: TransitNode3D,
    scale: number,
    influence: number,
    depthAlpha: number,
    baseCol: RGBAColor,
    blueCol: RGBAColor
  ): void {
    const sx = dot.screenX;
    const sy = dot.screenY;
    const w = Math.max(10, 15 * scale * (1.0 + influence * 0.25));
    const h = Math.max(8, 12 * scale * (1.0 + influence * 0.25));
    const isAvail = dot.isAvailable !== false;

    lerpColor(baseCol, blueCol, influence > 0.05 ? influence : isAvail ? 0.35 : 0.05, this.scratchColor);
    const borderAlpha = Math.min(1.0, (0.35 + influence * 0.65) * depthAlpha);

    ctx.strokeStyle = `rgba(${this.scratchColor.r | 0},${this.scratchColor.g | 0},${this.scratchColor.b | 0},${borderAlpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(1, 1.2 * scale);

    const cornerRadius = 2.5 * scale;
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - h / 2, w, h, cornerRadius);
    ctx.stroke();

    if (influence > 0.08 || isAvail) {
      ctx.fillStyle = `rgba(${blueCol.r | 0},${blueCol.g | 0},${blueCol.b | 0},${(0.12 * depthAlpha * (0.5 + influence)).toFixed(3)})`;
      ctx.fill();
    }

    if (scale > 0.65) {
      ctx.font = `700 ${Math.round(8 * scale)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textAlpha = Math.min(1.0, (0.5 + influence * 0.5) * depthAlpha);
      ctx.fillStyle = `rgba(${this.scratchColor.r | 0},${this.scratchColor.g | 0},${this.scratchColor.b | 0},${textAlpha.toFixed(3)})`;
      ctx.fillText('P', sx, sy);
    }
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    dot: TransitNode3D,
    scale: number,
    influence: number,
    depthAlpha: number,
    baseCol: RGBAColor,
    blueCol: RGBAColor
  ): void {
    const sx = dot.screenX;
    const sy = dot.screenY;
    const length = Math.max(10, 15 * scale * (1.0 + influence * 0.2));
    const width = Math.max(6, 9 * scale * (1.0 + influence * 0.2));

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(dot.heading);

    // Front Photon Headlight Beams (System Blue)
    if (influence > 0.04 || scale > 0.85) {
      const beamLen = length * 1.3;
      const beamGrad = ctx.createRadialGradient(length / 2, 0, 0, length / 2 + beamLen * 0.6, 0, beamLen);
      const beamAlpha = (0.35 * Math.max(0.4, influence) * depthAlpha).toFixed(3);
      beamGrad.addColorStop(0, `rgba(${blueCol.r | 0},${blueCol.g | 0},${blueCol.b | 0},${beamAlpha})`);
      beamGrad.addColorStop(1, `rgba(${blueCol.r | 0},${blueCol.g | 0},${blueCol.b | 0},0)`);

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(length / 2, -width * 0.35);
      ctx.lineTo(length / 2 + beamLen, -width * 1.1);
      ctx.lineTo(length / 2 + beamLen, width * 1.1);
      ctx.lineTo(length / 2, width * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    // Chassis
    lerpColor(baseCol, blueCol, Math.max(influence, 0.45), this.scratchColor);
    const alpha = Math.min(1.0, (0.55 + influence * 0.45) * depthAlpha);

    ctx.fillStyle = `rgba(${this.scratchColor.r | 0},${this.scratchColor.g | 0},${this.scratchColor.b | 0},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, length, width, 2.5 * scale);
    ctx.fill();

    // Windshield highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.roundRect(-length * 0.2, -width * 0.3, length * 0.45, width * 0.6, 1.2 * scale);
    ctx.fill();

    ctx.restore();
  }

  private drawGridDot(
    ctx: CanvasRenderingContext2D,
    dot: TransitNode3D,
    waveVal: number,
    influence: number,
    depthAlpha: number,
    baseCol: RGBAColor,
    blueCol: RGBAColor
  ): void {
    if (influence > 0.01) {
      lerpColor(baseCol, blueCol, influence, this.scratchColor);
      this.scratchColor.a = Math.min(1.0, (baseCol.a + (0.95 - baseCol.a) * influence) * Math.min(1.0, depthAlpha + 0.3));
    } else if (waveVal > 0.45) {
      const crestIntensity = (waveVal - 0.45) * 0.35;
      lerpColor(baseCol, blueCol, crestIntensity, this.scratchColor);
      this.scratchColor.a = baseCol.a * depthAlpha * (1.0 + crestIntensity * 0.6);
    } else {
      this.scratchColor.r = baseCol.r;
      this.scratchColor.g = baseCol.g;
      this.scratchColor.b = baseCol.b;
      this.scratchColor.a = baseCol.a * depthAlpha * (1.0 + waveVal * 0.12);
    }

    const r = Math.max(0.35, dot.radius);
    ctx.beginPath();
    ctx.arc(dot.screenX, dot.screenY, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.scratchColor.r | 0},${this.scratchColor.g | 0},${this.scratchColor.b | 0},${this.scratchColor.a.toFixed(3)})`;
    ctx.fill();
  }
}
