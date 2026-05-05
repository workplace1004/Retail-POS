const WINDOW_NAME = 'pos_customer_display';

/** @type {Window | null} */
let lastOpenedRef = null;

/**
 * Absolute URL for the customer display route (HashRouter → `#/price-display`).
 * Works for `http(s):` dev/prod and Electron `file:` builds.
 */
export function getCustomerDisplayUrl() {
  const { protocol, href, pathname, search, origin } = window.location;
  const hashRoute = '#/price-display';

  if (protocol === 'file:') {
    const hashIdx = href.indexOf('#');
    if (hashIdx >= 0) {
      return `${href.slice(0, hashIdx)}${hashRoute}`;
    }
    return `${href}${hashRoute}`;
  }

  const base = `${origin}${pathname || '/'}${search || ''}`;
  const hashIdx = base.indexOf('#');
  if (hashIdx >= 0) {
    return `${base.slice(0, hashIdx)}${hashRoute}`;
  }
  return `${base}${hashRoute}`;
}

/**
 * Opens or reuses the named customer window and navigates it to the price-display route.
 * Same window name prevents duplicates; an existing window is navigated to the latest URL.
 * @returns {Window | null}
 */
export function openCustomerDisplayWindow() {
  const url = getCustomerDisplayUrl();
  const features = 'menubar=no,toolbar=no,location=no,status=no,width=900,height=700';
  try {
    const w = window.open(url, WINDOW_NAME, features);
    if (w) {
      lastOpenedRef = w;
      try {
        w.focus();
      } catch {
        /* ignore */
      }
    }
    return w;
  } catch {
    return null;
  }
}

/** Best-effort close of the last opened customer window (same session). */
export function closeCustomerDisplayWindow() {
  try {
    if (lastOpenedRef && !lastOpenedRef.closed) {
      lastOpenedRef.close();
    }
  } catch {
    /* ignore */
  }
  lastOpenedRef = null;
}
