import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ThemePalette } from "@/hooks/use-theme-palette";

/**
 * Hero3DScene — the landing page's WebGL centrepiece.
 *
 * A rotating "agile network": a faceted core, a counter-rotating wireframe
 * shell and a constellation of nodes wired to their nearest neighbours.
 *
 * Implemented with plain three.js and a requestAnimationFrame loop. Colours are
 * read from the active theme so the scene re-skins with Graphite / Modern
 * Minimal / Darkmatter automatically.
 *
 * Fully defensive: if the renderer cannot be created nothing is appended, and
 * the parent (Landing) already guards this with a WebGL check, a Suspense
 * boundary and an error boundary.
 */

interface SceneProps {
  palette: ThemePalette;
  /** When false (prefers-reduced-motion) the scene renders a single still frame. */
  animated?: boolean;
}

/** Resting pose so the scene reads well even when nothing is animating. */
const BASE_ROTATION_X = 0.16;
const BASE_ROTATION_Y = 0.35;
const NODE_COUNT = 18;
const NODE_RADIUS = 2.15;

/**
 * Compact and touch devices get fewer nodes, a lower pixel ratio and no MSAA.
 * The 3D layer must never be the reason a phone stutters.
 */
interface SceneQuality {
  nodes: number;
  dpr: number;
  antialias: boolean;
}

function readQuality(): SceneQuality {
  if (typeof window === "undefined") {
    return { nodes: NODE_COUNT, dpr: 1.5, antialias: true };
  }
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const compact = coarse || window.innerWidth < 768;
  return {
    nodes: compact ? 11 : NODE_COUNT,
    dpr: compact ? 1.25 : 1.6,
    antialias: !compact,
  };
}

/** Evenly distributes `count` points over a sphere of `radius`. */
function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(
      new THREE.Vector3(
        Math.cos(theta) * ring * radius,
        y * radius,
        Math.sin(theta) * ring * radius,
      ),
    );
  }
  return points;
}

/** Builds a line-segment buffer connecting every node to its two closest neighbours. */
function buildEdgePositions(points: THREE.Vector3[]): Float32Array {
  const positions: number[] = [];
  points.forEach((point, i) => {
    const nearest = points
      .map((other, j) => ({ j, d: i === j ? Number.POSITIVE_INFINITY : point.distanceTo(other) }))
      .sort((a, b) => a.d - b.d);
    for (let k = 0; k < 2; k += 1) {
      const neighbour = nearest[k];
      if (!neighbour) continue;
      const target = points[neighbour.j];
      positions.push(point.x, point.y, point.z, target.x, target.y, target.z);
    }
  });
  return new Float32Array(positions);
}

/** Everything the render loop needs, kept out of React state. */
interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  shell: THREE.Mesh;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  nodes: THREE.InstancedMesh;
  edgeMaterial: THREE.LineBasicMaterial;
  shellMaterial: THREE.MeshBasicMaterial;
  coreMaterial: THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
  nodeMaterial: THREE.MeshBasicMaterial;
  glowLight: THREE.PointLight;
  rimLight: THREE.PointLight;
  disposables: Array<{ dispose: () => void }>;
}

export default function Hero3DScene({ palette, animated = true }: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const handles = useRef<SceneHandles | null>(null);
  const animatedRef = useRef(animated);

  useEffect(() => {
    animatedRef.current = animated;
  }, [animated]);

  /* ── Build the scene once ─────────────────────────────────── */
  useEffect(() => {
    const hostEl = host.current;
    if (!hostEl) return;

    const quality = readQuality();

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
    camera.position.set(0, 0, 7.2);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(resource: T): T => {
      disposables.push(resource);
      return resource;
    };

    const root = new THREE.Group();
    root.rotation.set(BASE_ROTATION_X, BASE_ROTATION_Y, 0);
    scene.add(root);

    /* Lights (three r155+ uses physically-correct units) */
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);
    const glowLight = new THREE.PointLight(new THREE.Color(palette.glow), 45);
    glowLight.position.set(-6, -4, -5);
    scene.add(glowLight);
    const rimLight = new THREE.PointLight(new THREE.Color(palette.accentLight), 30);
    rimLight.position.set(4, -5, 3);
    scene.add(rimLight);

    /* Outer wireframe shell */
    const shellMaterial = track(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(palette.accent),
        wireframe: true,
        transparent: true,
        opacity: 0.17,
      }),
    );
    const shell = new THREE.Mesh(track(new THREE.IcosahedronGeometry(2.55, 1)), shellMaterial);
    root.add(shell);

    /* Faceted core */
    const coreMaterial = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.accent),
        emissive: new THREE.Color(palette.accentDark),
        emissiveIntensity: 0.45,
        roughness: 0.35,
        metalness: 0.62,
        flatShading: true,
      }),
    );
    const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.15, 1)), coreMaterial);
    root.add(core);

    /* Soft halo */
    const haloMaterial = track(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(palette.accentLight),
        transparent: true,
        opacity: 0.06,
      }),
    );
    const halo = new THREE.Mesh(track(new THREE.SphereGeometry(1.15, 24, 24)), haloMaterial);
    halo.scale.setScalar(1.42);
    root.add(halo);

    /* Node constellation + edges */
    const nodePoints = fibonacciSphere(quality.nodes, NODE_RADIUS);
    const edgeGeometry = track(new THREE.BufferGeometry());
    edgeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(buildEdgePositions(nodePoints), 3),
    );
    const edgeMaterial = track(
      new THREE.LineBasicMaterial({
        color: new THREE.Color(palette.accentLight),
        transparent: true,
        opacity: 0.32,
      }),
    );
    root.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    // One instanced draw call for all the nodes.
    const nodeMaterial = track(
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent) }),
    );
    const nodes = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.052, 12, 12)),
      nodeMaterial,
      nodePoints.length,
    );
    const matrix = new THREE.Matrix4();
    const highlight = new THREE.Color(palette.accentLight);
    nodePoints.forEach((point, i) => {
      nodes.setMatrixAt(i, matrix.makeTranslation(point.x, point.y, point.z));
      const color = i % 4 === 0 ? highlight : new THREE.Color(palette.accent);
      nodes.setColorAt(i, color);
    });
    nodes.instanceMatrix.needsUpdate = true;
    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
    root.add(nodes);

    handles.current = {
      renderer,
      scene,
      camera,
      root,
      shell,
      core,
      halo,
      nodes,
      edgeMaterial,
      shellMaterial,
      coreMaterial,
      haloMaterial,
      nodeMaterial,
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

      // Scroll-linked depth: the assembly recedes and turns as the hero leaves
      // the viewport, handing off to the content below rather than simply
      // scrolling out of frame.
      const depth = Math.min(Math.max(scrollY / (window.innerHeight || 1), 0), 1.2);

      // A slight three-quarter pose, nudged by the pointer.
      root.rotation.y += (BASE_ROTATION_Y + pointer.x * 0.38 + depth * 0.9 - root.rotation.y) * 0.05;
      root.rotation.x += (BASE_ROTATION_X - pointer.y * 0.26 - root.rotation.x) * 0.05;
      root.position.z = -depth * 2.6;

      shell.rotation.y = t * 0.14;
      shell.rotation.z = t * 0.06;

      core.rotation.y = -t * 0.26;
      core.rotation.x = t * 0.12;
      core.scale.setScalar(1 + Math.sin(t * 1.15) * 0.045);

      nodes.rotation.y = -t * 0.09;
      nodes.rotation.x = Math.sin(t * 0.25) * 0.12;

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

    /* ── Pause when scrolled out of view / reduced motion ───── */
    let inView = true;
    const sync = () => {
      if (animatedRef.current && inView) {
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

    const handleResize = () => {
      resize();
      if (!(animatedRef.current && inView)) renderFrame(0);
    };
    window.addEventListener("resize", handleResize);

    sync();

    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      hostEl.removeEventListener("pointermove", handlePointerMove);
      hostEl.removeEventListener("pointerleave", handlePointerLeave);
      disposables.forEach((resource) => resource.dispose());
      nodes.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      handles.current = null;
    };
    // Built once; theme changes are applied in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-skin on theme change ──────────────────────────────── */
  useEffect(() => {
    const scene = handles.current;
    if (!scene) return;

    scene.edgeMaterial.color.set(palette.accentLight);
    scene.shellMaterial.color.set(palette.accent);
    scene.coreMaterial.color.set(palette.accent);
    scene.coreMaterial.emissive.set(palette.accentDark);
    scene.haloMaterial.color.set(palette.accentLight);
    scene.glowLight.color.set(palette.glow);
    scene.rimLight.color.set(palette.accentLight);

    const accent = new THREE.Color(palette.accent);
    const highlight = new THREE.Color(palette.accentLight);
    for (let i = 0; i < scene.nodes.count; i += 1) {
      const color = i % 4 === 0 ? highlight : accent;
      scene.nodes.setColorAt(i, color);
    }
    if (scene.nodes.instanceColor) scene.nodes.instanceColor.needsUpdate = true;

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
