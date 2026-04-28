const STORAGE_KEY = 'pos-terminal-jwt';

export function getPosTerminalToken() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && String(v).trim() ? String(v).trim() : null;
  } catch {
    return null;
  }
}

export function setPosTerminalToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, String(token).trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearPosTerminalToken() {
  setPosTerminalToken(null);
}

export function posTerminalAuthHeaders() {
  const t = getPosTerminalToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
