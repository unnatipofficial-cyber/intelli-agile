import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ThemePalette } from "@/hooks/use-theme-palette";

/**
 * Hero3DScene — the landing page's WebGL centrepiece.
 *
 * The subject changes with the active appearance theme:
 *   Graphite        → Earth with a satellite in orbit (full colour)
 *   Modern Minimal  → a black hole with an accretion disk
 *   Darkmatter      → a churning Sun with corona and flares
 *
 * Implemented with plain three.js and a requestAnimationFrame loop. Colours are
 * read from the active theme so every subject re-skins with the palette.
 *
 * Fully defensive: if the renderer cannot be created nothing is appended, all
 * geometry/materials are tracked and disposed, and the render loop stops when
 * the hero scrolls out of view or the tab is hidden. The parent (Landing)
 * already guards this with a WebGL check, a Suspense boundary and an error
 * boundary.
 */

export type HeroSubject = "blackhole" | "sun" | "earth";

interface SceneProps {
  palette: ThemePalette;
  /** Celestial subject to build. */
  subject?: HeroSubject;
  /** When false (prefers-reduced-motion) the scene renders a single still frame. */
  animated?: boolean;
}

/** Resting pose so the scene reads well even when nothing is animating. */
const BASE_ROTATION_X = 0.16;
const BASE_ROTATION_Y = 0.35;
const CAMERA_Z = 7.2;

interface SceneQuality {
  /** Multiplier applied to particle counts. */
  particles: number;
  dpr: number;
  antialias: boolean;
}

/**
 * Compact and touch devices get fewer particles, a lower pixel ratio and no
 * MSAA. The 3D layer must never be the reason a phone stutters.
 */
function readQuality(): SceneQuality {
  if (typeof window === "undefined") {
    return { particles: 1, dpr: 1.5, antialias: true };
  }
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const compact = coarse || window.innerWidth < 768;
  return {
    particles: compact ? 0.45 : 1,
    dpr: compact ? 1.25 : 1.6,
    antialias: !compact,
  };
}

type Disposables = Array<{ dispose: () => void }>;

/** Registers a three.js resource so unmounting releases its GPU memory. */
function track<T extends { dispose: () => void }>(bin: Disposables, resource: T): T {
  bin.push(resource);
  return resource;
}

/** Shared soft radial gradient, tinted per-sprite so one texture serves all glows. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.16, "rgba(255,255,255,0.72)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.2)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.045)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Wispy cloud sheet for the Earth, drawn procedurally so there is no asset to load. */
function makeCloudTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < 460; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      // Keep the cloud bands away from the poles so the ice caps stay legible.
      const latitude = Math.abs(y / height - 0.5) * 2;
      if (latitude > 0.86 && Math.random() < 0.75) continue;
      const radius = 14 + Math.random() * 52;
      const alpha = 0.05 + Math.random() * 0.14;
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      for (const offset of [-width, 0, width]) {
        context.beginPath();
        context.arc(x + offset, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

interface SubjectHandle {
  group: THREE.Group;
  /** Advances the subject's own animation (seconds, frame delta). */
  update: (time: number, delta: number) => void;
  /** Re-applies the theme palette without rebuilding the scene. */
  recolor: (palette: ThemePalette) => void;
}

interface BuildContext {
  quality: SceneQuality;
  bin: Disposables;
  glowTexture: THREE.CanvasTexture;
}

/** Tints a ring geometry from a hot inner edge to a cool, fading outer rim. */
function paintRadialRamp(
  geometry: THREE.BufferGeometry,
  inner: number,
  outer: number,
  hot: THREE.Color,
  mid: THREE.Color,
  cool: THREE.Color,
): void {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  const span = Math.max(outer - inner, 1e-4);
  for (let i = 0; i < position.count; i += 1) {
    const radius = Math.hypot(position.getX(i), position.getY(i));
    const t = Math.min(Math.max((radius - inner) / span, 0), 1);
    if (t < 0.5) color.lerpColors(hot, mid, t / 0.5);
    else color.lerpColors(mid, cool, (t - 0.5) / 0.5);
    // Additive blending treats black as invisible, so fading the channels out
    // toward the rim reads exactly like fading to transparent.
    const fade = (1 - t) ** 1.5;
    colors[i * 3] = color.r * fade;
    colors[i * 3 + 1] = color.g * fade;
    colors[i * 3 + 2] = color.b * fade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.getAttribute("color").needsUpdate = true;
}

/* ══════════════════════════════════════════════════════════════════
   Black hole — Modern Minimal
   ══════════════════════════════════════════════════════════════════ */

const DISK_TILT = -Math.PI / 2 + 0.38;

function buildBlackHole(palette: ThemePalette, context: BuildContext): SubjectHandle {
  const { bin, quality } = context;
  const group = new THREE.Group();
  group.scale.setScalar(0.9);

  const hot = new THREE.Color(palette.accentLight);
  const mid = new THREE.Color(palette.accent);
  const cool = new THREE.Color(palette.accentDark);

  /* Event horizon — a pure black sphere. The disk behind it is what gives it shape. */
  const horizon = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(0.95, 48, 32)),
    track(bin, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x000000) })),
  );
  group.add(horizon);

  /* Photon ring hugging the horizon. */
  const ringMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: hot.clone(),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const photon = new THREE.Mesh(track(bin, new THREE.TorusGeometry(1.035, 0.013, 10, 180)), ringMaterial);
  group.add(photon);

  /* Accretion disk: a hot inner annulus, the main disk, and a wider lensed
     second image above it — the double rim a black hole is known for. */
  const disks: Array<{ geometry: THREE.BufferGeometry; inner: number; outer: number }> = [];
  const makeDisk = (
    inner: number,
    outer: number,
    tilt: number,
    opacity: number,
  ): THREE.Mesh => {
    const geometry = track(bin, new THREE.RingGeometry(inner, outer, 168, 2));
    paintRadialRamp(geometry, inner, outer, hot, mid, cool);
    disks.push({ geometry, inner, outer });
    const mesh = new THREE.Mesh(
      geometry,
      track(
        bin,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    mesh.rotation.set(tilt, 0, 0);
    group.add(mesh);
    return mesh;
  };
  // Bright inner annulus hugging the horizon — the horizon itself occludes the rest.
  makeDisk(0.97, 1.44, DISK_TILT, 0.65);
  makeDisk(1.06, 2.9, DISK_TILT, 0.95);
  makeDisk(1.2, 2.65, DISK_TILT + 0.34, 0.4);

  /* Infalling dust — the disk's actual motion, since a ring is rotationally symmetric. */
  const dustCount = Math.max(60, Math.round(260 * quality.particles));
  const dustGeometry = track(bin, new THREE.BufferGeometry());
  const dustPositions = new Float32Array(dustCount * 3);
  const dustColors = new Float32Array(dustCount * 3);
  const dustRadius = new Float32Array(dustCount);
  const dustAngle = new Float32Array(dustCount);
  const dustRise = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    dustRadius[i] = 1.15 + Math.random() ** 0.75 * 1.7;
    dustAngle[i] = Math.random() * Math.PI * 2;
    dustRise[i] = (Math.random() - 0.5) * 0.18;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
  const dustMaterial = track(
    bin,
    new THREE.PointsMaterial({
      size: 0.038,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.rotation.x = DISK_TILT;
  group.add(dust);

  const paintDust = (accent: THREE.Color, light: THREE.Color) => {
    const color = new THREE.Color();
    for (let i = 0; i < dustCount; i += 1) {
      const t = Math.min(Math.max((dustRadius[i] - 1.15) / 1.7, 0), 1);
      color.lerpColors(light, accent, t);
      const fade = (1 - t * 0.8) ** 1.4;
      dustColors[i * 3] = color.r * fade;
      dustColors[i * 3 + 1] = color.g * fade;
      dustColors[i * 3 + 2] = color.b * fade;
    }
    dustGeometry.getAttribute("color").needsUpdate = true;
  };
  paintDust(mid, hot);

  const update = (time: number) => {
    const position = dustGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i += 1) {
      const radius = dustRadius[i];
      // Keplerian-ish shear: the inner dust laps the outer dust.
      const angle = dustAngle[i] + time * (1.5 / radius ** 1.5);
      position.setXYZ(
        i,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        dustRise[i] * Math.sin(time * 0.7 + i * 0.4),
      );
    }
    position.needsUpdate = true;

    group.rotation.z = Math.sin(time * 0.05) * 0.06;
    photon.scale.setScalar(1 + Math.sin(time * 0.9) * 0.02);
    ringMaterial.opacity = 0.85 + Math.sin(time * 1.6) * 0.1;
  };

  const recolor = (next: ThemePalette) => {
    const nextHot = new THREE.Color(next.accentLight);
    const nextMid = new THREE.Color(next.accent);
    const nextCool = new THREE.Color(next.accentDark);
    ringMaterial.color.copy(nextHot);
    for (const disk of disks) {
      paintRadialRamp(disk.geometry, disk.inner, disk.outer, nextHot, nextMid, nextCool);
    }
    paintDust(nextMid, nextHot);
  };

  return { group, update, recolor };
}

/* ══════════════════════════════════════════════════════════════════
   Sun — Darkmatter
   ══════════════════════════════════════════════════════════════════ */

function buildSun(palette: ThemePalette, context: BuildContext): SubjectHandle {
  const { bin, glowTexture, quality } = context;
  const group = new THREE.Group();

  const accent = new THREE.Color(palette.accent);
  const light = new THREE.Color(palette.accentLight);
  const glow = new THREE.Color(palette.glow);

  /* Photosphere. Flat-shaded so the boiling displacement reads as solar plasma
     rather than a soft sphere — and so normals never need recomputing. */
  const coreGeometry = track(bin, new THREE.SphereGeometry(1.6, 46, 32));
  const corePosition = coreGeometry.getAttribute("position") as THREE.BufferAttribute;
  const coreBase = Float32Array.from(corePosition.array as Float32Array);
  const coreMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      color: light.clone(),
      emissive: accent.clone(),
      emissiveIntensity: 1.25,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    }),
  );
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);

  /* Inner heat shell — a little extra glow over the surface. */
  const heatMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: glow.clone(),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const heat = new THREE.Mesh(track(bin, new THREE.SphereGeometry(1.68, 32, 22)), heatMaterial);
  heat.scale.setScalar(1.02);
  group.add(heat);

  /* Corona: billboard glow plus a back-side limb halo. */
  const coronaMaterial = track(
    bin,
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: glow.clone(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const corona = new THREE.Sprite(coronaMaterial);
  corona.scale.setScalar(4.8);
  // The corona is a bloom, so it deliberately draws over the photosphere.
  corona.material.depthTest = false;
  corona.renderOrder = -1;
  group.add(corona);

  const limbMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: light.clone(),
      transparent: true,
      opacity: 0.32,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const limb = new THREE.Mesh(track(bin, new THREE.SphereGeometry(1.78, 32, 22)), limbMaterial);
  group.add(limb);

  /* Prominences: points that breathe in and out of the surface. */
  const flareCount = Math.max(36, Math.round(140 * quality.particles));
  const flareGeometry = track(bin, new THREE.BufferGeometry());
  const flarePositions = new Float32Array(flareCount * 3);
  const flareDirections: THREE.Vector3[] = [];
  const flarePhases = new Float32Array(flareCount);
  for (let i = 0; i < flareCount; i += 1) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    flareDirections.push(
      new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) * 0.85,
        Math.sin(phi) * Math.sin(theta),
      ).normalize(),
    );
    flarePhases[i] = Math.random() * Math.PI * 2;
  }
  flareGeometry.setAttribute("position", new THREE.BufferAttribute(flarePositions, 3));
  const flareMaterial = track(
    bin,
    new THREE.PointsMaterial({
      size: 0.075,
      color: light.clone(),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const flares = new THREE.Points(flareGeometry, flareMaterial);
  group.add(flares);

  const update = (time: number) => {
    /* Boiling surface — displacement is a pure function of the original
       position, so duplicated vertices stay welded together. */
    for (let i = 0; i < coreBase.length; i += 3) {
      const x = coreBase[i];
      const y = coreBase[i + 1];
      const z = coreBase[i + 2];
      const noise =
        Math.sin(x * 2.1 + time * 1.15) * Math.cos(y * 1.9 - time * 0.85) * Math.sin(z * 2.4 + time * 1.5);
      const swell = 1 + noise * 0.035;
      corePosition.setXYZ(i / 3, x * swell, y * swell, z * swell);
    }
    corePosition.needsUpdate = true;

    const position = flareGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < flareCount; i += 1) {
      const direction = flareDirections[i];
      const radius = 1.62 + 0.3 * (0.5 + 0.5 * Math.sin(time * 0.9 + flarePhases[i]));
      position.setXYZ(i, direction.x * radius, direction.y * radius, direction.z * radius);
    }
    position.needsUpdate = true;

    core.rotation.y = time * 0.05;
    core.scale.setScalar(1 + Math.sin(time * 0.6) * 0.012);
    heat.scale.setScalar(1.02 + Math.sin(time * 1.4) * 0.012);
    corona.scale.setScalar(4.8 * (1 + Math.sin(time * 0.5) * 0.025));
    coreMaterial.emissiveIntensity = 1.25 + Math.sin(time * 1.7) * 0.16;
    flareMaterial.opacity = 0.7 + Math.sin(time * 0.8) * 0.18;
  };

  const recolor = (next: ThemePalette) => {
    coreMaterial.color.set(next.accentLight);
    coreMaterial.emissive.set(next.accent);
    heatMaterial.color.set(next.glow);
    coronaMaterial.color.set(next.glow);
    limbMaterial.color.set(next.accentLight);
    flareMaterial.color.set(next.accentLight);
  };

  return { group, update, recolor };
}

/* ══════════════════════════════════════════════════════════════════
   Earth + satellite — Graphite
   ══════════════════════════════════════════════════════════════════ */

const EARTH_RADIUS = 1.42;
const ORBIT_RADIUS = 2.32;
const AXIAL_TILT = 0.38;

/** Cheap continuous field that blobs into believable continents. */
function continents(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 1.75 + 0.8) * Math.cos(y * 2.1 - 0.4) * Math.sin(z * 1.3 + 1.7) +
    Math.sin(x * 3.15 - 1.2) * Math.sin(z * 2.65 + 0.6) * 0.55 +
    Math.cos(y * 3.4 + 2.1) * Math.cos(x * 2.25 - 0.3) * 0.45
  );
}

/** Paints the sphere's vertices with oceans, land, deserts and ice caps. */
function paintEarth(geometry: THREE.BufferGeometry, radius: number): void {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);

  const deep = new THREE.Color("#0a2c5e");
  const ocean = new THREE.Color("#12508f");
  const shelf = new THREE.Color("#1f77b0");
  const grass = new THREE.Color("#2f7d3c");
  const forest = new THREE.Color("#4f9b4a");
  const highland = new THREE.Color("#8a8a52");
  const desert = new THREE.Color("#c2a469");
  const ice = new THREE.Color("#e8f2f8");

  const color = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i) / radius;
    const y = position.getY(i) / radius;
    const z = position.getZ(i) / radius;
    const latitude = Math.abs(y);

    const value = continents(x, y, z);
    if (value < -0.25) color.copy(deep);
    else if (value < 0.02) color.copy(ocean);
    else if (value < 0.14) color.copy(shelf);
    else if (value < 0.42) color.lerpColors(grass, forest, (value - 0.14) / 0.28);
    else if (value < 0.68) color.lerpColors(forest, highland, (value - 0.42) / 0.26);
    else color.lerpColors(highland, desert, Math.min(1, (value - 0.68) / 0.32));

    // Dry bands just off the equator, mirroring the real thing a little.
    if (value > 0.14 && latitude > 0.18 && latitude < 0.42) color.lerp(desert, 0.35);
    // Sea ice and polar caps.
    if (latitude > 0.84) color.lerp(ice, Math.min(1, (latitude - 0.84) / 0.12));
    else if (value < 0.02 && latitude > 0.72) color.lerp(ice, 0.45);

    // Faint variation so large areas never look like flat paint.
    const grain = 0.94 + 0.06 * Math.sin(x * 21 + y * 13 + z * 17);
    colors[i * 3] = color.r * grain;
    colors[i * 3 + 1] = color.g * grain;
    colors[i * 3 + 2] = color.b * grain;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function buildEarth(palette: ThemePalette, context: BuildContext): SubjectHandle {
  const { bin, quality } = context;
  const group = new THREE.Group();

  const atmosphere = new THREE.Color(palette.accentLight);

  /* Axial tilt group so the planet, clouds and atmosphere share one axis. */
  const axis = new THREE.Group();
  axis.rotation.z = AXIAL_TILT;
  group.add(axis);

  const segments = quality.particles < 1 ? [48, 32] : [72, 48];
  const earthGeometry = track(bin, new THREE.SphereGeometry(EARTH_RADIUS, segments[0], segments[1]));
  paintEarth(earthGeometry, EARTH_RADIUS);
  const earthMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const earth = new THREE.Mesh(earthGeometry, earthMaterial);
  axis.add(earth);

  /* Cloud sheet, drawn procedurally. */
  const cloudTexture = track(bin, makeCloudTexture());
  const cloudMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    }),
  );
  const clouds = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(EARTH_RADIUS * 1.015, segments[0], segments[1])),
    cloudMaterial,
  );
  axis.add(clouds);

  /* Atmosphere rim — additive back-side shell, the classic cheap limb glow.
     Deliberately a real atmospheric blue rather than the theme accent: the
     planet has to read as Earth, in colour, on every theme. */
  const atmosphereMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#5f9dff"),
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const shell = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(EARTH_RADIUS * 1.14, 40, 26)),
    atmosphereMaterial,
  );
  axis.add(shell);

  /* Orbit plane: ring + satellite, tilted well off the planet's axis. */
  const orbit = new THREE.Group();
  orbit.rotation.set(0.55, 0, -0.28);
  group.add(orbit);

  const orbitRingMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: atmosphere.clone(),
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const orbitRing = new THREE.Mesh(track(bin, new THREE.RingGeometry(ORBIT_RADIUS, ORBIT_RADIUS + 0.012, 160)), orbitRingMaterial);
  // The satellite travels in the group's XZ plane, so the guide lies there too.
  orbitRing.rotation.x = -Math.PI / 2;
  orbit.add(orbitRing);

  /* The satellite itself — deliberately colourful, not a grey blob. */
  const satellite = new THREE.Group();
  const bodyMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#dfe4ec"), roughness: 0.35, metalness: 0.85 }),
  );
  const panelMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3b56c8"),
      emissive: new THREE.Color("#1b2a7a"),
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.35,
    }),
  );
  const trimMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f0a24a"),
      emissive: new THREE.Color("#c46a12"),
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );

  const body = new THREE.Mesh(track(bin, new THREE.BoxGeometry(0.1, 0.1, 0.16)), bodyMaterial);
  satellite.add(body);

  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(track(bin, new THREE.BoxGeometry(0.34, 0.01, 0.17)), panelMaterial);
    panel.position.x = side * 0.24;
    satellite.add(panel);
    // Gold foil hinge between body and wing.
    const hinge = new THREE.Mesh(track(bin, new THREE.BoxGeometry(0.03, 0.03, 0.05)), trimMaterial);
    hinge.position.x = side * 0.1;
    satellite.add(hinge);
  }

  const dish = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    track(bin, new THREE.MeshStandardMaterial({ color: new THREE.Color("#f4f6fa"), roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide })),
  );
  dish.rotation.x = -Math.PI / 2;
  dish.position.z = 0.1;
  satellite.add(dish);

  const antenna = new THREE.Mesh(
    track(bin, new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6)),
    track(bin, new THREE.MeshStandardMaterial({ color: new THREE.Color("#b9c0cc"), roughness: 0.5, metalness: 0.6 })),
  );
  antenna.rotation.z = Math.PI / 2;
  antenna.position.set(-0.16, 0.06, 0);
  satellite.add(antenna);

  satellite.scale.setScalar(1.75);
  orbit.add(satellite);

  /* An orbiting "busy" light trail behind the satellite. */
  const trailCount = Math.max(14, Math.round(46 * quality.particles));
  const trailGeometry = track(bin, new THREE.BufferGeometry());
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
  const trailMaterial = track(
    bin,
    new THREE.PointsMaterial({
      size: 0.05,
      color: new THREE.Color("#8fd6ff"),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const trail = new THREE.Points(trailGeometry, trailMaterial);
  orbit.add(trail);

  let orbitAngle = 0;

  const update = (time: number, delta: number) => {
    // Spin the planet slowly, the clouds a touch faster.
    earth.rotation.y = time * 0.055;
    clouds.rotation.y = time * 0.072;

    orbitAngle += delta * 0.42;
    satellite.position.set(Math.cos(orbitAngle) * ORBIT_RADIUS, 0, -Math.sin(orbitAngle) * ORBIT_RADIUS);
    // Keep the wings pointed along the direction of travel.
    satellite.rotation.y = -orbitAngle;
    satellite.rotation.x = Math.sin(time * 0.9) * 0.18;

    const position = trailGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < trailCount; i += 1) {
      const angle = orbitAngle - (i + 1) * 0.035;
      const radius = ORBIT_RADIUS - i * 0.004;
      position.setXYZ(
        i,
        Math.cos(angle) * radius,
        Math.sin(angle * 3) * 0.03,
        -Math.sin(angle) * radius,
      );
    }
    position.needsUpdate = true;
    trailMaterial.opacity = 0.55 + Math.sin(time * 1.6) * 0.2;

    cloudMaterial.opacity = 0.5 + Math.sin(time * 0.35) * 0.06;
    atmosphereMaterial.opacity = 0.42 + Math.sin(time * 0.8) * 0.07;
  };

  const recolor = (next: ThemePalette) => {
    // The planet and its satellite keep their own colours; only the orbit guide
    // follows the theme, so each theme still reads as itself.
    orbitRingMaterial.color.set(next.accentLight);
  };

  return { group, update, recolor };
}

/* ══════════════════════════════════════════════════════════════════
   Scene host
   ══════════════════════════════════════════════════════════════════ */

function buildSubject(subject: HeroSubject, palette: ThemePalette, context: BuildContext): SubjectHandle {
  if (subject === "blackhole") return buildBlackHole(palette, context);
  if (subject === "sun") return buildSun(palette, context);
  return buildEarth(palette, context);
}

interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  subject: SubjectHandle;
  glowLight: THREE.PointLight;
  rimLight: THREE.PointLight;
  disposables: Disposables;
}

export default function Hero3DScene({ palette, subject = "earth", animated = true }: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const handles = useRef<SceneHandles | null>(null);
  const animatedRef = useRef(animated);
  const paletteRef = useRef(palette);

  useEffect(() => {
    animatedRef.current = animated;
  }, [animated]);

  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  /* ── Build the scene (once per subject) ───────────────────── */
  useEffect(() => {
    const hostEl = host.current;
    if (!hostEl) return;

    const quality = readQuality();
    const currentPalette = paletteRef.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: quality.antialias,
        powerPreference: "high-performance",
      });
    } catch (error) {
      console.warn("[landing] WebGL unavailable, keeping the CSS backdrop", error);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    hostEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_Z);

    const disposables: Disposables = [];
    const glowTexture = track(disposables, makeGlowTexture());

    const root = new THREE.Group();
    root.rotation.set(BASE_ROTATION_X, BASE_ROTATION_Y, 0);
    scene.add(root);

    /* Lights (three r155+ uses physically-correct units) */
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);
    const glowLight = new THREE.PointLight(new THREE.Color(currentPalette.glow), 45);
    glowLight.position.set(-6, -4, -5);
    scene.add(glowLight);
    const rimLight = new THREE.PointLight(new THREE.Color(currentPalette.accentLight), 30);
    rimLight.position.set(4, -5, 3);
    scene.add(rimLight);

    const subjectHandle = buildSubject(subject, currentPalette, {
      quality,
      bin: disposables,
      glowTexture,
    });
    root.add(subjectHandle.group);

    handles.current = {
      renderer,
      scene,
      camera,
      root,
      subject: subjectHandle,
      glowLight,
      rimLight,
      disposables,
    };

    /* ── Sizing ─────────────────────────────────────────────── */
    const resize = () => {
      const { clientWidth, clientHeight } = hostEl;
      const width = Math.max(clientWidth, 1);
      const height = Math.max(clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Narrow columns (portrait phones, tight grid cells) get a smaller subject
      // so nothing is ever clipped by the frame.
      root.scale.setScalar(Math.min(Math.max(camera.aspect, 0.78), 1.05));
      renderer.render(scene, camera);
    };
    resize();

    /* ── Pointer parallax ───────────────────────────────────── */
    const pointer = { x: 0, y: 0 };
    const handlePointerMove = (event: PointerEvent) => {
      const rect = hostEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };
    const handlePointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    hostEl.addEventListener("pointermove", handlePointerMove);
    hostEl.addEventListener("pointerleave", handlePointerLeave);

    /* ── Render loop ────────────────────────────────────────── */
    const clock = new THREE.Clock();
    let elapsed = 0;
    let frame = 0;
    let running = false;

    // Cached via a passive listener so the render loop never forces a layout read.
    let scrollY = window.scrollY;
    const handleScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    const renderFrame = (delta: number) => {
      if (animatedRef.current) elapsed += delta;
      const t = elapsed;

      // Scroll-linked depth: the subject recedes and turns as the hero leaves
      // the viewport, handing off to the content below.
      const depth = Math.min(Math.max(scrollY / (window.innerHeight || 1), 0), 1.2);

      root.rotation.y += (BASE_ROTATION_Y + pointer.x * 0.38 + depth * 0.9 - root.rotation.y) * 0.05;
      root.rotation.x += (BASE_ROTATION_X - pointer.y * 0.26 - root.rotation.x) * 0.05;
      root.position.z = -depth * 2.6;

      subjectHandle.update(t, delta);

      renderer.render(scene, camera);
    };

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      // Clamp delta so a backgrounded tab cannot jump the animation on return.
      renderFrame(Math.min(clock.getDelta(), 0.05));
    };

    const start = () => {
      if (running) return;
      running = true;
      clock.getDelta();
      tick();
    };

    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };

    /* ── Pause when scrolled out of view / tab hidden ───────── */
    let inView = true;
    const sync = () => {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (animatedRef.current && inView && !hidden) {
        start();
      } else {
        stop();
        renderFrame(0);
      }
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          sync();
        },
        { rootMargin: "120px" },
      );
      observer.observe(hostEl);
    }
    document.addEventListener("visibilitychange", sync);

    const handleResize = () => {
      resize();
      if (!(animatedRef.current && inView)) renderFrame(0);
    };
    window.addEventListener("resize", handleResize);

    sync();

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      hostEl.removeEventListener("pointermove", handlePointerMove);
      hostEl.removeEventListener("pointerleave", handlePointerLeave);
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      handles.current = null;
    };
    // Rebuilding on subject change is intentional: each theme has a different
    // body. Theme colours are applied in place by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  /* ── Re-skin on theme change ──────────────────────────────── */
  useEffect(() => {
    const scene = handles.current;
    if (!scene) return;
    scene.glowLight.color.set(palette.glow);
    scene.rimLight.color.set(palette.accentLight);
    scene.subject.recolor(palette);
    scene.renderer.render(scene.scene, scene.camera);
  }, [palette]);

  useEffect(() => {
    const scene = handles.current;
    if (!scene || animated) return;
    // Reduced motion: settle on a clean still frame.
    scene.renderer.render(scene.scene, scene.camera);
  }, [animated]);

  return <div ref={host} className="h-full w-full" />;
}
