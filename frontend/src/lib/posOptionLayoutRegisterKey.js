import { POS_API_PREFIX as API } from './apiOrigin.js';
import { posTerminalAuthHeaders } from './posTerminalSession.js';
import { DEFAULT_POS_REGISTER_NAME } from './optionButtonLayout.ts';

/** PosRegister id for `optionButtonLayoutByRegister`, or legacy env/default name. */
export async function fetchPosOptionLayoutRegisterKey() {
  try {
    const res = await fetch(`${API}/pos-registers/current-device`, {
      headers: { ...posTerminalAuthHeaders() },
    });
    const data = await res.json().catch(() => ({}));
    if (data?.register?.id) return String(data.register.id);
  } catch {
    /* ignore */
  }
  try {
    const v = import.meta.env?.VITE_POS_REGISTER_NAME?.trim();
    if (v) return v;
  } catch {
    /* non-Vite */
  }
  return DEFAULT_POS_REGISTER_NAME;
}
