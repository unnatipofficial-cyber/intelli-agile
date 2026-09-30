import { useEffect, useRef } from "react";

/**
 * SpaceBackdrop — the landing page's full-page sky.
 *
 * A single fixed 2D canvas paints the whole thing: a parallaxed, twinkling star
 * field plus shooting stars that streak down across it. The field is driven by
 * scroll velocity — scroll faster and the stars stretch into trails while the
 * shooting stars fall noticeably faster, so the page feels like it is travelling
 * through space rather than scrolling a document.
 *
 * Deliberately cheap: one canvas, capped device pixel ratio, a few hundred
 * stars, at most four meteors at once, and the loop stops entirely while the tab
 * is hidden. When reduced motion is requested it paints one still frame and
 * never starts a loop.
 */

export interface SpaceBackdropProps {
  /** Theme accent, used to tint some of the shooting stars. */
  accent?: string;
  /** Theme glow colour, used for the nebula haze and meteor cores. */
  glow?: string;
  /** When false, a single static star field is painted (reduced motion). */
  animated?: boolean;
}

interface Star {
  x: number;
  y: number;
  /** 0 = far, 1 = near. Drives parallax, size and streak length. */
  depth: number;
  size: number;
  alpha: number;
  phase: number;
  speed: number;
}

interface Shooter {
  x: number;
  y: number;
  /** Unit direction of travel. */
  ux: number;
  uy: number;
  speed: number;
  length: number;
  /** Elapsed time and total lifetime in seconds. */
  life: number;
  ttl: number;
  tinted: boolean;
}

/** How hard a full-speed scroll pushes the field, as a multiple of base rate. */
const MAX_BOOST = 3.4;
/** Scroll velocity (px/s) that counts as full speed. */
const BOOST_REFERENCE = 720;
const MAX_SHOOTERS = 4;
const NEUTRAL = "255, 255, 255";

/** `#rgb` / `#rrggbb` → `r, g, b`. Falls back to neutral white. */
function rgbTriplet(value: string | undefined, fallback = NEUTRAL): string {
  const match = /^#(?:([0-9a-f])([0-9a-f])([0-9a-f])|([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2}))$/i.exec(
    (value ?? "").trim(),
  );
  if (!match) return fallback;
  if (match[1]) {
    return `${parseInt(match[1] + match[1], 16)}, ${parseInt(match[2] + match[2], 16)}, ${parseInt(match[3] + match[3], 16)}`;
  }
  return `${parseInt(match[4], 16)}, ${parseInt(match[5], 16)}, ${parseInt(match[6], 16)}`;
}

export function SpaceBackdrop({ accent, glow, animated = true }: SpaceBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef({ accent: rgbTriplet(accent), glow: rgbTriplet(glow) });
  const animatedRef = useRef(animated);

  useEffect(() => {
    paletteRef.current = { accent: rgbTriplet(accent), glow: rgbTriplet(glow) };
  }, [accent, glow]);

  useEffect(() => {
    animatedRef.current = animated;
  }, [animated]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const compact = window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let width = 0;
    let height = 0;
    let docHeight = 0;
    let stars: Star[] = [];
    const shooters: Shooter[] = [];

    const seedStars = () => {
      const target = ((width * height) / 9000) * (compact ? 0.6 : 1);
      const count = Math.min(Math.max(Math.round(target), 90), 260);
      stars = new Array<Star>(count);
      for (let i = 0; i < count; i += 1) {
        const depth = 0.25 + Math.random() * 0.75;
        stars[i] = {
          x: Math.random() * width,
          y: Math.random() * height,
          depth,
          size: 0.45 + depth * 1.15,
          alpha: 0.22 + depth * 0.62,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.6,
        };
      }
    };

    const resize = () => {
      width = Math.max(window.innerWidth, 1);
      height = Math.max(window.innerHeight, 1);
      // Cached so the render loop can work out scroll progress without ever
      // touching documentElement.scrollHeight (a forced layout) per frame.
      docHeight = document.documentElement.scrollHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
    };
    resize();

    const spawnShooter = () => {
      // Falls steeply, leaning left or right, like a real meteor.
      const theta = (Math.PI / 180) * (52 + Math.random() * 30);
      const direction = Math.random() < 0.5 ? -1 : 1;
      const speed = 210 + Math.random() * 250;
      shooters.push({
        x: -0.25 * width + Math.random() * 1.5 * width,
        y: -(0.05 + Math.random() * 0.35) * height,
        ux: Math.cos(theta) * direction,
        uy: Math.sin(theta),
        speed,
        length: speed * (0.1 + Math.random() * 0.1),
        life: 0,
        ttl: 2 + Math.random() * 1.4,
        tinted: Math.random() < 0.34,
      });
    };

    const paintStar = (star: Star, time: number, scrollY: number, boost: number, visibility: number) => {
      // The canvas is fixed, so the field drifts against the content as it scrolls.
      const drift = (((scrollY * star.depth * 0.05) % height) + height) % height;
      const x = star.x;
      const y = (((star.y - drift) % height) + height) % height;
      const twinkle = animatedRef.current ? 0.62 + 0.38 * Math.sin(time * star.speed + star.phase) : 0.85;
      // Daylight washes the sky out and only a few stars survive; the deeper
      // the visitor scrolls — the further the Sun has set — the more the sky
      // fills in. Matches the 3D star field, which ramps on the same curve.
      const alpha = star.alpha * twinkle * visibility;
      if (alpha <= 0.01) return;

      const streak = boost * star.depth * 16;
      context.globalAlpha = alpha;
      if (streak < 1.2) {
        context.beginPath();
        context.arc(x, y, star.size, 0, Math.PI * 2);
        context.fill();
        return;
      }
      // A fast scroll stretches stars into motion-blurred trails.
      context.lineWidth = star.size;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + streak);
      context.stroke();
    };

    const paintShooter = (shooter: Shooter, dt: number, boost: number) => {
      const rate = 1 + boost * 2.6;
      shooter.life += dt;
      shooter.x += shooter.ux * shooter.speed * rate * dt;
      shooter.y += shooter.uy * shooter.speed * rate * dt;

      const progress = Math.min(Math.max(shooter.life / shooter.ttl, 0), 1);
      // Fade in quickly, hold, fade out.
      const alpha = Math.sin(progress * Math.PI) ** 0.6;
      const trail = shooter.length * (1 + boost * 1.1);
      const tailX = shooter.x - shooter.ux * trail;
      const tailY = shooter.y - shooter.uy * trail;

      const palette = paletteRef.current;
      const core = shooter.tinted ? palette.accent : NEUTRAL;
      const gradient = context.createLinearGradient(shooter.x, shooter.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(${core}, ${alpha})`);
      gradient.addColorStop(0.22, `rgba(${palette.glow}, ${alpha * 0.5})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      context.globalAlpha = 1;
      context.strokeStyle = gradient;
      context.lineWidth = 1.8;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(shooter.x, shooter.y);
      context.lineTo(tailX, tailY);
      context.stroke();

      context.fillStyle = `rgba(${core}, ${alpha})`;
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(shooter.x, shooter.y, 1.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha * 0.28;
      context.beginPath();
      context.arc(shooter.x, shooter.y, 5.5, 0, Math.PI * 2);
      context.fill();
    };

    const paintSky = (time: number, dt: number, scrollY: number, boost: number) => {
      // Same 0.15 → 1 ramp the 3D scene uses, driven by page scroll position.
      const max = (docHeight || 0) - height;
      const visibility = 0.15 + (max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0) * 0.85;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      context.fillStyle = "rgba(255, 255, 255, 1)";
      context.strokeStyle = "rgba(255, 255, 255, 1)";

      for (let i = 0; i < stars.length; i += 1) {
        paintStar(stars[i], time, scrollY, boost, visibility);
      }

      for (let i = shooters.length - 1; i >= 0; i -= 1) {
        const shooter = shooters[i];
        paintShooter(shooter, dt, boost);
        const spent = shooter.life >= shooter.ttl;
        const gone =
          shooter.y - shooter.length * 3 > height || shooter.x < -0.6 * width || shooter.x > 1.6 * width;
        if (spent || gone) shooters.splice(i, 1);
      }

      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
    };

    /* ── Reduced motion: one calm, static sky ─────────────────── */
    if (!animatedRef.current) {
      paintSky(0, 0, window.scrollY, 0);
      const redraw = () => {
        resize();
        paintSky(0, 0, window.scrollY, 0);
      };
      window.addEventListener("resize", redraw);
      return () => window.removeEventListener("resize", redraw);
    }

    /* ── Animation loop ───────────────────────────────────────── */
    let frame = 0;
    let elapsed = 0;
    let last = performance.now();
    let lastScrollY = window.scrollY;
    let velocity = 0;
    let nextSpawn = 0.7 + Math.random() * 1.8;

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const dt = Math.min(Math.max((now - last) / 1000, 0.001), 0.05);
      last = now;
      elapsed += dt;

      const scrollY = window.scrollY;
      // Smoothed scroll speed, so the field reacts to a flick and settles back.
      const raw = Math.abs(scrollY - lastScrollY) / dt;
      lastScrollY = scrollY;
      velocity += (raw - velocity) * Math.min(1, dt * 7);
      const boost = Math.min(velocity / BOOST_REFERENCE, MAX_BOOST);

      if (shooters.length < MAX_SHOOTERS) {
        nextSpawn -= dt * (1 + boost * 0.9);
        if (nextSpawn <= 0) {
          spawnShooter();
          nextSpawn = 1 + Math.random() * 2.6;
        }
      }

      paintSky(elapsed, dt, scrollY, boost);
    };

    const start = () => {
      last = performance.now();
      lastScrollY = window.scrollY;
      frame = window.requestAnimationFrame(tick);
    };

    const handleVisibility = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden) start();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("resize", resize);
    start();

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resize);
      shooters.length = 0;
    };
  }, []);

  return (
    <div aria-hidden="true" className="space-backdrop">
      <div className="space-nebula" />
      <canvas ref={canvasRef} className="space-canvas" />
      <div className="space-vignette" />
    </div>
  );
}
