/** localStorage key written from Control → External devices → Price display. */
export const POS_PRICE_DISPLAY_STORAGE_KEY = 'pos_price_display';

/** Dispatched on the same document after saving price display settings (storage event does not fire in-tab). */
export const POS_PRICE_DISPLAY_SETTINGS_CHANGED_EVENT = 'pos-price-display-settings-changed';

/** Two-line mode enables extended customer-facing display (second window + sync). */
export const PRICE_DISPLAY_TWO_LINE = 'two-line-display';

export function readPriceDisplayType() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(POS_PRICE_DISPLAY_STORAGE_KEY);
    if (!raw) return 'disabled';
    const s = JSON.parse(raw);
    return s?.type != null ? String(s.type) : 'disabled';
  } catch {
    return 'disabled';
  }
}

/** Alias for settings flag used in product requirements. */
export function isExtendPriceDisplayEnabled() {
  return readPriceDisplayType() === PRICE_DISPLAY_TWO_LINE;
}

export function notifyPriceDisplaySettingsChanged() {
  try {
    window.dispatchEvent(new CustomEvent(POS_PRICE_DISPLAY_SETTINGS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}
