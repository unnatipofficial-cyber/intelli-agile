import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Copy text to the clipboard, reporting whether it actually worked.
 *
 * `navigator.clipboard` is absent on insecure origins and can be refused by
 * permissions policy, so a caller that just assumed success would show a
 * "Copied!" toast while nothing was copied. Returns false instead of throwing,
 * and falls back to a hidden textarea + execCommand for those cases.
 */
export async function copyText(text: string): Promise<boolean> {
  const value = (text ?? "").trim();
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
