import { describe, expect, test } from "bun:test";
import { GUIDE_CARDS, GUIDE_SECTIONS } from "../components/guide/guide-content";

/**
 * The guide must stay an honest table of contents for the product: one entry
 * per sidebar section, each anchored to a real route, with the carousel deck
 * mirroring the deep dives. These assertions make "added a page, forgot the
 * guide" a failing test rather than a stale tour.
 */
describe("guide content", () => {
  test("covers every section exactly once", () => {
    expect(GUIDE_SECTIONS).toHaveLength(10);
    const ids = GUIDE_SECTIONS.map((section) => section.id);
    const navs = GUIDE_SECTIONS.map((section) => section.nav);
    expect(new Set(ids).size).toBe(GUIDE_SECTIONS.length);
    expect(new Set(navs).size).toBe(GUIDE_SECTIONS.length);
  });

  test("every section anchors to a real app route", () => {
    for (const section of GUIDE_SECTIONS) {
      expect(section.route.startsWith("/dashboard")).toBe(true);
      expect(section.image.startsWith("https://images.unsplash.com/")).toBe(true);
      expect(section.url.startsWith("aie.app")).toBe(true);
    }
  });

  test("every section explains both sides of the contract", () => {
    for (const section of GUIDE_SECTIONS) {
      // "What you do" and "what AIE does" are the point of the guide: a
      // section with fewer than three items either skips content or lies.
      expect(section.youDo.length).toBeGreaterThanOrEqual(3);
      expect(section.itDoes.length).toBeGreaterThanOrEqual(3);
      expect(section.headline.length).toBeGreaterThan(12);
      expect(section.lede.length).toBeGreaterThan(60);
      expect(section.mock).toBeTruthy();
      // Icons are forwardRef component objects in this lucide build, so
      // "function" would be wrong — TypeScript already pins the component
      // type, the runtime check just guards against a missing entry.
      expect(section.icon).toBeTruthy();
    }
  });

  test("the carousel deck mirrors the sections one-to-one", () => {
    expect(GUIDE_CARDS).toHaveLength(GUIDE_SECTIONS.length);
    GUIDE_SECTIONS.forEach((section, index) => {
      expect(GUIDE_CARDS[index].title).toBe(section.title);
      expect(GUIDE_CARDS[index].src).toBe(section.image);
      expect(GUIDE_CARDS[index].category).toBe(section.category);
      expect(GUIDE_CARDS[index].content).toBeTruthy();
    });
  });

  test("position numbers run 01..10 in reading order", () => {
    GUIDE_SECTIONS.forEach((section, index) => {
      expect(section.index).toBe(String(index + 1).padStart(2, "0"));
    });
  });
});
