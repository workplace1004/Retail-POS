/** Webpanel local option button layout definitions. */

/** Same-tab: retail dispatches after saving device settings so the POS footer refetches immediately. */
export const POS_DEVICE_SETTINGS_CHANGED_EVENT = "pos-device-settings-changed";

/** Same-tab: retail / webpanel after saving system settings (Customize POS ↔ webpanel sync). */
export const POS_SYSTEM_SETTINGS_CHANGED_EVENT = "pos-system-settings-changed";

/** Same-tab: retail / webpanel after saving production messages list (Customize POS ↔ webpanel sync). */
export const POS_PRODUCTION_MESSAGES_CHANGED_EVENT = "pos-production-messages-changed";

/** Poll interval (ms) for option layout sync with the server (webpanel ↔ retail via API). */
export const OPTION_LAYOUT_POLL_MS = 1500;

/**
 * While the retail POS "Production messages" or "System settings" modal is open, poll this often
 * so webpanel edits show up quickly (CustomEvent does not cross browser tabs).
 */
export const PRODUCTION_MESSAGES_MODAL_POLL_MS = 400;

/** Same interval as {@link PRODUCTION_MESSAGES_MODAL_POLL_MS} — system settings cross-tab sync. */
export const SYSTEM_SETTINGS_MODAL_POLL_MS = PRODUCTION_MESSAGES_MODAL_POLL_MS;
/** Same interval as {@link PRODUCTION_MESSAGES_MODAL_POLL_MS} — device settings cross-tab sync. */
export const DEVICE_SETTINGS_MODAL_POLL_MS = PRODUCTION_MESSAGES_MODAL_POLL_MS;

/** Same-tab hint after saving product ↔ subproduct links; cross-tab relies on polling while the dialog is open. */
export const POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT = "pos-product-subproduct-links-changed";

/** Poll while the product subproducts dialog is open (webpanel ↔ retail via API). */
export const PRODUCT_SUBPRODUCT_LINKS_MODAL_POLL_MS = PRODUCTION_MESSAGES_MODAL_POLL_MS;

export const OPTION_BUTTON_SLOT_COUNT = 28;
export const OPTION_BUTTON_LOCKED_ID = "meer";

export const OPTION_BUTTON_ITEMS = [
  { id: "extra-bc-bedrag", labelKey: "control.optionButton.extraBcAmount", fallbackLabel: "Extra BC amount" },
  { id: "bc-refund", labelKey: "control.optionButton.bcRefund", fallbackLabel: "BC Refund" },
  { id: "stock-retour", labelKey: "control.optionButton.stockRetour", fallbackLabel: "Stock return" },
  { id: "product-labels", labelKey: "control.optionButton.productLabels", fallbackLabel: "Product Labels" },
  { id: "ticket-afdrukken", labelKey: "control.optionButton.printTicket", fallbackLabel: "Add ticket" },
  { id: "tegoed", labelKey: "control.optionButton.credit", fallbackLabel: "Credit" },
  { id: "tickets-optellen", labelKey: "control.optionButton.sumTickets", fallbackLabel: "Ticket To" },
  { id: "product-info", labelKey: "control.optionButton.productInfo", fallbackLabel: "Product info" },
  { id: "personeel-ticket", labelKey: "control.optionButton.staffTicket", fallbackLabel: "Staff consumables" },
  { id: "productie-bericht", labelKey: "control.optionButton.productionMessage", fallbackLabel: "Production message" },
  { id: "prijs-groep", labelKey: "control.optionButton.priceGroup", fallbackLabel: "Price group" },
  { id: "discount", labelKey: "control.optionButton.discount", fallbackLabel: "Discount" },
  { id: "kadobon", labelKey: "control.optionButton.giftVoucher", fallbackLabel: "Gift voucher" },
  { id: "various", labelKey: "control.optionButton.various", fallbackLabel: "Miscellaneous" },
  { id: "plu", labelKey: "control.optionButton.plu", fallbackLabel: "PLU" },
  { id: "product-zoeken", labelKey: "control.optionButton.searchProduct", fallbackLabel: "Search Product" },
  { id: "lade", labelKey: "control.optionButton.drawer", fallbackLabel: "Drawer" },
  { id: "klanten", labelKey: "control.optionButton.customers", fallbackLabel: "Customers" },
  { id: "historiek", labelKey: "control.optionButton.history", fallbackLabel: "History" },
  { id: "subtotaal", labelKey: "control.optionButton.subtotal", fallbackLabel: "Subtotal" },
  { id: "terugname", labelKey: "control.optionButton.return", fallbackLabel: "Return name" },
  { id: "check-in-out", labelKey: "control.optionButton.checkInOut", fallbackLabel: "Check in/out" },
  { id: "meer", labelKey: "control.optionButton.more", fallbackLabel: "More..." },
  { id: "eat-in-take-out", labelKey: "control.optionButton.eatInTakeOut", fallbackLabel: "Take Out" },
  { id: "externe-apps", labelKey: "control.optionButton.externalApps", fallbackLabel: "External Apps" },
  { id: "voor-verpakken", labelKey: "control.optionButton.forPacking", fallbackLabel: "Pre-packaging" },
  { id: "leeggoed-terugnemen", labelKey: "control.optionButton.depositReturn", fallbackLabel: "Return empty containers" },
  { id: "webshop-tijdsloten", labelKey: "control.optionButton.webshopTimeslots", fallbackLabel: "Webshop time slots" },
] as const;

export type OptionButtonItem = (typeof OPTION_BUTTON_ITEMS)[number];

export const OPTION_BUTTON_ITEM_IDS = OPTION_BUTTON_ITEMS.map((item) => item.id);
const OPTION_BUTTON_ITEM_ID_SET = new Set<string>(OPTION_BUTTON_ITEM_IDS as readonly string[]);

export const OPTION_BUTTON_ITEM_BY_ID: Record<string, OptionButtonItem> = Object.fromEntries(
  OPTION_BUTTON_ITEMS.map((item) => [item.id, item]),
);

export const DEFAULT_OPTION_BUTTON_LAYOUT: string[] = [
  "extra-bc-bedrag",
  "",
  "bc-refund",
  "stock-retour",
  "product-labels",
  "",
  "",
  "ticket-afdrukken",
  "",
  "tegoed",
  "tickets-optellen",
  "",
  "product-info",
  "personeel-ticket",
  "productie-bericht",
  "prijs-groep",
  "discount",
  "kadobon",
  "various",
  "plu",
  "product-zoeken",
  "lade",
  "klanten",
  "historiek",
  "subtotaal",
  "terugname",
  "check-in-out",
  "meer",
];

/** Row-major pack: every known key once in `OPTION_BUTTON_ITEMS` order, `meer` always last slot; trailing cells stay empty until normalize. */
export function buildAutoArrangedOptionButtonLayout(): string[] {
  const nonMeer = OPTION_BUTTON_ITEM_IDS.filter((id) => id !== OPTION_BUTTON_LOCKED_ID);
  const next = Array<string>(OPTION_BUTTON_SLOT_COUNT).fill("");
  let i = 0;
  for (const id of nonMeer) {
    if (i >= OPTION_BUTTON_SLOT_COUNT - 1) break;
    next[i] = id;
    i += 1;
  }
  next[OPTION_BUTTON_SLOT_COUNT - 1] = OPTION_BUTTON_LOCKED_ID;
  return normalizeOptionButtonSlots(next);
}

export function normalizeOptionButtonSlots(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_OPTION_BUTTON_LAYOUT];
  const next = Array<string>(OPTION_BUTTON_SLOT_COUNT).fill("");
  const used = new Set<string>();
  for (let i = 0; i < OPTION_BUTTON_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || "").trim();
    if (!candidate) continue;
    if (!OPTION_BUTTON_ITEM_ID_SET.has(candidate)) continue;
    if (used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  if (!next.includes(OPTION_BUTTON_LOCKED_ID)) {
    next[OPTION_BUTTON_SLOT_COUNT - 1] = OPTION_BUTTON_LOCKED_ID;
  }
  return next;
}

/** Legacy webpanel / POS default key before real `PosRegister` ids. Override with VITE_POS_REGISTER_NAME on the POS build. */
export const DEFAULT_POS_REGISTER_NAME = "Kassa 1";

/**
 * Resolve per-register option button layout from merged device settings.
 * Lookup order: `optionButtonLayoutByRegister[registerKey]` → global `optionButtonLayout` → legacy `byReg["Kassa 1"]`.
 * `registerKey` should be the current terminal's `PosRegister.id` when known (from `GET /pos-registers/current-device`).
 */
export function pickOptionButtonLayoutFromDeviceSettings(value: unknown, registerKey?: string | null): unknown {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const byReg =
    v.optionButtonLayoutByRegister && typeof v.optionButtonLayoutByRegister === "object" && !Array.isArray(v.optionButtonLayoutByRegister)
      ? (v.optionButtonLayoutByRegister as Record<string, unknown>)
      : null;

  const primary = (registerKey != null && String(registerKey).trim() !== "" ? String(registerKey).trim() : null) || DEFAULT_POS_REGISTER_NAME;

  if (byReg) {
    const row = byReg[primary];
    if (Array.isArray(row)) return row;
  }
  if (Array.isArray(v.optionButtonLayout)) return v.optionButtonLayout;
  if (byReg) {
    const legacy = byReg[DEFAULT_POS_REGISTER_NAME];
    if (Array.isArray(legacy)) return legacy;
  }
  return null;
}
