import * as THREE from "three";

/**
 * sceneTextures — procedural textures for the landing hero.
 *
 * Everything the 3D scene shows is generated at runtime with canvas 2D: no
 * image is downloaded, so the hero paints the moment three.js arrives. The
 * maps are the reason the bodies read as real rather than as shaded balls:
 *
 *   Earth      colour + roughness + bump + night lights + cloud sheet
 *   Sun        granulation with limb-darkening and sunspots
 *   Gas giants banded atmospheres with a storm oval
 *   Rocky      cratered, mottled surfaces
 *   Saturn     translucent radial ring bands
 *
 * Generation is not free (~150ms for the whole set), so every texture is
 * cached in a module-level map. The subject set is fixed, so the cache is
 * bounded — switching themes repeatedly is instant and never grows.
 */

/* ── Deterministic randomness ─────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Value noise ──────────────────────────────────────────────────────── */

/* Integer avalanche — `Math.sin`-based hashing would cost millions of trig
   calls across the whole texture set and stall the main thread. */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 3D value noise — evaluated on the unit sphere it has no seams. */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);

  const n000 = hash3(xi, yi, zi);
  const n100 = hash3(xi + 1, yi, zi);
  const n010 = hash3(xi, yi + 1, zi);
  const n110 = hash3(xi + 1, yi + 1, zi);
  const n001 = hash3(xi, yi, zi + 1);
  const n101 = hash3(xi + 1, yi, zi + 1);
  const n011 = hash3(xi, yi + 1, zi + 1);
  const n111 = hash3(xi + 1, yi + 1, zi + 1);

  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm3(x: number, y: number, z: number, octaves = 4, gain = 0.5): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise3(x * frequency, y * frequency, z * frequency) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2.03;
  }
  return sum / norm;
}

function hash2(x: number, y: number): number {
  return hash3(x, y, 17.17);
}

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const n00 = hash2(xi, yi);
  const n10 = hash2(xi + 1, yi);
  const n01 = hash2(xi, yi + 1);
  const n11 = hash2(xi + 1, yi + 1);
  const y0 = n00 + (n10 - n00) * u;
  const y1 = n01 + (n11 - n01) * u;
  return y0 + (y1 - y0) * v;
}

function fbm2(x: number, y: number, octaves = 4, gain = 0.5): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2.07;
  }
  return sum / norm;
}

/* ── Canvas helpers ───────────────────────────────────────────────────── */

const cache = new Map<string, THREE.CanvasTexture>();

/**
 * Compact and touch devices paint everything at half resolution — the same
 * maps, just cheaper. Resolution is part of the cache key so a device never
 * keeps two sets alive, and the whole set is cached because generating it is
 * the only expensive part of switching themes.
 */
const SCALE = ((): number => {
  if (typeof window === "undefined") return 1;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || window.innerWidth < 768 ? 0.5 : 1;
})();

function cached(key: string, build: (context: CanvasRenderingContext2D, width: number, height: number) => void, width: number, height: number, srgb: boolean): THREE.CanvasTexture {
  const cacheKey = `${key}@${SCALE}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const w = Math.max(64, Math.round(width * SCALE));
  const h = Math.max(64, Math.round(height * SCALE));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // Without a 2D context (headless) the texture stays as cleared canvas:
  // rare, and far better than throwing inside a scene build.
  if (context) build(context, w, h);
  texture.needsUpdate = true;
  cache.set(cacheKey, texture);
  return texture;
}

function paint(context: CanvasRenderingContext2D, width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]) {
  const image = context.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  context.putImageData(image, 0, 0);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ── Shared field machinery ───────────────────────────────────────────── */

interface Sample {
  /** Signed elevation: negative is ocean floor, positive is land. */
  height: number;
  /** Latitude as 0 (equator) … 1 (pole). */
  latitude: number;
  /** 0 … 1, higher means drier. */
  aridity: number;
}

/** Low-resolution fields, bilinearly upsampled to the painted maps. */
interface FieldData {
  w: number;
  h: number;
  /** Signed elevation: negative is ocean floor, positive is land. */
  height: Float32Array;
  /** 0 … 1, higher means drier — varies slowly, so it is cheap at field size. */
  aridity: Float32Array;
}

function buildEarthField(width: number, height: number): FieldData {
  const elevation = new Float32Array(width * height);
  const aridity = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const theta = ((y + 0.5) / height) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let x = 0; x < width; x += 1) {
      const phi = (x / width) * Math.PI * 2;
      const px = sinTheta * Math.cos(phi);
      const py = cosTheta;
      const pz = sinTheta * Math.sin(phi);

      const continents = fbm3(px * 0.9, py * 0.9, pz * 0.9, 3);
      const detail = fbm3(px * 3.6 + 11.7, py * 3.6 + 4.4, pz * 3.6 + 9.2, 3);
      const warp = fbm3(px * 1.7 + 31.4, py * 1.7 + 7.7, pz * 1.7 + 21.3, 2) - 0.5;
      const i = y * width + x;
      elevation[i] = (continents - 0.5) * 7.4 + (detail - 0.5) * 2.4 + warp * 1.35;
      aridity[i] = fbm2(px * 6 + 13.1, pz * 6 + 2.7, 3);
    }
  }
  return { w: width, h: height, height: elevation, aridity };
}

function bilinear(values: Float32Array, field: FieldData, u: number, v: number): number {
  const fx = u * field.w;
  const fy = v * field.h;
  const x0 = Math.floor(fx);
  const y0 = Math.min(Math.max(Math.floor(fy), 0), field.h - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const xa = ((x0 % field.w) + field.w) % field.w;
  const xb = (xa + 1) % field.w;
  const yb = Math.min(y0 + 1, field.h - 1);
  const top = values[y0 * field.w + xa] * (1 - tx) + values[y0 * field.w + xb] * tx;
  const bottom = values[yb * field.w + xa] * (1 - tx) + values[yb * field.w + xb] * tx;
  return top * (1 - ty) + bottom * ty;
}

function readSample(u: number, v: number, field: FieldData): Sample {
  return {
    height: bilinear(field.height, field, u, v),
    latitude: Math.abs(v - 0.5) * 2,
    aridity: bilinear(field.aridity, field, u, v),
  };
}

/* ── Earth ────────────────────────────────────────────────────────────── */

export interface EarthMaps {
  /** Albedo: oceans, forests, deserts, ice. */
  map: THREE.CanvasTexture;
  /** White where rough — the ocean stays glossy so it catches a sun glint. */
  roughness: THREE.CanvasTexture;
  /** Terrain relief. */
  bump: THREE.CanvasTexture;
  /** City lights, visible only where the sun is not shining. */
  night: THREE.CanvasTexture;
  /** Translucent cloud sheet on its own layer. */
  clouds: THREE.CanvasTexture;
}

const FIELD_W = Math.round(384 * SCALE);
const FIELD_H = Math.round(192 * SCALE);

export function getEarthMaps(): EarthMaps {
  return {
    map: getEarthAlbedo(),
    roughness: getEarthRoughness(),
    bump: getEarthBump(),
    night: getEarthNight(),
    clouds: getCloudSheet(),
  };
}

let earthFieldCache: FieldData | null = null;

/** Built once and shared by every Earth map — albedo, bump, roughness and
 *  city lights are all different readings of the same elevation. */
function earthField(): FieldData {
  if (!earthFieldCache) earthFieldCache = buildEarthField(FIELD_W, FIELD_H);
  return earthFieldCache;
}

function getEarthAlbedo(): THREE.CanvasTexture {
  const field = earthField();
  return cached(
    "earth-albedo",
    (context, width, height) => {
      paint(context, width, height, (x, y) => {
        const u = x / width;
        const v = (y + 0.5) / height;
        const s = readSample(u, v, field);
        const { height: e, latitude, aridity } = s;
        let r: number;
        let g: number;
        let b: number;

        if (e < 0) {
          // Bathymetry: abyss → shelf.
          const depth = clamp01(-e / 3);
          const shelf = smoothstep(0.0, 0.5, depth);
          r = mix(26, 4, shelf);
          g = mix(112, 24, shelf);
          b = mix(180, 58, shelf);
          // Lighter water near the poles.
          const chill = smoothstep(0.7, 0.95, latitude);
          r = mix(r, 168, chill * 0.75);
          g = mix(g, 198, chill * 0.75);
          b = mix(b, 214, chill * 0.75);
        } else {
          // Land: coast → forest → alpine → bare rock.
          const relief = clamp01(e / 3);
          r = mix(56, 118, smoothstep(0.18, 0.72, relief));
          g = mix(104, 108, smoothstep(0.2, 0.7, relief));
          b = mix(56, 86, smoothstep(0.2, 0.7, relief));
          // Drier latitudes drift toward desert.
          const band = smoothstep(0.1, 0.26, latitude) * (1 - smoothstep(0.34, 0.5, latitude));
          const dry = clamp01(band * (0.55 + aridity * 0.8));
          r = mix(r, 205, dry);
          g = mix(g, 172, dry);
          b = mix(b, 104, dry);
          // Tundra above 60°.
          const cold = smoothstep(0.6, 0.78, latitude);
          r = mix(r, 118, cold * 0.7);
          g = mix(g, 116, cold * 0.7);
          b = mix(b, 92, cold * 0.7);
          // High ground reads as bare rock and scree.
          const high = smoothstep(0.7, 0.95, relief);
          r = mix(r, 148, high);
          g = mix(g, 136, high);
          b = mix(b, 120, high);
        }

        // Ice caps with a ragged edge.
        const wobble = fbm2(u * 9, v * 9, 3) * 0.045;
        const ice = smoothstep(0.86 - wobble, 0.93, latitude);
        if (ice > 0) {
          r = mix(r, 236, ice);
          g = mix(g, 243, ice);
          b = mix(b, 250, ice);
        }
        // Sea ice creeping down from the poles.
        const seaIce = e < 0 ? smoothstep(0.74, 0.84, latitude) : 0;
        r = mix(r, 208, seaIce * 0.8);
        g = mix(g, 224, seaIce * 0.8);
        b = mix(b, 236, seaIce * 0.8);

        return [r, g, b, 255];
      });
    },
    768,
    384,
    true,
  );
}

function getEarthRoughness(): THREE.CanvasTexture {
  const field = earthField();
  return cached(
    "earth-rough",
    (context, width, height) => {
      paint(context, width, height, (x, y) => {
        const s = readSample(x / width, (y + 0.5) / height, field);
        const value = s.height < 0 ? 34 : 224;
        return [value, value, value, 255];
      });
    },
    256,
    128,
    false,
  );
}

function getEarthBump(): THREE.CanvasTexture {
  const field = earthField();
  return cached(
    "earth-bump",
    (context, width, height) => {
      paint(context, width, height, (x, y) => {
        const s = readSample(x / width, (y + 0.5) / height, field);
        const value = s.height < 0 ? 60 : clamp01(0.5 + s.height / 6) * 255;
        return [value, value, value, 255];
      });
    },
    256,
    128,
    false,
  );
}

function getEarthNight(): THREE.CanvasTexture {
  const field = earthField();
  return cached(
    "earth-night",
    (context, width, height) => {
      const random = mulberry32(20260214);
      // Settlements and their glow scale with the map so a half-resolution map
      // still reads the same at any size.
      const density = width / 768;
      const target = Math.round(1500 * density);
      // Start from black, then sprinkle settlements over habitable lowlands.
      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);

      let placed = 0;
      let attempts = 0;
      while (placed < target && attempts < 40000) {
        attempts += 1;
        const u = random();
        const v = 0.05 + random() * 0.9;
        const s = readSample(u, v, field);
        if (s.height < 0.05 || s.height > 1.4) continue;
        if (s.latitude > 0.72) continue;
        // Settlements cluster on low ground, in temperate latitudes, away from
        // the driest interiors — approximate all three with one probability.
        const lowland = 1 - smoothstep(0.2, 1.4, s.height);
        const temperate = 1 - smoothstep(0.5, 0.75, s.latitude);
        const chance = lowland * temperate * (0.35 + s.aridity * 0.9);
        if (random() > chance * 0.55) continue;

        placed += 1;
        const px = u * width;
        const py = v * height;
        const radius = (random() < 0.06 ? 5 + random() * 7 : 1 + random() * 2.4) * density;
        const glow = 0.35 + random() * 0.65;
        const gradient = context.createRadialGradient(px, py, 0, px, py, radius * 3);
        gradient.addColorStop(0, `rgba(255, 236, 198, ${glow})`);
        gradient.addColorStop(0.35, `rgba(255, 214, 152, ${glow * 0.5})`);
        gradient.addColorStop(1, "rgba(255, 200, 130, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(px, py, radius * 3, 0, Math.PI * 2);
        context.fill();
        // Bright coastal nuclei wrap the seam like everything else.
        context.beginPath();
        context.arc((px + width) % width, py, radius * 3, 0, Math.PI * 2);
        context.fill();
      }
    },
    768,
    384,
    true,
  );
}

function getCloudSheet(): THREE.CanvasTexture {
  return cached(
    "earth-clouds",
    (context, width, height) => {
      const density = new Float32Array(width * height);
      for (let y = 0; y < height; y += 1) {
        const v = (y + 0.5) / height;
        const theta = v * Math.PI;
        const latitude = Math.abs(v - 0.5) * 2;
        for (let x = 0; x < width; x += 1) {
          const u = x / width;
          const phi = u * Math.PI * 2;
          const px = Math.sin(theta) * Math.cos(phi);
          const py = Math.cos(theta);
          const pz = Math.sin(theta) * Math.sin(phi);

          const base = fbm3(px * 2.1 + 5.5, py * 2.1 + 2.2, pz * 2.1 + 8.8, 3);
          const swirl = fbm3(px * 5.4 + 17.2, py * 5.4 + 12.9, pz * 5.4 + 3.1, 2);
          // ITCZ and the mid-latitude storm tracks are cloudier than the
          // subtropical highs.
          const band = 0.78 + 0.32 * Math.cos(latitude * Math.PI * 3.1) - 0.18 * latitude;
          const value = base * 0.72 + swirl * 0.28;
          density[y * width + x] = value * band;
        }
      }

      paint(context, width, height, (x, y) => {
        const alpha = smoothstep(0.5, 0.78, density[y * width + x]);
        return [255, 255, 255, Math.round(clamp01(alpha) * 235)];
      });
    },
    512,
    256,
    true,
  );
}

/* ── Sun ──────────────────────────────────────────────────────────────── */

export function getSunTexture(): THREE.CanvasTexture {
  return cached(
    "sun",
    (context, width, height) => {
      paint(context, width, height, (x, y) => {
        const u = x / width;
        const v = y / height;
        const theta = v * Math.PI;
        const phi = u * Math.PI * 2;
        const px = Math.sin(theta) * Math.cos(phi);
        const py = Math.cos(theta);
        const pz = Math.sin(theta) * Math.sin(phi);

        // Convection granulation: fine cells plus a slow large-scale pattern.
        const fine = fbm3(px * 26, py * 26, pz * 26, 2, 0.55);
        const coarse = fbm3(px * 4.5 + 21.7, py * 4.5 + 6.1, pz * 4.5 + 13.3, 3);
        const granulation = clamp01(fine * 0.55 + coarse * 0.6);

        let r = mix(196, 255, granulation);
        let g = mix(74, 214, granulation);
        let b = mix(18, 132, granulation);

        // Sunspots: darker, cooler umbra with a penumbra ring.
        const spotField = fbm3(px * 3.1 + 44.2, py * 3.1 + 9.9, pz * 3.1 + 27.5, 2);
        const spot = smoothstep(0.72, 0.86, spotField);
        r = mix(r, 92, spot);
        g = mix(g, 34, spot);
        b = mix(b, 14, spot);

        return [r, g, b, 255];
      });
    },
    512,
    256,
    true,
  );
}

/* ── Gas giants ───────────────────────────────────────────────────────── */

export type GasGiant = "venus" | "jupiter" | "saturn";

const GIANT_COLOURS: Record<GasGiant, { bands: string[]; storm?: string }> = {
  venus: { bands: ["#e8d9a8", "#d8c284", "#f2e7c2", "#c9ad6e", "#efe0b4"] },
  jupiter: {
    bands: ["#e6d6bd", "#b9895e", "#d9c3a6", "#8f6247", "#efe3d2", "#a87551", "#cbb094"],
    storm: "#c1573a",
  },
  saturn: { bands: ["#e8d9b4", "#d6c39a", "#f0e6ca", "#c9b48a", "#e2d2ae"] },
};

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function getGasGiantTexture(kind: GasGiant): THREE.CanvasTexture {
  return cached(
    `gas-${kind}`,
    (context, width, height) => {
      const palette = GIANT_COLOURS[kind].bands.map(hexToRgb);
      const stormColour = GIANT_COLOURS[kind].storm ? hexToRgb(GIANT_COLOURS[kind].storm as string) : null;
      const turbulence = kind === "venus" ? 0.55 : 0.3;

      paint(context, width, height, (x, y) => {
        const u = x / width;
        const v = y / height;
        // Bands are driven by latitude with a slow wander, so they wobble the
        // way real zonal flows do instead of being dead-straight stripes.
        const wander = (fbm2(u * 5 + 3.3, v * 2.4 + 1.1, 2) - 0.5) * turbulence;
        const band = (v + wander * 0.12) * palette.length * 1.35;
        // The wander can push a sample below 0, and JS `%` keeps the sign —
        // wrap explicitly so the index can never go negative.
        const raw = Math.floor(band);
        const index = ((raw % palette.length) + palette.length) % palette.length;
        const next = (index + 1) % palette.length;
        const blend = band - Math.floor(band);
        const a = palette[index];
        const b = palette[next];
        const t = blend * blend * (3 - 2 * blend);
        let r = mix(a[0], b[0], t);
        let g = mix(a[1], b[1], t);
        let bl = mix(a[2], b[2], t);

        // Fine streaking along the bands.
        const streak = fbm2(u * 60, v * 12 + 4.4, 2) - 0.5;
        r += streak * 18;
        g += streak * 16;
        bl += streak * 14;

        if (stormColour && kind === "jupiter") {
          // Great Red Spot: an ellipse with a soft, turbulent edge.
          const dx = (u - 0.68) * 2.4;
          const dy = (v - 0.63) * 5.2;
          const wobble = (fbm2(u * 14, v * 14, 3) - 0.5) * 0.5;
          const d = Math.sqrt(dx * dx + dy * dy) + wobble;
          const oval = 1 - smoothstep(0.55, 1.0, d);
          if (oval > 0) {
            r = mix(r, stormColour[0], oval * 0.85);
            g = mix(g, stormColour[1], oval * 0.85);
            bl = mix(bl, stormColour[2], oval * 0.85);
          }
        }

        return [clamp01(r / 255) * 255, clamp01(g / 255) * 255, clamp01(bl / 255) * 255, 255];
      });
    },
    512,
    256,
    true,
  );
}

/* ── Rocky worlds ─────────────────────────────────────────────────────── */

export type RockyWorld = "mercury" | "mars";

const ROCKY_COLOURS: Record<RockyWorld, { base: [number, number, number]; shade: [number, number, number]; craters: number }> = {
  mercury: { base: [136, 132, 128], shade: [88, 86, 84], craters: 150 },
  mars: { base: [176, 96, 58], shade: [110, 58, 36], craters: 95 },
};

export function getRockyTexture(kind: RockyWorld): THREE.CanvasTexture {
  return cached(
    `rock-${kind}`,
    (context, width, height) => {
      const colours = ROCKY_COLOURS[kind];
      paint(context, width, height, (x, y) => {
        const u = x / width;
        const v = y / height;
        const theta = v * Math.PI;
        const phi = u * Math.PI * 2;
        const px = Math.sin(theta) * Math.cos(phi);
        const py = Math.cos(theta);
        const pz = Math.sin(theta) * Math.sin(phi);
        const mottle = fbm3(px * 6.5 + 3.7, py * 6.5 + 8.4, pz * 6.5 + 1.9, 4);
        const t = clamp01(mottle * 1.15);
        let r = mix(colours.shade[0], colours.base[0], t);
        let g = mix(colours.shade[1], colours.base[1], t);
        let b = mix(colours.shade[2], colours.base[2], t);

        if (kind === "mars") {
          // Polar caps and the dark basaltic plains.
          const latitude = Math.abs(v - 0.5) * 2;
          const cap = smoothstep(0.85, 0.94, latitude);
          r = mix(r, 232, cap);
          g = mix(g, 236, cap);
          b = mix(b, 242, cap);
          const plains = smoothstep(0.56, 0.72, fbm3(px * 3.2 + 19, py * 3.2 + 5, pz * 3.2 + 11, 2));
          r = mix(r, 96, plains * 0.55);
          g = mix(g, 60, plains * 0.55);
          b = mix(b, 44, plains * 0.55);
        }
        return [r, g, b, 255];
      });

      // Craters, stamped after the base paint so rims stay crisp.
      const random = mulberry32(kind === "mars" ? 88123 : 4471);
      for (let i = 0; i < colours.craters; i += 1) {
        const cx = random() * width;
        const cy = random() * height;
        const radius = 1.5 + Math.pow(random(), 2.4) * 14;
        const shade = kind === "mars" ? "60, 34, 22" : "74, 72, 70";
        const rim = kind === "mars" ? "214, 140, 96" : "178, 174, 170";
        const gradient = context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
        gradient.addColorStop(0, `rgba(${shade}, 0.5)`);
        gradient.addColorStop(0.72, `rgba(${shade}, 0.32)`);
        gradient.addColorStop(0.86, `rgba(${rim}, 0.45)`);
        gradient.addColorStop(1, `rgba(${shade}, 0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.fill();
        // Repeat across the seam so no crater is clipped mid-face.
        context.beginPath();
        context.arc((cx + width) % width, cy, radius, 0, Math.PI * 2);
        context.fill();
      }
    },
    512,
    256,
    true,
  );
}

/* ── Saturn's rings ───────────────────────────────────────────────────── */

export function getRingTexture(): THREE.CanvasTexture {
  return cached(
    "saturn-rings",
    (context, width, height) => {
      paint(context, width, height, (x) => {
        const t = x / width;
        // Several bands with real gaps: the Cassini division is the big one.
        let alpha = 0.72;
        alpha *= 0.55 + 0.45 * Math.sin(t * 38 + Math.sin(t * 7) * 2);
        alpha *= smoothstep(0.0, 0.06, t) * (1 - smoothstep(0.94, 1, t));
        const cassini = 1 - smoothstep(0.012, 0.05, Math.abs(t - 0.52));
        alpha *= 1 - cassini * 0.9;
        const inner = 1 - smoothstep(0.0, 0.12, t);
        alpha *= 1 - inner * 0.65;
        const shade = 0.86 + 0.14 * Math.sin(t * 61);
        const r = 232 * shade;
        const g = 218 * shade;
        const b = 188 * shade;
        return [r, g, b, Math.round(clamp01(alpha) * 255)];
      });
    },
    512,
    8,
    true,
  );
}

/* ── Shared decorative maps ───────────────────────────────────────────── */

/** Soft radial falloff used for every glow, corona and lens flare. */
export function getGlowTexture(): THREE.CanvasTexture {
  return cached(
    "glow",
    (context, width, height) => {
      const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.16, "rgba(255,255,255,0.72)");
      gradient.addColorStop(0.4, "rgba(255,255,255,0.2)");
      gradient.addColorStop(0.7, "rgba(255,255,255,0.045)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    },
    256,
    256,
    false,
  );
}

/** Blue cell grid for the satellite's solar wings. */
export function getPanelTexture(): THREE.CanvasTexture {
  return cached(
    "panel",
    (context, width, height) => {
      paint(context, width, height, (x, y) => {
        const cellX = x % 21;
        const cellY = y % 17;
        const line = cellX < 2 || cellY < 2;
        const shade = 0.75 + 0.25 * (1 - y / height);
        if (line) return [18, 24, 54, 255];
        return [Math.round(54 * shade), Math.round(86 * shade), Math.round(196 * shade), 255];
      });
    },
    84,
    68,
    true,
  );
}
