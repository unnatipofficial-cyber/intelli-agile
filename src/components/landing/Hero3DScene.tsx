import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThemePalette } from "@/hooks/use-theme-palette";

/**
 * Hero3DScene — the landing page's WebGL centrepiece.
 *
 * A rotating "agile network": a faceted core, a counter-rotating wireframe
 * shell, and a constellation of nodes wired to their nearest neighbours. It is
 * driven by three.js through @react-three/fiber and picks its colours from the
 * active theme's CSS variables, so it re-skins with Graphite / Modern Minimal /
 * Darkmatter automatically.
 *
 * Fully defensive: the component renders nothing to the DOM beyond a canvas and
 * the parent (Landing) guards it with a WebGL check, a Suspense boundary and an
 * error boundary.
 */

interface SceneProps {
  palette: ThemePalette;
  /** When false (prefers-reduced-motion) the scene stays perfectly still. */
  animated?: boolean;
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

/** Connects every node to its two closest neighbours. */
function buildEdges(points: THREE.Vector3[]): Float32Array {
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

/** Resting pose so the scene reads well even when nothing is animating. */
const BASE_ROTATION_X = 0.16;
const BASE_ROTATION_Y = 0.35;

function AgileCore({ palette, animated = true }: SceneProps) {
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const nodesGroup = useRef<THREE.Group>(null);
  const pointer = useThree((state) => state.pointer);
  const elapsed = useRef(0);

  const nodes = useMemo(() => fibonacciSphere(18, 2.15), []);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);

  const edgeGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(edges, 3));
    return geometry;
  }, [edges]);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  const accent = useMemo(() => new THREE.Color(palette.accent), [palette.accent]);
  const accentLight = useMemo(() => new THREE.Color(palette.accentLight), [palette.accentLight]);
  const accentDark = useMemo(() => new THREE.Color(palette.accentDark), [palette.accentDark]);

  useFrame((_, delta) => {
    // Clamp delta so a backgrounded tab cannot jump the animation on return.
    const step = Math.min(delta, 0.05);
    if (animated) elapsed.current += step;
    const t = elapsed.current;

    const group = root.current;
    if (group) {
      // A slight three-quarter pose, nudged by the pointer.
      const targetY = BASE_ROTATION_Y + pointer.x * 0.38;
      const targetX = BASE_ROTATION_X - pointer.y * 0.26;
      group.rotation.y += (targetY - group.rotation.y) * 0.05;
      group.rotation.x += (targetX - group.rotation.x) * 0.05;
    }

    if (shell.current) {
      shell.current.rotation.y = t * 0.14;
      shell.current.rotation.z = t * 0.06;
    }

    if (core.current) {
      core.current.rotation.y = -t * 0.26;
      core.current.rotation.x = t * 0.12;
      const pulse = 1 + Math.sin(t * 1.15) * 0.045;
      core.current.scale.setScalar(pulse);
    }

    if (nodesGroup.current) {
      nodesGroup.current.rotation.y = -t * 0.09;
      nodesGroup.current.rotation.x = Math.sin(t * 0.25) * 0.12;
    }
  });

  return (
    <group ref={root} rotation={[BASE_ROTATION_X, BASE_ROTATION_Y, 0]}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 6, 7]} intensity={2} />
      <pointLight position={[-6, -4, -5]} intensity={45} color={palette.glow} />
      <pointLight position={[4, -5, 3]} intensity={30} color={palette.accentLight} />

      {/* Outer wireframe shell */}
      <mesh ref={shell}>
        <icosahedronGeometry args={[2.55, 1]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.17} />
      </mesh>

      {/* Faceted core */}
      <mesh ref={core}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial
          color={accent}
          emissive={accentDark}
          emissiveIntensity={0.45}
          roughness={0.35}
          metalness={0.62}
          flatShading
        />
      </mesh>

      {/* Inner glow sphere */}
      <mesh scale={1.42}>
        <sphereGeometry args={[1.15, 24, 24]} />
        <meshBasicMaterial color={accentLight} transparent opacity={0.06} />
      </mesh>

      {/* Constellation of nodes + edges */}
      <group ref={nodesGroup}>
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial color={accentLight} transparent opacity={0.32} />
        </lineSegments>
        {nodes.map((node, i) => (
          <mesh key={i} position={[node.x, node.y, node.z]}>
            <sphereGeometry args={[0.052, 12, 12]} />
            <meshBasicMaterial color={i % 4 === 0 ? accentLight : accent} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function Hero3DScene({ palette, animated = true }: SceneProps) {
  const [inView, setInView] = useState(true);
  const host = useRef<HTMLDivElement>(null);

  // Stop rendering frames while the hero is scrolled out of view.
  useEffect(() => {
    const element = host.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const live = inView && animated;

  return (
    <div ref={host} className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 7.2], fov: 42 }}
        dpr={[1, 1.8]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        frameloop={live ? "always" : "demand"}
        style={{ width: "100%", height: "100%" }}
      >
        <AgileCore palette={palette} animated={animated} />
      </Canvas>
    </div>
  );
}
