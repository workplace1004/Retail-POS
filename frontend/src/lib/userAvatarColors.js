/** Same order as Control → Users → General color grid (3×3, left-to-right, top-to-bottom). */
export const USER_AVATAR_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#9ca3af',
  '#4b5563',
  '#f97316',
  '#d946ef',
  '#f472b6',
];

export function clampAvatarColorIndex(raw) {
  const i = Math.floor(Number(raw));
  if (!Number.isFinite(i)) return 0;
  return Math.min(USER_AVATAR_COLORS.length - 1, Math.max(0, i));
}

export function avatarColorAtIndex(raw) {
  return USER_AVATAR_COLORS[clampAvatarColorIndex(raw)];
}
