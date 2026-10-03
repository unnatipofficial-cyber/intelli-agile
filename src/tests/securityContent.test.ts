import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PUBLIC_PAGES } from "../lib/public-pages";
import {
  controlAnchor,
  DEEP_DIVE_CONTROLS,
  DEFENCE_LAYERS,
  SECURITY_CONTROLS,
  SECURITY_FAQ,
} from "../components/security/security-content";

/**
 * A security page is worth exactly as much as its accuracy, so these tests
 * hold it to two rules:
 *
 *  1. Every public page is actually routed. A page listed in PUBLIC_PAGES but
 *     missing from the router is a dead link in the landing header — the same
 *     class of bug as the undocumented Reports route.
 *  2. Every control is specific. "We take security seriously" is worthless;
 *     a control that cannot name what it guarantees or how it works has no
 *     place on the page.
 */

const routerSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const landingSource = readFileSync(new URL("../pages/Landing.tsx", import.meta.url), "utf8");

describe("public pages", () => {
  test("every public page is registered in the router", () => {
    for (const page of PUBLIC_PAGES) {
      expect(routerSource, `main.tsx is missing a route for ${page.path}`).toContain(
        `path="${page.path}"`,
      );
    }
  });

  test("the landing header links to every public page", () => {
    // The list is rendered from PUBLIC_PAGES, so the header cannot drift — but
    // only if it is still rendered from the constant rather than hard-coded.
    expect(landingSource).toContain("PUBLIC_PAGES.map");
  });

  test("guide and security are both listed", () => {
    expect(PUBLIC_PAGES.map((page) => page.path)).toContain("/guide");
    expect(PUBLIC_PAGES.map((page) => page.path)).toContain("/security");
  });
});

describe("security controls", () => {
  test("covers the six controls the page promises", () => {
    expect(SECURITY_CONTROLS.length).toBe(6);
    const ids = SECURITY_CONTROLS.map((control) => control.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every control scrolls somewhere unique", () => {
    // A control id and a hand-written section id colliding would produce two
    // elements with the same id — and the chip would jump to the wrong one.
    const anchors = SECURITY_CONTROLS.map((control) => controlAnchor(control));
    expect(new Set(anchors).size, `duplicate anchors: ${anchors.join(", ")}`).toBe(anchors.length);
  });

  test("every control has a section on the page", () => {
    // A chip with no target section is a dead link in the nav. Each control
    // either gets a generated deep-dive band or a hand-written section.
    const dedicated = SECURITY_CONTROLS.filter((c) => c.dedicated).length;
    expect(DEEP_DIVE_CONTROLS.length + dedicated).toBe(SECURITY_CONTROLS.length);
  });

  test("a control with its own section is not also rendered as a deep dive", () => {
    // Otherwise the same diagram appears twice and the page repeats itself.
    for (const control of DEEP_DIVE_CONTROLS) {
      expect(control.dedicated).not.toBe(true);
    }
    expect(SECURITY_CONTROLS.length - DEEP_DIVE_CONTROLS.length).toBe(
      SECURITY_CONTROLS.filter((c) => c.dedicated).length,
    );
  });

  test("each control states both guarantees and mechanism", () => {
    for (const control of SECURITY_CONTROLS) {
      expect(control.guarantees.length, `${control.id} lists no guarantees`).toBeGreaterThanOrEqual(3);
      expect(control.howItWorks.length, `${control.id} explains no mechanism`).toBeGreaterThanOrEqual(3);
      expect(control.lede.length).toBeGreaterThan(60);
      expect(control.headline.length).toBeGreaterThan(20);
    }
  });

  test("at least one control names the code that enforces it", () => {
    // Every mechanism line references a file, a function or a route. A
    // mechanism described only in prose is the failure mode this guards.
    const withCode = SECURITY_CONTROLS.filter((control) =>
      control.howItWorks.some((line) => /`|\.ts\b|\.tsx\b/.test(line)),
    );
    expect(withCode.length).toBe(SECURITY_CONTROLS.length);
  });

  test("every deep link points at a real workspace route", () => {
    for (const control of SECURITY_CONTROLS) {
      if (control.route) expect(control.route.startsWith("/dashboard")).toBe(true);
    }
  });
});

describe("defence layers and FAQ", () => {
  test("the request path has five ordered layers", () => {
    expect(DEFENCE_LAYERS).toHaveLength(5);
    for (const layer of DEFENCE_LAYERS) {
      expect(layer.title.length).toBeGreaterThan(0);
      expect(layer.body.length).toBeGreaterThan(40);
    }
  });

  test("answers the questions a reviewer asks", () => {
    expect(SECURITY_FAQ.length).toBeGreaterThanOrEqual(5);
    for (const item of SECURITY_FAQ) {
      expect(item.question.endsWith("?")).toBe(true);
      expect(item.answer.length).toBeGreaterThan(40);
    }
  });

  test("makes no certification claim we cannot back", () => {
    // The page explicitly promises not to claim certifications it lacks. If
    // one is ever added here without the paperwork behind it, fail loudly.
    const text = [
      ...SECURITY_CONTROLS.flatMap((c) => [...c.guarantees, ...c.howItWorks, c.lede]),
      ...SECURITY_FAQ.flatMap((f) => [f.question, f.answer]),
    ]
      .join(" ")
      .toLowerCase();
    for (const claim of ["soc 2", "soc2", "iso 27001", "hipaa", "gdpr certified", "pen-tested"]) {
      expect(text).not.toContain(claim);
    }
  });
});