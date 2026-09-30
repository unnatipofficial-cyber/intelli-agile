import { useEffect, useRef } from "react";
import { animate, onScroll } from "animejs";
import * as THREE from "three";
import type { RefObject } from "react";
import type { ThemePalette } from "@/hooks/use-theme-palette";
import {
  getEarthMaps,
  getGasGiantTexture,
  getGlowTexture,
  getPanelTexture,
  getRingTexture,
  getRockyTexture,
  getSunTexture,
} from "./sceneTextures";

/**
 * Hero3DScene — the landing page's WebGL centrepiece.
 *
 * The subject changes with the active appearance theme:
 *   Graphite        → Earth (textured, with night lights, clouds and a
 *                     Fresnel atmosphere) orbited by a satellite
 *   Modern Minimal  → a black hole with a shader-driven, Doppler-beamed
 *                     accretion disk and lensed light arcs
 *   Darkmatter      → a whole solar system: the Sun, six planets on their
 *                     orbits, Saturn's rings and an asteroid belt
 *
 * Animation is a three.js render loop driven by two anime.js tweens:
 *   • an entrance timeline that scales and rolls each subject into place
 *     whenever the scene mounts or the theme changes
 *   • a linear ScrollObserver that rolls the subject as the hero leaves
 * All planet textures are procedural (see sceneTextures) and cached, so a
 * theme switch never re-generates them.
 *
 * Defensive throughout: a failed renderer appends nothing, everything created
 * is disposed on unmount, and the loop stops when the hero leaves the viewport
 * or the tab is hidden. Landing already wraps this in a WebGL check, Suspense
 * and an error boundary.
 */

export type HeroSubject = "blackhole" | "solar" | "earth";

interface SceneProps {
  palette: ThemePalette;
  /** Celestial subject to build. */
  subject?: HeroSubject;
  /** When false (prefers-reduced-motion) the scene renders a single still frame. */
  animated?: boolean;
  /**
   * Element whose scroll span drives the entrance. The cinematic camera
   * journey is driven by full-page progress, so this is only used as the
   * anime.js ScrollObserver target for the subject's entrance roll.
   */
  scrollTarget?: RefObject<HTMLElement | null>;
}

/** The camera keyframes that make up the single continuous orbital journey. */
const CAMERA_KEYFRAMES: Array<{
  progress: number;
  position: [number, number, number];
  rotation: [number, number, number];
}> = [
  { progress: 0.00, position: [0, 0.15, 6.2], rotation: [0, 0, 0] },
  { progress: 0.33, position: [2.4, 0.3, 5.1], rotation: [-0.02, 0.32, 0.04] },
  { progress: 0.66, position: [3.5, 0.8, 3.7], rotation: [-0.08, 0.72, 0.08] },
  { progress: 1.00, position: [1.3, 1.7, 4.2], rotation: [-0.35, 0.4, 0.05] },
];

/**
 * One subject moves its camera through the four keyframes as the page scrolls.
 * Graphite Earth is the only subject that uses it — the other themes keep the
 * old resting pose, so the active change is scoped to the graphite landing page.
 */
const IS_EARTH_CAMERA = (subject: HeroSubject) => subject === "earth";

/**
 * Key-light / Sun orbit — one continuous arc, no resets.
 *
 * The Sun rides a single sweep so the four states fall out of the geometry
 * rather than being faked:
 *   progress 0.0  the Sun sits slightly toward the camera, so the whole
 *                 visible disc is lit                     → DAYLIGHT
 *   progress 0.33 the Sun is in the screen plane, terminator across the disc
 *                                                     → NIGHT LIMB
 *   progress 0.66 the Sun has swung past, leaving a thin lit crescent
 *                                                          → CRESCENT
 *   progress 1.0  the Sun is behind and below the planet's far side
 *                                           → SUN BELOW HORIZON
 */
function updateSun(progress: number, light: THREE.DirectionalLight): void {
  // Azimuth is measured in the screen plane, from the planet's right limb
  // round to behind its far lower-left side.
  const theta = THREE.MathUtils.lerp(0.35, Math.PI * 1.25, progress);
  const radius = 7;
  // The toward-the-camera bias is what turns a fully lit disc into a half
  // lit one. It fades out inside the first third of the page.
  const front = 1 - THREE.MathUtils.smoothstep(progress, 0, 0.32);
  light.position.set(
    Math.cos(theta) * radius,
    Math.sin(theta) * radius,
    radius * 0.62 * front,
  );
}

interface SceneQuality {
  /** Multiplier applied to particle and instance counts. */
  particles: number;
  dpr: number;
  antialias: boolean;
}

/**
 * Per-frame values shared between the scene host and whichever subject it
 * built. Writing them in one place keeps the sun, the atmosphere, the star
 * field and the planet's city lights all reading the same scroll position.
 */
interface FrameState {
  /** Smoothed full-page scroll progress, 0 at the top and 1 at the bottom. */
  progress: number;
  /** Seconds since the scene started, frozen when animation is disabled. */
  time: number;
  /** World-space unit vector pointing from the planet toward the Sun. */
  sunDirection: THREE.Vector3;
  /** 1 where the Sun is above the horizon, 0 once it has set. */
  daylight: number;
  /** Radians of extra turn accumulated while the pointer has been idle. */
  idleSpin: number;
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

interface SubjectHandle {
  group: THREE.Group;
  /** Advances the subject's own animation (seconds, frame delta, camera). */
  update: (time: number, delta: number, camera: THREE.PerspectiveCamera) => void;
  /** Re-applies the theme palette without rebuilding the scene. */
  recolor: (palette: ThemePalette) => void;
}

interface BuildContext {
  quality: SceneQuality;
  bin: Disposables;
  glowTexture: THREE.CanvasTexture;
  /**
   * Live values the host writes once per frame, before it calls
   * `subject.update`. Subjects read them instead of owning a clock, so scroll
   * position stays the single source of truth for the whole scene.
   */
  frame: FrameState;
  /** The subject may add scene-level lights here (they must not inherit the
   *  subject's rotation, or the lighting would swing with the pointer parallax). */
  scene: THREE.Scene;
}

function addSprite(
  bin: Disposables,
  texture: THREE.Texture,
  color: THREE.ColorRepresentation,
  opacity: number,
  size: number,
  depthTest = true,
): THREE.Sprite {
  const material = track(
    bin,
    new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest,
    }),
  );
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  return sprite;
}

/* ══════════════════════════════════════════════════════════════════
   Black hole — Modern Minimal
   ══════════════════════════════════════════════════════════════════ */

const DISK_TILT = -Math.PI / 2 + 0.38;
const DISK_INNER = 0.97;
const DISK_OUTER = 2.95;

const DISK_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Accretion disk fragment shader.
 *
 * Three things sell it: a radial temperature ramp that whitens at the inner
 * edge, shearing turbulence (inner material laps outer material many times per
 * second) and relativistic beaming — the approaching side of the disk is
 * markedly brighter and bluer than the receding one, which is what makes a
 * black hole look photographed rather than drawn.
 */
const DISK_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  uniform float uSpin;
  uniform float uBeaming;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCool;
  varying vec2 vPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    float r = length(vPos);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float angle = atan(vPos.y, vPos.x);

    // Differential rotation: the inner edge laps the outer edge many times over.
    float shear = angle + uTime * uSpin * (0.6 / (0.12 + t));
    vec2 dir = vec2(cos(shear), sin(shear));

    // Turbulent filaments, sampled in polar space so the seam is invisible.
    float streak = vnoise(dir * (5.0 + t * 7.0) + vec2(0.0, t * 9.0));
    streak = 0.5 + 0.5 * vnoise(dir * (13.0 - t * 6.0) - vec2(t * 4.0, 0.0)) * 0.6 + streak * 0.4;

    // Temperature ramp: white-hot rim, then the accent, then the cool edge.
    vec3 color = mix(uHot, uMid, smoothstep(0.0, 0.5, t));
    color = mix(color, uCool, smoothstep(0.5, 1.0, t));
    color = mix(color, vec3(1.0), pow(1.0 - t, 8.0) * 0.75);

    // Relativistic beaming: one side approaches, so it wins.
    float beam = 1.0 + uBeaming * cos(angle);

    float profile = pow(1.0 - t, 1.7);
    float intensity = profile * streak * beam * uOpacity;

    gl_FragColor = vec4(color * intensity, 1.0);
  }
`;

function buildBlackHole(palette: ThemePalette, context: BuildContext): SubjectHandle {
  const { bin, quality } = context;
  const group = new THREE.Group();
  group.scale.setScalar(0.9);

  const hot = new THREE.Color(palette.accentLight);
  const mid = new THREE.Color(palette.accent);
  const cool = new THREE.Color(palette.accentDark);

  /* Event horizon — pure black. The disk behind it is what gives it shape. */
  const horizon = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(0.96, 48, 32)),
    track(bin, new THREE.MeshBasicMaterial({ color: 0x000000 })),
  );
  group.add(horizon);

  /* Photon ring: a hard bright edge plus a softer halo. */
  const photonMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: hot.clone(),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const photon = new THREE.Mesh(track(bin, new THREE.TorusGeometry(1.02, 0.012, 10, 180)), photonMaterial);
  group.add(photon);

  const haloMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: hot.clone(),
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const halo = new THREE.Mesh(track(bin, new THREE.TorusGeometry(1.06, 0.05, 10, 160)), haloMaterial);
  group.add(halo);

  /* Lensed light arcs: the far side of the disk, bent over the top and under
     the bottom of the hole. This is the single detail that reads as "black hole". */
  const arcMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: hot.clone(),
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  for (const [radius, tube, flip] of [
    [1.05, 0.055, false],
    [1.14, 0.03, false],
    [1.02, 0.04, true],
  ] as const) {
    const arc = new THREE.Mesh(track(bin, new THREE.TorusGeometry(radius, tube, 10, 120, Math.PI)), arcMaterial);
    if (flip) arc.rotation.z = Math.PI;
    group.add(arc);
  }

  /* The disk itself. */
  const diskUniforms = {
    uTime: { value: 0 },
    uInner: { value: DISK_INNER },
    uOuter: { value: DISK_OUTER },
    uOpacity: { value: 0.95 },
    uSpin: { value: 1.6 },
    uBeaming: { value: 0.55 },
    uHot: { value: hot.clone() },
    uMid: { value: mid.clone() },
    uCool: { value: cool.clone() },
  };
  const diskMaterial = track(
    bin,
    new THREE.ShaderMaterial({
      uniforms: diskUniforms,
      vertexShader: DISK_VERTEX,
      fragmentShader: DISK_FRAGMENT,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const disk = new THREE.Mesh(track(bin, new THREE.RingGeometry(DISK_INNER, DISK_OUTER, 220, 3)), diskMaterial);
  disk.rotation.x = DISK_TILT;
  group.add(disk);

  /* A fainter, wider second image of the disk, tilted the other way — the
     halo you get when the disk wraps behind the hole. */
  const lensedUniforms = {
    // Shares the clock and colours with the main disk on purpose: both must
    // shear at the same rate and shift together when the theme changes.
    ...diskUniforms,
    uOuter: { value: DISK_OUTER * 0.9 },
    uOpacity: { value: 0.34 },
    uBeaming: { value: 0.35 },
  };
  const lensedMaterial = track(
    bin,
    new THREE.ShaderMaterial({
      uniforms: lensedUniforms,
      vertexShader: DISK_VERTEX,
      fragmentShader: DISK_FRAGMENT,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const lensed = new THREE.Mesh(track(bin, new THREE.RingGeometry(DISK_INNER, DISK_OUTER * 0.9, 200, 2)), lensedMaterial);
  lensed.rotation.x = DISK_TILT + 0.3;
  group.add(lensed);

  /* Infalling dust — the disk's actual motion. */
  const dustCount = Math.max(70, Math.round(300 * quality.particles));
  const dustGeometry = track(bin, new THREE.BufferGeometry());
  const dustPositions = new Float32Array(dustCount * 3);
  const dustColors = new Float32Array(dustCount * 3);
  const dustRadius = new Float32Array(dustCount);
  const dustAngle = new Float32Array(dustCount);
  const dustRise = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    dustRadius[i] = DISK_INNER + 0.18 + Math.random() ** 0.7 * 1.7;
    dustAngle[i] = Math.random() * Math.PI * 2;
    dustRise[i] = (Math.random() - 0.5) * 0.16;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
  const dustMaterial = track(
    bin,
    new THREE.PointsMaterial({
      size: 0.042,
      transparent: true,
      opacity: 1,
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
    const colors = dustGeometry.getAttribute("color") as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i += 1) {
      const t = Math.min(Math.max((dustRadius[i] - DISK_INNER) / 1.7, 0), 1);
      color.lerpColors(light, accent, t);
      const fade = (1 - t * 0.75) ** 1.3;
      colors.setXYZ(i, color.r * fade, color.g * fade, color.b * fade);
    }
    colors.needsUpdate = true;
  };
  paintDust(mid, hot);

  const update = (time: number) => {
    const position = dustGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i += 1) {
      const radius = dustRadius[i];
      const angle = dustAngle[i] + time * (1.6 / radius ** 1.5);
      position.setXYZ(
        i,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        dustRise[i] * Math.sin(time * 0.7 + i * 0.4),
      );
    }
    position.needsUpdate = true;

    diskUniforms.uTime.value = time;
    photon.scale.setScalar(1 + Math.sin(time * 0.9) * 0.02);
    haloMaterial.opacity = 0.3 + Math.sin(time * 1.4) * 0.1;
    arcMaterial.opacity = 0.68 + Math.sin(time * 0.8) * 0.12;
    group.rotation.z = Math.sin(time * 0.05) * 0.05;
  };

  const recolor = (next: ThemePalette) => {
    const nextHot = new THREE.Color(next.accentLight);
    const nextMid = new THREE.Color(next.accent);
    const nextCool = new THREE.Color(next.accentDark);
    photonMaterial.color.copy(nextHot);
    haloMaterial.color.copy(nextHot);
    arcMaterial.color.copy(nextHot);
    diskUniforms.uHot.value.copy(nextHot);
    diskUniforms.uMid.value.copy(nextMid);
    diskUniforms.uCool.value.copy(nextCool);
    paintDust(nextMid, nextHot);
  };

  return { group, update, recolor };
}

/* ══════════════════════════════════════════════════════════════════
   Earth + satellite — Graphite
   ══════════════════════════════════════════════════════════════════ */

const EARTH_RADIUS = 1.4;
const ORBIT_RADIUS = 2.3;
const AXIAL_TILT = 0.41;

/**
 * Atmosphere shell.
 *
 * A back-side sphere with a Fresnel rim, brightened on the day side. Additive
 * blending keeps alpha irrelevant, so all the energy is carried in the colour.
 */
const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewV;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewV = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uIntensity;
  uniform float uPower;
  varying vec3 vNormalV;
  varying vec3 vViewV;

  void main() {
    float facing = clamp(abs(dot(normalize(vNormalV), normalize(vViewV))), 0.0, 1.0);
    float rim = pow(1.0 - facing, uPower);
    // The limb only glows where the sun actually reaches it.
    float day = 0.22 + 0.78 * max(dot(normalize(vNormalV), uSunDir), 0.0);
    gl_FragColor = vec4(uColor * rim * day * uIntensity, 1.0);
  }
`;

function buildEarth(palette: ThemePalette, context: BuildContext): SubjectHandle {
  const bin = context.bin;
  const group = new THREE.Group();
  const maps = getEarthMaps();

  /* The host now owns the orbiting Sun (keyLight) for the cinematic journey.
     The Earth itself carries no scene-level light of its own on the graphite
     theme — the host updates the Sun every frame from the page's scroll
     progress, so the day/night terminator genuinely travels across the planet. */

  /* Axial tilt group shared by the planet, clouds and atmosphere. */
  const axis = new THREE.Group();
  axis.rotation.z = AXIAL_TILT;
  group.add(axis);

  /* City lights only belong on the night side. A stock emissiveMap glows
     everywhere, so the emissive term is scaled per fragment by how far the
     surface normal points away from the Sun — the same nightFactor the
     atmosphere shader uses. The Sun direction arrives in view space, which is
     the space `transformedNormal` (and therefore `vNightNormal`) lives in. */
  const earthSunDir = { value: new THREE.Vector3(1, 0, 1) };

  const earthMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      map: maps.map,
      roughnessMap: maps.roughness,
      roughness: 1,
      metalness: 0.04,
      bumpMap: maps.bump,
      bumpScale: 0.016,
      emissiveMap: maps.night,
      emissive: new THREE.Color("#ffd8a8"),
      emissiveIntensity: 1.15,
    }),
  );
  earthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDirView = earthSunDir;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vNightNormal;",
      )
      .replace(
        "#include <defaultnormal_vertex>",
        "#include <defaultnormal_vertex>\n\tvNightNormal = normalize( transformedNormal );",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uSunDirView;\nvarying vec3 vNightNormal;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float nightFactor = 1.0 - max( dot( normalize( vNightNormal ), normalize( uSunDirView ) ), 0.0 );
        totalEmissiveRadiance *= smoothstep( 0.12, 0.72, nightFactor ) * 1.9;`,
      );
  };
  // Without this three reuses a program compiled for other standard materials.
  earthMaterial.customProgramCacheKey = () => "aie-earth-night-lights";
  // Hands the uniform object back to the render loop, which writes it each frame.
  earthMaterial.userData.sunDir = earthSunDir;
  const earth = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(EARTH_RADIUS, 96, 64)),
    earthMaterial,
  );
  axis.add(earth);

  /* Cloud sheet on its own layer, turning a touch faster than the ground. */
  const cloudMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      map: maps.clouds,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    }),
  );
  const clouds = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 72, 48)),
    cloudMaterial,
  );
  axis.add(clouds);

  /* Fresnel atmosphere. */
  const atmosphereMaterial = track(
    bin,
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color("#749cc6") },
        uSunDir: { value: new THREE.Vector3() },
        uIntensity: { value: 1.35 },
        uPower: { value: 3.0 },
      },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const atmosphere = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(EARTH_RADIUS * 1.1, 48, 32)),
    atmosphereMaterial,
  );
  axis.add(atmosphere);

  /* Orbit plane: guide ring + satellite. */
  const orbit = new THREE.Group();
  orbit.rotation.set(0.5, 0, -0.3);
  group.add(orbit);

  const orbitRingMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({
      color: palette.accentLight,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const orbitRing = new THREE.Mesh(
    track(bin, new THREE.RingGeometry(ORBIT_RADIUS, ORBIT_RADIUS + 0.01, 160)),
    orbitRingMaterial,
  );
  orbitRing.rotation.x = -Math.PI / 2;
  orbit.add(orbitRing);

  /* The satellite — deliberately colourful, not a grey blob. */
  const satellite = new THREE.Group();
  const panelTexture = getPanelTexture();
  const bodyMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#e6ebf2"), roughness: 0.3, metalness: 0.9 }),
  );
  const panelMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      map: panelTexture,
      emissiveMap: panelTexture,
      emissive: new THREE.Color("#2c4bd0"),
      emissiveIntensity: 0.55,
      roughness: 0.32,
      metalness: 0.4,
      side: THREE.DoubleSide,
    }),
  );
  const trimMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f0a24a"),
      emissive: new THREE.Color("#c46a12"),
      emissiveIntensity: 0.4,
      roughness: 0.45,
      metalness: 0.5,
    }),
  );

  satellite.add(new THREE.Mesh(track(bin, new THREE.BoxGeometry(0.1, 0.1, 0.16)), bodyMaterial));

  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(track(bin, new THREE.BoxGeometry(0.36, 0.008, 0.18)), panelMaterial);
    panel.position.x = side * 0.25;
    satellite.add(panel);
    const hinge = new THREE.Mesh(track(bin, new THREE.BoxGeometry(0.03, 0.03, 0.05)), trimMaterial);
    hinge.position.x = side * 0.1;
    satellite.add(hinge);
  }

  const dish = new THREE.Mesh(
    track(bin, new THREE.SphereGeometry(0.08, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    track(
      bin,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f6f8fc"),
        roughness: 0.55,
        metalness: 0.25,
        side: THREE.DoubleSide,
      }),
    ),
  );
  dish.rotation.x = -Math.PI / 2;
  dish.position.z = 0.11;
  satellite.add(dish);

  const antenna = new THREE.Mesh(
    track(bin, new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6)),
    track(bin, new THREE.MeshStandardMaterial({ color: new THREE.Color("#b9c0cc"), roughness: 0.5, metalness: 0.6 })),
  );
  antenna.rotation.z = Math.PI / 2;
  antenna.position.set(-0.18, 0.07, 0);
  satellite.add(antenna);

  /* Blinking beacon, so the little craft reads as alive. */
  const beaconMaterial = track(
    bin,
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff5b5b"), transparent: true, opacity: 1 }),
  );
  const beacon = new THREE.Mesh(track(bin, new THREE.SphereGeometry(0.016, 8, 8)), beaconMaterial);
  beacon.position.set(0, 0.06, 0.08);
  satellite.add(beacon);

  satellite.scale.setScalar(1.7);
  orbit.add(satellite);

  /* Phones get a shorter trail: the per-point position writes are the most
     expensive thing in this subject, so 40 reads the same at that size. */
  const trailCount = context.quality.particles < 1 ? 40 : Math.max(14, Math.round(52 * context.quality.particles));
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

  const update = (time: number, delta: number, camera: THREE.PerspectiveCamera) => {
    const { progress, sunDirection, daylight, idleSpin } = context.frame;

    // Planet and clouds turn with the page, not with the clock: scrolling up
    // rewinds them exactly. The idle drift below is the only time-based term.
    earth.rotation.y = progress * 2.6 + idleSpin;
    clouds.rotation.y = progress * 3.4 + idleSpin * 1.35;

    // The Sun direction, carried into view space for both the atmosphere rim
    // and the city-light gate.
    const sunView = atmosphereMaterial.uniforms.uSunDir.value as THREE.Vector3;
    sunView.copy(sunDirection).transformDirection(camera.matrixWorldInverse);
    (earthMaterial.userData.sunDir as { value: THREE.Vector3 }).value.copy(sunView);

    // The rim burns brightest where the Sun still reaches it, and the whole
    // shell dims once the Sun is below the horizon.
    atmosphereMaterial.uniforms.uIntensity.value = 0.55 + daylight * 1.15;

    // City lights resolve as the Sun sets: the emissive gate above is per
    // fragment, this only lifts the overall level.
    earthMaterial.emissiveIntensity = 0.35 + (1 - daylight) * 1.5;

    orbitAngle = progress * 3.1 + idleSpin * 0.6;
    satellite.position.set(
      Math.cos(orbitAngle) * ORBIT_RADIUS,
      0,
      -Math.sin(orbitAngle) * ORBIT_RADIUS,
    );
    satellite.rotation.y = -orbitAngle;
    satellite.rotation.x = Math.sin(time * 0.9) * 0.16;
    beaconMaterial.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 4.5));

    const position = trailGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < trailCount; i += 1) {
      const angle = orbitAngle - (i + 1) * 0.035;
      const radius = ORBIT_RADIUS - i * 0.004;
      position.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle * 3) * 0.03, -Math.sin(angle) * radius);
    }
    position.needsUpdate = true;
    trailMaterial.opacity = 0.55 + Math.sin(time * 1.6) * 0.2;
  };

  const recolor = (next: ThemePalette) => {
    // Only the orbit guide follows the theme: the planet, its clouds and the
    // satellite keep their own colours on every appearance theme.
    orbitRingMaterial.color.set(next.accentLight);
  };

  return { group, update, recolor };
}

/* ══════════════════════════════════════════════════════════════════
   Solar system — Darkmatter
   ══════════════════════════════════════════════════════════════════ */

interface PlanetSpec {
  radius: number;
  orbit: number;
  spin: number;
  tilt: number;
  /** Slight orbital inclination, in radians. */
  inclination: number;
  phase: number;
  kind: "mercury" | "mars" | "venus" | "jupiter" | "saturn" | "earth";
  rings?: [number, number];
}

/* Radial layout is deliberately tight — nothing may overlap its neighbour's
   surface, and the whole system has to fit inside the hero frame. */
const PLANETS: PlanetSpec[] = [
  { kind: "mercury", radius: 0.045, orbit: 0.85, spin: 1.4, tilt: 0.02, inclination: 0.06, phase: 0.4 },
  { kind: "venus", radius: 0.075, orbit: 1.1, spin: 0.7, tilt: 3.09, inclination: 0.04, phase: 2.1 },
  { kind: "earth", radius: 0.085, orbit: 1.35, spin: 1.1, tilt: AXIAL_TILT, inclination: 0.02, phase: 4.4 },
  { kind: "mars", radius: 0.06, orbit: 1.6, spin: 1.05, tilt: 0.44, inclination: 0.05, phase: 1.2 },
  { kind: "jupiter", radius: 0.2, orbit: 2.05, spin: 2.4, tilt: 0.05, inclination: 0.02, phase: 5.6 },
  { kind: "saturn", radius: 0.14, orbit: 2.62, spin: 2.1, tilt: 0.47, inclination: 0.04, phase: 3.3, rings: [0.19, 0.29] },
];

/** Rewrites a ring's UVs so a texture maps radially instead of planar. */
function radialRingUV(geometry: THREE.RingGeometry, inner: number, outer: number): void {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    const radius = Math.hypot(position.getX(i), position.getY(i));
    uv.setXY(i, Math.min(Math.max((radius - inner) / (outer - inner), 0), 1), 0.5);
  }
  uv.needsUpdate = true;
}

function buildSolarSystem(palette: ThemePalette, context: BuildContext): SubjectHandle {
  const { bin, glowTexture, quality } = context;
  const group = new THREE.Group();

  /* The whole system is tilted toward the viewer, the way a poster of it is. */
  const system = new THREE.Group();
  system.rotation.set(-0.5, 0, 0.14);
  system.scale.setScalar(0.88);
  group.add(system);

  /* Sun: unlit and purely emissive, so its own light does the work below. */
  const sunTexture = getSunTexture();
  const sunMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: sunTexture,
      emissiveIntensity: 1.9,
      roughness: 1,
      metalness: 0,
    }),
  );
  const sun = new THREE.Mesh(track(bin, new THREE.SphereGeometry(0.62, 64, 40)), sunMaterial);
  system.add(sun);

  const corona = addSprite(bin, glowTexture, new THREE.Color(palette.glow), 0.9, 3.4, false);
  corona.renderOrder = -1;
  system.add(corona);

  const flare = addSprite(bin, glowTexture, new THREE.Color(palette.accentLight), 0.5, 1.7, false);
  flare.renderOrder = -1;
  system.add(flare);

  /* The only light in the system — planets get a real terminator: the side
     facing the Sun is lit, the far side falls into the scene's dim fill. */
  const starLight = track(bin, new THREE.PointLight(0xfff1de, 1.8, 0, 1));
  system.add(starLight);

  /* Orbits as hairline guides. */
  const orbitMaterial = track(
    bin,
    new THREE.LineBasicMaterial({
      color: palette.accentLight,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  for (const spec of PLANETS) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * spec.orbit, 0, -Math.sin(angle) * spec.orbit));
    }
    const geometry = track(bin, new THREE.BufferGeometry().setFromPoints(points));
    const line = new THREE.LineLoop(geometry, orbitMaterial);
    const plane = new THREE.Group();
    plane.rotation.x = spec.inclination;
    plane.add(line);
    system.add(plane);
  }

  /* Planets. */
  const planets = PLANETS.map((spec) => {
    let texture: THREE.CanvasTexture;
    let roughness = 0.85;
    let emissiveMap: THREE.CanvasTexture | null = null;
    let bumpMap: THREE.CanvasTexture | null = null;

    if (spec.kind === "mercury") texture = getRockyTexture("mercury");
    else if (spec.kind === "mars") texture = getRockyTexture("mars");
    else if (spec.kind === "venus") texture = getGasGiantTexture("venus");
    else if (spec.kind === "jupiter") texture = getGasGiantTexture("jupiter");
    else if (spec.kind === "saturn") {
      texture = getGasGiantTexture("saturn");
      roughness = 0.75;
    } else {
      const maps = getEarthMaps();
      texture = maps.map;
      emissiveMap = maps.night;
      bumpMap = maps.bump;
      roughness = 1;
    }

    const material = track(
      bin,
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness,
        metalness: 0,
        ...(bumpMap ? { bumpMap, bumpScale: 0.01 } : {}),
        ...(emissiveMap
          ? { emissiveMap, emissive: new THREE.Color("#ffd8a8"), emissiveIntensity: 1 }
          : {}),
      }),
    );

    const node = new THREE.Group();
    node.rotation.z = spec.tilt;
    const body = new THREE.Mesh(
      track(bin, new THREE.SphereGeometry(spec.radius, 48, 32)),
      material,
    );
    node.add(body);

    if (spec.rings) {
      const [inner, outer] = spec.rings;
      const geometry = track(bin, new THREE.RingGeometry(inner, outer, 96, 1));
      radialRingUV(geometry, inner, outer);
      const ring = new THREE.Mesh(
        geometry,
        track(
          bin,
          new THREE.MeshStandardMaterial({
            map: getRingTexture(),
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
            roughness: 0.9,
            metalness: 0,
          }),
        ),
      );
      ring.rotation.x = -Math.PI / 2;
      node.add(ring);
    }

    system.add(node);
    return { spec, node, body };
  });

  /* Asteroid belt between Mars and Jupiter. */
  const beltCount = Math.max(60, Math.round(180 * quality.particles));
  const beltGeometry = track(bin, new THREE.DodecahedronGeometry(0.017, 0));
  const beltMaterial = track(
    bin,
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#8b8073"), roughness: 0.95, metalness: 0.05, flatShading: true }),
  );
  const belt = track(bin, new THREE.InstancedMesh(beltGeometry, beltMaterial, beltCount));
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let i = 0; i < beltCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.99 + (Math.random() - 0.5) * 0.14;
    position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * 0.05,
      -Math.sin(angle) * radius,
    );
    rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    quaternion.setFromEuler(rotation);
    const s = 0.5 + Math.random() * 1.6;
    scale.set(s, s * (0.7 + Math.random() * 0.6), s);
    matrix.compose(position, quaternion, scale);
    belt.setMatrixAt(i, matrix);
  }
  belt.instanceMatrix.needsUpdate = true;
  const beltGroup = new THREE.Group();
  beltGroup.add(belt);
  system.add(beltGroup);

  const update = (time: number) => {
    const t = time;
    sun.rotation.y = t * 0.05;
    sunMaterial.emissiveIntensity = 1.85 + Math.sin(t * 1.4) * 0.16;
    corona.scale.setScalar(3.4 * (1 + Math.sin(t * 0.6) * 0.03));
    flare.scale.setScalar(1.7 * (1 + Math.sin(t * 1.7) * 0.05));

    for (const { spec, node, body } of planets) {
      const speed = 1.1 / Math.pow(spec.orbit, 1.5);
      const angle = spec.phase + t * speed;
      node.position.set(
        Math.cos(angle) * spec.orbit,
        Math.sin(angle) * spec.orbit * Math.sin(spec.inclination),
        -Math.sin(angle) * spec.orbit,
      );
      body.rotation.y = t * spec.spin;
    }

    beltGroup.rotation.y = t * 0.28;
    starLight.intensity = 1.8 + Math.sin(t * 1.1) * 0.18;
  };

  const recolor = (next: ThemePalette) => {
    orbitMaterial.color.set(next.accentLight);
    corona.material.color.set(next.glow);
    flare.material.color.set(next.accentLight);
  };

  return { group, update, recolor };
}

/* ══════════════════════════════════════════════════════════════════
   Scene host
   ══════════════════════════════════════════════════════════════════ */

function buildSubject(subject: HeroSubject, palette: ThemePalette, context: BuildContext): SubjectHandle {
  if (subject === "blackhole") return buildBlackHole(palette, context);
  if (subject === "solar") return buildSolarSystem(palette, context);
  return buildEarth(palette, context);
}

/** Resting pose for the non-cinematic subjects (black hole, solar system). */
const BASE_ROTATION_X = 0.16;
const BASE_ROTATION_Y = 0.35;
const CAMERA_Z = 7.2;

interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  subject: SubjectHandle;
  glowLight: THREE.PointLight;
  rimLight: THREE.PointLight;
  /** Only the graphite Earth subject gets a real Sun. */
  sunLight: THREE.DirectionalLight | null;
  /** Star field behind the Earth, faded up as the Sun goes down. */
  stars: THREE.Points | null;
  frame: FrameState;
  disposables: Disposables;
}

/**
 * Walks the camera through the keyframes. A smoothstep on the local segment
 * keeps the velocity continuous, so passing a keyframe is never a snap — and
 * because it reads the same `progress` the rest of the scene reads, scrolling
 * up runs the whole journey backwards.
 */
function applyCameraPose(camera: THREE.PerspectiveCamera, progress: number): void {
  let from = CAMERA_KEYFRAMES[0];
  let to = CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1];

  for (let i = 0; i < CAMERA_KEYFRAMES.length - 1; i += 1) {
    const a = CAMERA_KEYFRAMES[i];
    const b = CAMERA_KEYFRAMES[i + 1];
    if (progress >= a.progress && progress <= b.progress) {
      from = a;
      to = b;
      break;
    }
  }

  const span = Math.max(to.progress - from.progress, 0.0001);
  const raw = THREE.MathUtils.clamp((progress - from.progress) / span, 0, 1);
  const t = raw * raw * (3 - 2 * raw);

  camera.position.set(
    THREE.MathUtils.lerp(from.position[0], to.position[0], t),
    THREE.MathUtils.lerp(from.position[1], to.position[1], t),
    THREE.MathUtils.lerp(from.position[2], to.position[2], t),
  );
  camera.rotation.set(
    THREE.MathUtils.lerp(from.rotation[0], to.rotation[0], t),
    THREE.MathUtils.lerp(from.rotation[1], to.rotation[1], t),
    THREE.MathUtils.lerp(from.rotation[2], to.rotation[2], t),
  );
}

/**
 * A sparse shell of stars behind the Earth. Deliberately tiny and dim: the
 * point is depth behind the planet, not a skybox. Count scales with the
 * quality tier so phones are not asked for a thousand extra points.
 */
function buildStarField(context: BuildContext): { points: THREE.Points; material: THREE.PointsMaterial } {
  const { bin, quality } = context;
  const count = Math.max(120, Math.round(700 * quality.particles));
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    // Even distribution on the band of the sphere the camera actually sees.
    const theta = Math.random() * Math.PI * 2;
    const band = (Math.random() - 0.5) * 0.9;
    const radius = 22 + Math.random() * 16;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = band * radius * 0.8;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
  }

  const geometry = track(bin, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = track(
    bin,
    new THREE.PointsMaterial({
      color: new THREE.Color("#dfe6ef"),
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const points = new THREE.Points(geometry, material);
  points.renderOrder = -1;
  return { points, material };
}

export default function Hero3DScene({
  palette,
  subject = "earth",
  animated = true,
  scrollTarget,
}: SceneProps) {
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
    /* Only the graphite Earth runs the cinematic four-state journey. The other
       subjects keep the old resting pose, so this change stays scoped. */
    const cinematic = IS_EARTH_CAMERA(subject);

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
    camera.position.set(
      0,
      cinematic ? CAMERA_KEYFRAMES[0].position[1] : 0,
      cinematic ? CAMERA_KEYFRAMES[0].position[2] : CAMERA_Z,
    );

    const disposables: Disposables = [];
    const glowTexture = getGlowTexture();

    /* Written every frame by the render loop, read by the subject and the
       atmosphere shader. Scroll position is the only clock that matters. */
    const frame: FrameState = {
      progress: 0,
      time: 0,
      sunDirection: new THREE.Vector3(1, 0, 1).normalize(),
      daylight: 1,
      idleSpin: 0,
    };

    const root = new THREE.Group();
    root.rotation.set(
      cinematic ? 0 : BASE_ROTATION_X,
      cinematic ? 0 : BASE_ROTATION_Y,
      0,
    );
    scene.add(root);

    /* Lights (three r155+ uses physically-correct units).
       Kept deliberately low: each subject lights itself — the Sun is the solar
       system's light source and the Earth's night side must stay dark for its
       city lights to read. These two only add a coloured rim. */
    scene.add(new THREE.AmbientLight(0xffffff, cinematic ? 0.06 : 0.3));
    const glowLight = new THREE.PointLight(new THREE.Color(currentPalette.glow), 20);
    glowLight.position.set(-6, -4, -5);
    scene.add(glowLight);
    const rimLight = new THREE.PointLight(new THREE.Color(currentPalette.accentLight), 14);
    rimLight.position.set(4, -5, 3);
    scene.add(rimLight);

    /* The Sun. Added to the scene rather than to the subject root, so the
       terminator stays put while the planet turns beneath it. */
    let sunLight: THREE.DirectionalLight | null = null;
    let stars: THREE.Points | null = null;
    if (cinematic) {
      sunLight = new THREE.DirectionalLight(0xfff4e6, 2.6);
      sunLight.position.set(6, 1.4, 4);
      scene.add(sunLight);
      scene.add(sunLight.target);

      const starField = buildStarField({ quality, bin: disposables, glowTexture, scene, frame });
      scene.add(starField.points);
      stars = starField.points;
    }

    const subjectHandle = buildSubject(subject, currentPalette, {
      quality,
      bin: disposables,
      glowTexture,
      scene,
      frame,
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
      sunLight,
      stars,
      frame,
      disposables,
    };

    /* ── anime.js: entrance + scroll-linked roll ─────────────── */
    const entry = { scale: 1, roll: 0 };
    const sweep = { value: 0 };
    const tweens: Array<{ revert: () => void }> = [];

    if (animatedRef.current) {
      try {
        tweens.push(
          animate(entry, {
            scale: { from: 0.35, to: 1 },
            roll: { from: -1.5, to: 0 },
            duration: 1500,
            ease: "out(5)",
            autoplay: true,
          }),
        );
      } catch (error) {
        console.warn("[landing] hero entrance failed", error);
        entry.scale = 1;
        entry.roll = 0;
      }

      try {
        tweens.push(
          animate(sweep, {
            value: { from: 0, to: 1 },
            duration: 1000,
            ease: "linear",
            autoplay: onScroll({
              target: scrollTarget?.current ?? hostEl,
              enter: "start start",
              leave: "end start",
              sync: "linear",
            }),
          }),
        );
      } catch (error) {
        console.warn("[landing] hero scroll link failed", error);
        sweep.value = 0;
      }
    }

    /* ── Pointer parallax + idle drift ───────────────────────── */
    const pointer = { x: 0, y: 0 };
    // Seconds since the pointer last moved. Drives the slow idle spin so the
    // hero never looks frozen when nobody is touching it.
    let idleFor = 0;
    let idleSpin = 0;
    const IDLE_AFTER = 2;
    const handlePointerMove = (event: PointerEvent) => {
      const rect = hostEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      idleFor = 0;
    };
    const handlePointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
      idleFor = IDLE_AFTER;
    };
    hostEl.addEventListener("pointermove", handlePointerMove);
    hostEl.addEventListener("pointerleave", handlePointerLeave);

    /* ── Render loop ────────────────────────────────────────── */
    const clock = new THREE.Clock();
    let elapsed = 0;
    let frameId = 0;
    let running = false;
    let fitScale = 1;

    // Cached via a passive listener so the loop never forces a layout read.
    let scrollY = window.scrollY;
    let docHeight = document.documentElement.scrollHeight;
    const handleScroll = () => {
      scrollY = window.scrollY;
    };
    const handleMeasure = () => {
      docHeight = document.documentElement.scrollHeight;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleMeasure, { passive: true });

    /** Full-page scroll progress, 0 at the top and 1 at the bottom. */
    const readProgress = () => {
      const max = (docHeight || 0) - (window.innerHeight || 0);
      if (max <= 0) return 0;
      return THREE.MathUtils.clamp(scrollY / max, 0, 1);
    };

    const renderFrame = (delta: number) => {
      if (animatedRef.current) elapsed += delta;
      const t = elapsed;
      idleFor += delta;

      // ── The one source of truth: where the page is scrolled to.
      // Smoothed so a wheel flick glides into the next state rather than
      // snapping, but never detached from scroll — scrolling up reverses it.
      const targetProgress = readProgress();
      frame.progress += (targetProgress - frame.progress) * (animatedRef.current ? 0.12 : 1);
      frame.time = t;
      const progress = frame.progress;

      if (cinematic) {
        /* State 1 → 4 all fall out of these two calls. */
        applyCameraPose(camera, progress);
        if (sunLight) {
          updateSun(progress, sunLight);
          frame.sunDirection.copy(sunLight.position).normalize();
          // Terminator height, used to fade the city lights and the star field.
          frame.daylight = THREE.MathUtils.clamp(0.5 + frame.sunDirection.y * 1.4, 0, 1);
        }
        if (stars) {
          const material = stars.material as THREE.PointsMaterial;
          // Barely there in daylight, full strength once the Sun is down.
          material.opacity = THREE.MathUtils.lerp(0.15, 0.9, progress);
        }

        // Idle drift: a slow turn that only starts after the pointer rests.
        if (animatedRef.current && idleFor > IDLE_AFTER) {
          idleSpin += delta * 0.045;
        }
        frame.idleSpin = idleSpin;

        // Pointer parallax is a light touch here — the camera carries the
        // motion, so the planet only leans a little.
        root.rotation.y += (pointer.x * 0.12 - root.rotation.y) * 0.04;
        root.rotation.x += (-pointer.y * 0.09 - root.rotation.x) * 0.04;
        root.rotation.z = entry.roll;
        root.scale.setScalar(fitScale * entry.scale);
        // Recede as the hero leaves, handing off to the copy below it.
        const heroDepth = Math.min(Math.max(scrollY / (window.innerHeight || 1), 0), 1.2);
        root.position.z = -heroDepth * 1.4;
      } else {
        // Scroll-linked depth for the non-cinematic subjects.
        const depth = Math.min(Math.max(scrollY / (window.innerHeight || 1), 0), 1.2);

        root.rotation.y += (BASE_ROTATION_Y + pointer.x * 0.38 + depth * 0.9 - root.rotation.y) * 0.05;
        root.rotation.x += (BASE_ROTATION_X - pointer.y * 0.26 - root.rotation.x) * 0.05;
        // anime.js supplies the entrance roll and the scroll-linked roll.
        root.rotation.z = entry.roll + sweep.value * 0.45;
        root.scale.setScalar(fitScale * entry.scale);
        root.position.z = -depth * 2.6;
      }

      subjectHandle.update(t, delta, camera);

      renderer.render(scene, camera);
    };

    const tick = () => {
      frameId = window.requestAnimationFrame(tick);
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
      window.cancelAnimationFrame(frameId);
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
      fitScale = Math.min(Math.max(camera.aspect, 0.78), 1.05);
      renderFrame(0);
    };
    resize();

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
      docHeight = document.documentElement.scrollHeight;
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
      window.removeEventListener("resize", handleMeasure);
      window.removeEventListener("scroll", handleScroll);
      hostEl.removeEventListener("pointermove", handlePointerMove);
      hostEl.removeEventListener("pointerleave", handlePointerLeave);
      for (const tween of tweens) {
        try {
          tween.revert();
        } catch {
          /* already gone */
        }
      }
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
