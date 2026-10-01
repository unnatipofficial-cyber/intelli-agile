/**
 * A one-line bus between pages and the floating agent.
 *
 * The intelligence panel lives inside pages, but the agent that can act on its
 * advice lives in a single dock. Rather than lifting that state into context
 * (and re-rendering the whole tree on every message), pages fire an event and
 * the dock listens. Keeping it to a custom event also means any surface — a
 * button, an empty state, a row action — can hand work to the agent without
 * importing anything from the chat.
 */

const OPEN_EVENT = "aie:agent-open";

export interface OpenAgentDetail {
  /** Pre-fills and submits the agent's input. */
  prompt?: string;
}

export function openAgent(prompt?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenAgentDetail>(OPEN_EVENT, {
      detail: prompt ? { prompt } : {},
    })
  );
}

export const AGENT_OPEN_EVENT = OPEN_EVENT;