import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';
import {
  encryptLicenseFileObject,
  fetchDeviceFingerprint,
  getLicenseFileEncryptionKeyHex,
  getLicenseRsaPublicKeyPem,
  mapLicenseErrorToI18nKey,
  shouldCallLicenseRemoteValidate,
  unpackLicenseInnerFromBytes,
  validateLicenseBundleAgainstDevice,
  validateOnServer,
  writeLicenseToOpfs
} from '../lib/posWebLicense.js';

export function LicenseActivationScreen({ time, onLicensed, initialErrorKey, variant = 'pos' }) {
  const { t } = useLanguage();
  const [deviceId, setDeviceId] = useState('');
  const [deviceIdLoading, setDeviceIdLoading] = useState(true);
  const [deviceIdCopied, setDeviceIdCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(initialErrorKey || null);
  const fileRef = useRef(null);

  const isKiosk = variant === 'kiosk';
  const rootClass = isKiosk
    ? 'flex flex-col h-full min-h-[100dvh] bg-white text-black'
    : 'flex flex-col h-full min-h-[100dvh] bg-pos-bg text-pos-text';
  const borderClass = isKiosk ? 'border-gray-200' : 'border-pos-border';
  const panelClass = isKiosk ? 'bg-gray-50 border border-gray-200' : 'bg-pos-panel border border-pos-border';
  const title = isKiosk ? 'Retail Kiosk' : 'Retail';

  useEffect(() => {
    if (initialErrorKey) setErrorKey(initialErrorKey);
  }, [initialErrorKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDeviceIdLoading(true);
      try {
        const fp = await fetchDeviceFingerprint();
        if (!cancelled) setDeviceId(fp);
      } catch {
        if (!cancelled) setDeviceId('');
      } finally {
        if (!cancelled) setDeviceIdLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deviceIdCopied) return;
    const id = setTimeout(() => setDeviceIdCopied(false), 2000);
    return () => clearTimeout(id);
  }, [deviceIdCopied]);

  const showError = (err) => {
    if (typeof err === 'string') {
      setErrorKey(err.startsWith('license.err.') ? err : `license.err.${err}`);
      return;
    }
    setErrorKey(mapLicenseErrorToI18nKey(err));
  };

  const handlePickFile = async (e) => {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorKey(null);
    const pem = getLicenseRsaPublicKeyPem();
    const hex = getLicenseFileEncryptionKeyHex();
    if (!pem) {
      showError('no_public_key');
      return;
    }
    if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
      showError('no_decryption_key');
      return;
    }
    let fp;
    try {
      fp = await fetchDeviceFingerprint();
    } catch {
      showError('fingerprint_error');
      return;
    }
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const inner = await unpackLicenseInnerFromBytes(buf, hex);
      await validateLicenseBundleAgainstDevice(inner, fp, pem);
      const enc = await encryptLicenseFileObject(inner, hex);
      await writeLicenseToOpfs(enc);
      try {
        const lic = inner.license && typeof inner.license === 'object' ? inner.license : inner;
        if (lic?.licenseKey && shouldCallLicenseRemoteValidate()) await validateOnServer(lic.licenseKey, fp);
      } catch {
        /* ignore network */
      }
      onLicensed?.();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const copyDeviceId = async () => {
    if (!deviceId) return;
    try {
      await navigator.clipboard.writeText(deviceId);
      setDeviceIdCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={rootClass}>
      <div className={`flex shrink-0 items-center justify-between px-6 py-5 border-b ${borderClass}`}>
        <span className="text-xl font-medium">{time}</span>
        <span className={`text-xl font-semibold ${isKiosk ? 'text-black' : 'text-pos-text'}`}>{title}</span>
        <div className="w-16" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col items-center gap-4 overflow-y-auto p-6">
        <img
          src={publicAssetUrl('/logo.png')}
          alt=""
          className="max-h-[500px] w-auto max-w-[min(240px,85vw)] object-contain shrink-0"
          onError={(ev) => {
            ev.currentTarget.style.display = 'none';
          }}
        />

        <div className="w-full max-w-lg space-y-2">
          <h1 className={`text-2xl font-semibold ${isKiosk ? 'text-black' : 'text-white'}`}>{t('license.title')}</h1>
        </div>

        {errorKey && (
          <div
            className={`w-full max-w-lg rounded-lg border px-3 py-2 text-lg ${
              isKiosk ? 'border-red-300 bg-red-50 text-red-900' : 'border-red-500/50 bg-red-950/40 text-red-200'
            }`}
            role="alert"
          >
            {t(errorKey)}
          </div>
        )}

        <div className={`w-full max-w-lg rounded-xl p-4 space-y-2 ${panelClass}`}>
          <div className={`text-lg font-medium ${isKiosk ? 'text-gray-800' : 'text-pos-text'}`}>{t('license.deviceId')}</div>
          <button
            type="button"
            onClick={copyDeviceId}
            disabled={!deviceId || deviceIdLoading}
            className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-lg break-all transition-colors disabled:opacity-50 ${
              isKiosk
                ? 'border-gray-300 bg-white text-black hover:bg-gray-100'
                : 'border-pos-border bg-pos-bg text-white hover:border-white/40'
            }`}
            aria-label={t('license.deviceIdCopyAria')}
          >
            {deviceIdLoading ? t('license.uuidLoading') : deviceId || t('license.uuidUnavailable')}
          </button>
          {deviceIdCopied && <p className="text-md text-green-600">{t('license.deviceIdCopied')}</p>}
        </div>

        <div className={`w-full max-w-lg rounded-xl p-4 space-y-2 ${panelClass}`}>
          <div className={`text-lg font-medium ${isKiosk ? 'text-gray-800' : 'text-pos-text'}`}>{t('license.uploadLicense')}</div>
          <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={handlePickFile} />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={`w-full rounded-lg border py-2 font-medium transition-colors disabled:opacity-50 ${
              isKiosk
                ? 'border-gray-400 text-gray-800 hover:bg-gray-100'
                : 'border-gray-400 text-white hover:border-white/40'
            }`}
          >
            {busy ? t('license.importing') : t('license.uploadLicense')}
          </button>
        </div>
      </div>
    </div>
  );
}
