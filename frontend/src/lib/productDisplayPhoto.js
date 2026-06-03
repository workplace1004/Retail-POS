/**
 * POS product tiles: Advanced tab “Cash register photo” (`kassaPhotoPath`) only.
 * Kiosk uses `kioskPicturePath` — see `kiosk/src/lib/productDisplayPhoto.js`.
 */
export function posProductDisplayPhotoPath(product) {
  if (!product || typeof product !== 'object') return '';
  return String(product.kassaPhotoPath ?? '').trim();
}
