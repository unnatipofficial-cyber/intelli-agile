/**
 * Public pages that sit outside the authenticated workspace.
 *
 * The landing header links to these, so keeping them in one constant means a
 * new public page is added in one place and the coverage test can check that
 * each one is actually routed. Guide and Security were the first two; the test
 * in `src/tests/securityContent.test.ts` fails if a page is listed here but
 * never registered in `main.tsx`.
 */
export const PUBLIC_PAGES = [
  { path: "/guide", label: "Guide" },
  { path: "/security", label: "Security" },
] as const;