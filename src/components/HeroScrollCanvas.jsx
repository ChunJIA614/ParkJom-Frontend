import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Hero frame sets, all cut from `landing video.mp4` (4K master: 3840×2160 @ 120fps, 10.1s).
 * - `hd`: 1920×1080 AVIF q66 4:4:4, sampled at 24fps (~21 MB) — desktop.
 * - `sd`: 1280×720 WebP q82, sampled at 24fps (~14 MB) — fallback when AVIF can't decode.
 * - `sm`: 960×540 WebP q78, sampled at 24fps (~8 MB) — phones and other narrow viewports.
 * The set is picked once on mount from the viewport width; a failed AVIF decode drops to `sd`.
 *
 * The master opens with ~2 frames of a focus pull — genuinely defocused, edge variance ~170
 * against ~2300 once it locks — which left the hero's very first paint looking blurry. The
 * build therefore runs with `--trim-start 2`, so frame 1 here is the first sharp frame and
 * the count is 240, not the 242 the 10.1s master yields. Rebuild without that flag and the
 * blurry opening comes straight back.
 *
 * Rebuild all three with `python scripts/build-hero-frames.py` whenever the master changes.
 * The master is 4K, so every set here is a true downsample with detail to spare. Raising `hd`
 * to 2560×1440 is tempting but measured expensive: ~28 MB of payload (vs ~21 MB) and 3.3 GB of
 * decoded bitmaps for 242 frames (vs 1.9 GB), which is close to what a browser tab tolerates.
 * 1920 is the sane ceiling until the loader learns to release far-away frames.
 */
const FRAME_SETS = {
  hd: { dir: '/frames-hd', ext: 'avif', count: 240, width: 1920 },
  sd: { dir: '/frames', ext: 'webp', count: 240, width: 1280 },
  sm: { dir: '/frames-sm', ext: 'webp', count: 240, width: 960 },
};

export const HERO_TOTAL_FRAMES = FRAME_SETS.hd.count;

/** Pin length expressed in viewport heights. Keep in sync with `end: "+=400%"`. */
export const HERO_PIN_VIEWPORTS = 4;

/** Below this width the 960px set is plenty: a phone canvas is ~780 device px wide. */
const MOBILE_BREAKPOINT = 768;

/**
 * Sanity cap on the canvas backing store. The real limiter is the frame's own pixel
 * width (see `capBySource` in the resize effect), so on wide viewports this never
 * binds. On a dpr-3 phone it used to clip the canvas to 2x (780 px from a 960 px
 * source) and let the compositor upscale the rest — 3 lets the canvas reach the
 * source's native width instead.
 */
const MAX_DPR = 3;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll distance the hero pins for. Zero under reduced motion: the hero then renders as a
 * single static frame instead of scrubbing, so there is nothing to scroll through.
 */
export const getHeroPinViewports = () => (prefersReducedMotion() ? 0 : HERO_PIN_VIEWPORTS);

const pickFrameSet = () => {
  if (typeof window === 'undefined') return FRAME_SETS.hd;
  if (prefersReducedMotion()) return FRAME_SETS.sd; // only frame 1 is ever fetched
  return window.innerWidth < MOBILE_BREAKPOINT ? FRAME_SETS.sm : FRAME_SETS.hd;
};

const framePath = (index, set) =>
  `${set.dir}/frame_${String(index + 1).padStart(4, '0')}.${set.ext}`;

const isReady = (img) => Boolean(img && img.complete && img.naturalWidth > 0);

const btnPrimary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0071e3] px-7 text-[16px] font-medium tracking-[-0.016em] text-white shadow-[0_8px_24px_rgba(0,113,227,0.38)] transition-all duration-200 hover:bg-[#0077ed]';
const btnSecondary =
  'inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 px-7 text-[16px] font-medium tracking-[-0.016em] text-white transition-all duration-200';
const stepCard =
  'rounded-[24px] bg-slate-950/45 backdrop-blur-xl border border-white/15 p-6 text-[#f5f5f7] shadow-2xl md:p-7';

/**
 * `totalFrames` is optional — it defaults to the active set's own count, which is what every
 * caller wants. Leaving it required made `<HeroScrollCanvas />` a type error in LandingPage.
 */
export default function HeroScrollCanvas({ totalFrames = undefined }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  // Picked once on mount: `sm` on phones, `hd` on desktop; drops to `sd` if AVIF can't decode.
  const [frameSet, setFrameSet] = useState(pickFrameSet);
  const [reducedMotion] = useState(prefersReducedMotion);
  const frameCount = totalFrames ?? frameSet.count;

  // Native pixel width of the frames actually in use — drives the canvas DPR cap.
  // 0 means "not known yet": fall back to the plain DPR cap until the first frame loads.
  const sourceWidthRef = useRef(0);
  const resizeRef = useRef(null);

  // Heavy data lives in refs so loading/scrubbing never triggers React re-renders.
  const imagesRef = useRef([]);
  const frameObjRef = useRef({ currentFrame: 0 });
  const targetFrameRef = useRef(0); // frame requested by the timeline
  const drawnFrameRef = useRef(-1); // frame actually painted (may lag while loading)

  const [loadProgress, setLoadProgress] = useState(0);

  /**
   * Paint a frame using an `object-fit: cover` crop.
   * If the requested frame hasn't loaded yet, fall back to the nearest loaded one.
   */
  const renderFrame = useCallback((index, force = false) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    const images = imagesRef.current;
    const target = Math.max(0, Math.min(images.length - 1, Math.round(index)));
    targetFrameRef.current = target;

    let frame = -1;
    for (let offset = 0; offset < images.length; offset += 1) {
      if (isReady(images[target - offset])) { frame = target - offset; break; }
      if (isReady(images[target + offset])) { frame = target + offset; break; }
    }
    if (frame === -1 || (!force && frame === drawnFrameRef.current)) return;

    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d', { alpha: false });
    const ctx = ctxRef.current;
    const img = images[frame];

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const canvasRatio = cw / ch;
    const imageRatio = iw / ih;

    // Crop the source rect so it matches the canvas aspect ratio, centred.
    let sx = 0;
    let sy = 0;
    let sw = iw;
    let sh = ih;
    if (imageRatio > canvasRatio) {
      sw = ih * canvasRatio;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / canvasRatio;
      sy = (ih - sh) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    drawnFrameRef.current = frame;
  }, []);

  // ── Preload: frame 1 first (instant first paint), then everything else concurrently ──
  useEffect(() => {
    let cancelled = false;
    const images = new Array(frameCount);
    imagesRef.current = images;
    drawnFrameRef.current = -1;

    let settled = 0;
    let lastPct = -1;

    const loadFrame = (index) =>
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        const done = (ok) => {
          if (cancelled) return;
          settled += 1;
          const pct = Math.round((settled / frameCount) * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            setLoadProgress(pct);
          }
          // Repaint if this frame gets us closer to what the user has scrolled to.
          if (ok && drawnFrameRef.current !== targetFrameRef.current) {
            renderFrame(targetFrameRef.current);
          }
          resolve(ok);
        };
        img.onload = () => {
          // Learn the real pixel width so the canvas can be capped to it.
          if (img.naturalWidth > 0 && img.naturalWidth !== sourceWidthRef.current) {
            sourceWidthRef.current = img.naturalWidth;
            resizeRef.current?.();
          }
          done(true);
        };
        img.onerror = () => done(false); // still counts so the progress bar can finish
        img.src = framePath(index, frameSet);
        images[index] = img;
      });

    loadFrame(0).then((ok) => {
      if (cancelled) return;
      // No AVIF decode? Swap to the WebP set and let this effect run again.
      if (!ok && frameSet === FRAME_SETS.hd) {
        setFrameSet(FRAME_SETS.sd);
        return;
      }
      renderFrame(0, true);
      // Reduced motion: the hero is a still image, so frame 1 is the entire payload.
      if (reducedMotion) {
        setLoadProgress(100);
        return;
      }
      for (let i = 1; i < frameCount; i += 1) loadFrame(i);
    });

    return () => {
      cancelled = true;
      images.forEach((img) => {
        if (!img) return;
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [frameCount, frameSet, renderFrame, reducedMotion]);

  // ── HiDPI + responsive canvas sizing ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resize = () => {
      const cssWidth = Math.max(1, canvas.clientWidth);
      // Never allocate a canvas bigger than the frames themselves: rendering 1280px of
      // source into a 2160px bitmap only burns GPU/memory and looks identical.
      const sourceWidth = sourceWidthRef.current;
      const capBySource = sourceWidth > 0 ? sourceWidth / cssWidth : MAX_DPR;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, capBySource);
      const width = Math.round(cssWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; // resizing clears the bitmap…
        canvas.height = height;
      }
      renderFrame(targetFrameRef.current, true); // …so always repaint
    };

    resizeRef.current = resize;
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (resizeRef.current === resize) resizeRef.current = null;
    };
  }, [renderFrame]);

  // ── Single pinned timeline: frames + 4 copy layers, auto-reverted by useGSAP ──
  useGSAP(
    () => {
      // Reduced motion: no pin, no scrub. Stage 1 stays as a still hero image.
      if (reducedMotion) {
        gsap.set(['.hero-stage-2', '.hero-stage-3', '.hero-stage-4'], { autoAlpha: 0 });
        return;
      }

      const frameObj = frameObjRef.current;
      frameObj.currentFrame = 0;

      gsap.set(['.hero-stage-2', '.hero-stage-3', '.hero-stage-4'], { autoAlpha: 0, y: 48 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: `+=${HERO_PIN_VIEWPORTS * 100}%`,
          pin: true,
          scrub: 0.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Timeline length = 1, so every position below is a fraction of total scroll.
      tl.to(
        frameObj,
        {
          currentFrame: frameCount - 1,
          snap: 'currentFrame',
          duration: 1,
          onUpdate: () => renderFrame(frameObj.currentFrame),
        },
        0,
      );

      // Stage 1 (0% – 20%): visible on load, exits cleanly before 20%.
      tl.to('.hero-stage-1', { autoAlpha: 0, y: -44, duration: 0.06, ease: 'power2.in' }, 0.14);

      // Stage 2 (25% – 50%): commuter card, bottom-left.
      tl.to('.hero-stage-2', { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.25)
        .to('.hero-stage-2', { autoAlpha: 0, y: -36, duration: 0.05, ease: 'power2.in' }, 0.45);

      // Stage 3 (55% – 80%): owner card, bottom-right.
      tl.to('.hero-stage-3', { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.55)
        .to('.hero-stage-3', { autoAlpha: 0, y: -36, duration: 0.05, ease: 'power2.in' }, 0.75);

      // Stage 4 (85% – 100%): closing conversion copy stays until pin releases.
      tl.to('.hero-stage-4', { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out' }, 0.85);
    },
    { scope: containerRef, dependencies: [frameCount, renderFrame, reducedMotion] },
  );

  const loaded = loadProgress >= 100;

  return (
    <section
      ref={containerRef}
      id="overview"
      className="relative h-screen w-full overflow-hidden bg-black text-[#f5f5f7]"
      aria-label="ParkJom overview"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />

      {/* Soft radial darkening mask over <canvas> for crisp text legibility without hiding the 3D scene */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.42)_0%,rgba(2,6,23,0.12)_60%,transparent_100%)]" />

      {/* Ultra-subtle film grain: breaks up AVIF banding and lifts perceived sharpness */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>\")",
          backgroundSize: '160px 160px',
        }}
      />

      {/* ── Stage 1 (0% – 20%): Cardless floating hero typography shifted slightly upward ── */}
      <div className="hero-stage-1 absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <div className="-translate-y-6 flex flex-col items-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-950/40 backdrop-blur-md border border-white/20 px-4 py-1.5 text-[12px] font-medium tracking-[-0.01em] text-white shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[#30d158]" />
            Kuala Lumpur LRT &amp; MRT · Weekdays 8AM – 6PM
          </span>

          <h1 className="mt-6 max-w-4xl text-[38px] font-semibold leading-[1.06] tracking-[-0.022em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)] sm:text-[52px] md:text-[64px] lg:text-[72px]">
            Running late for the LRT?
            <span className="mt-1 block text-[#64d2ff]">Stop circling for 30&nbsp;minutes.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-[1.47] tracking-[-0.016em] text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] sm:text-[19px]">
            Reserve a private condo parking bay just a 3‑minute walk from your station before you leave home.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a href="/login?role=Commuter" className={`${btnPrimary} w-full sm:w-auto`}>
              Find parking <ArrowRight size={16} />
            </a>
            <a href="/login?role=Owner" className={`${btnSecondary} w-full sm:w-auto`}>
              Rent out your bay
            </a>
          </div>
        </div>

        {!reducedMotion && (
          <span className="absolute bottom-6 inline-flex items-center gap-1.5 rounded-full bg-slate-950/40 backdrop-blur-md border border-white/20 px-4 py-1.5 text-[12px] font-medium tracking-[-0.01em] text-white shadow-lg">
            Scroll to explore
            <ChevronDown size={15} className="animate-bounce text-[#64d2ff]" />
          </span>
        )}
      </div>

      {/* ── Stage 2 (25% – 50%): Compact translucent glass card (bottom-left) ── */}
      <div className="hero-stage-2 invisible absolute inset-x-5 bottom-8 max-w-sm md:inset-x-auto md:bottom-14 md:left-10 lg:left-16">
        <div className={stepCard}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#64d2ff]">For commuters</p>
          <h2 className="mt-1.5 text-[24px] font-semibold leading-[1.14] tracking-[-0.015em] text-white md:text-[28px]">
            Goodbye, full Park&nbsp;&amp;&nbsp;Ride.
          </h2>
          <p className="mt-3 text-[15px] leading-[1.5] tracking-[-0.016em] text-white/80">
            Lock in a covered condo bay right next to the station before you leave home.{' '}
            <span className="font-semibold text-white">Rain or shine, you clock in on time.</span>
          </p>
        </div>
      </div>

      {/* ── Stage 3 (55% – 80%): Compact translucent glass card (bottom-right) ── */}
      <div className="hero-stage-3 invisible absolute inset-x-5 bottom-8 max-w-sm md:inset-x-auto md:bottom-14 md:right-10 lg:right-16">
        <div className={stepCard}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#30d158]">For owners</p>
          <h2 className="mt-1.5 text-[24px] font-semibold leading-[1.14] tracking-[-0.015em] text-white md:text-[28px]">
            Your bay sits empty all day anyway.
          </h2>
          <p className="mt-3 text-[15px] leading-[1.5] tracking-[-0.016em] text-white/80">
            Rent it to commuters from 8AM to 6PM and{' '}
            <span className="font-semibold text-white">earn RM250 – RM450 a month in passive income.</span>
            <sup className="ml-0.5 text-[11px]">
              <a href="#footnote-1" className="text-white/75 hover:text-white" aria-label="Footnote 1">1</a>
            </sup>
          </p>
        </div>
      </div>

      {/* ── Stage 4 (85% – 100%): Floating closing CTA shifted above the glowing VIP bay ── */}
      <div className="hero-stage-4 invisible absolute inset-0 flex items-center justify-center px-5 text-center">
        <div className="-translate-y-32 flex max-w-2xl flex-col items-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-950/40 backdrop-blur-md border border-white/20 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#64d2ff] shadow-lg">
            Now live
          </span>
          <h2 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)] sm:text-[44px] md:text-[52px]">
            Core stations along the Kelana Jaya &amp; Ampang lines.
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[16px] leading-[1.5] tracking-[-0.016em] text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] sm:text-[18px]">
            Start your morning commute with a guaranteed bay, or list your unused condo spot in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a href="/login?role=Commuter" className={`${btnPrimary} w-full sm:w-auto`}>
              Reserve a bay <ArrowRight size={16} />
            </a>
            <a href="/login?role=Owner" className={`${btnSecondary} w-full sm:w-auto`}>
              Become a host
            </a>
          </div>
        </div>
      </div>

      {/* ── Lightweight preload indicator ── */}
      <div
        className={`pointer-events-none absolute bottom-6 right-6 flex items-center gap-2.5 rounded-full bg-slate-950/40 backdrop-blur-md border border-white/20 px-3.5 py-1.5 text-[12px] tabular-nums tracking-[-0.01em] text-white shadow-lg transition-opacity duration-700 ${
          loaded ? 'opacity-0' : 'opacity-100'
        }`}
        role="progressbar"
        aria-label="Loading animation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={loadProgress}
      >
        <span className="h-[3px] w-14 overflow-hidden rounded-full bg-white/20">
          <span className="block h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${loadProgress}%` }} />
        </span>
        {loadProgress}%
      </div>
    </section>
  );
}
