import { useEffect, useState } from "react";

/**
 * Reactive view of the device's pointer + motion capabilities.
 *
 * The landing page has hover-driven effects (3D tilt, magnetic buttons, custom
 * cursor) that must not run on touch devices or for users who asked for reduced
 * motion. This hook keeps that decision in one place and updates live when the
 * user rotates a device, plugs in a mouse or changes their OS preference.
 */
export interface PointerMode {
  /** A precise pointer (mouse/trackpad) is available. */
  fine: boolean;
  /** The user asked for reduced motion. */
  reduced: boolean;
  /** True once real client capabilities have been measured. */
  ready: boolean;
  /** Hover-driven effects are safe to enable. */
  hover: boolean;
}

const QUERIES = {
  fine: "(hover: hover) and (pointer: fine)",
  reduced: "(prefers-reduced-motion: reduce)",
} as const;

type QueryKey = keyof typeof QUERIES;

function readQuery(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

function read(): PointerMode {
  const isClient = typeof window !== "undefined";
  const fine = readQuery(QUERIES.fine);
  const reduced = readQuery(QUERIES.reduced);
  return { fine, reduced, ready: isClient, hover: isClient && fine && !reduced };
}

export function usePointerMode(): PointerMode {
  const [mode, setMode] = useState<PointerMode>(read);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const update = () => setMode(read());
    const subscriptions = (Object.keys(QUERIES) as QueryKey[]).map((key) => {
      const mql = window.matchMedia(QUERIES[key]);
      mql.addEventListener("change", update);
      return { mql, update };
    });

    update();
    return () => subscriptions.forEach(({ mql, update: handler }) => mql.removeEventListener("change", handler));
  }, []);

  return mode;
}
