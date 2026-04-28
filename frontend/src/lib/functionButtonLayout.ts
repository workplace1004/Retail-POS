/** POS frontend local function button layout definitions. */

import { OPTION_LAYOUT_POLL_MS } from "./optionButtonLayout";

export { OPTION_LAYOUT_POLL_MS };

export const FUNCTION_BUTTON_SLOT_COUNT = 4;

export const FUNCTION_BUTTON_ITEMS = [
  { id: "weborders", labelKey: "control.functionButton.weborders", fallbackLabel: "Weborders" },
  { id: "in-wacht", labelKey: "control.functionButton.inWaiting", fallbackLabel: "On hold" },
  { id: "geplande-orders", labelKey: "control.functionButton.scheduledOrders", fallbackLabel: "Planned orders" },
  { id: "reservaties", labelKey: "control.functionButton.reservations", fallbackLabel: "Reservations" },
  { id: "verkopers", labelKey: "control.functionButton.sellers", fallbackLabel: "Sales staff" },
] as const;

export type FunctionButtonItem = (typeof FUNCTION_BUTTON_ITEMS)[number];

export const FUNCTION_BUTTON_ITEM_IDS = FUNCTION_BUTTON_ITEMS.map((item) => item.id);
const FUNCTION_BUTTON_ITEM_ID_SET = new Set<string>(FUNCTION_BUTTON_ITEM_IDS as readonly string[]);

export const FUNCTION_BUTTON_ITEM_BY_ID: Record<string, FunctionButtonItem> = Object.fromEntries(
  FUNCTION_BUTTON_ITEMS.map((item) => [item.id, item]),
);

export function normalizeFunctionButtonsLayout(value: unknown): string[] {
  if (!Array.isArray(value)) return Array<string>(FUNCTION_BUTTON_SLOT_COUNT).fill("");
  const next = Array<string>(FUNCTION_BUTTON_SLOT_COUNT).fill("");
  const used = new Set<string>();
  for (let i = 0; i < FUNCTION_BUTTON_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || "").trim();
    if (!candidate) continue;
    if (!FUNCTION_BUTTON_ITEM_ID_SET.has(candidate)) continue;
    if (used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  return next;
}

/** First four ids in catalog order — handy for "auto fill" in the webpanel. */
export function buildDefaultFunctionButtonsLayout(): string[] {
  return normalizeFunctionButtonsLayout(FUNCTION_BUTTON_ITEM_IDS.slice(0, FUNCTION_BUTTON_SLOT_COUNT));
}

/** Same-tab: retail dispatches after saving function button layout from Customize POS. */
export const POS_FUNCTION_BUTTONS_LAYOUT_CHANGED_EVENT = "pos-function-buttons-layout-changed";
