import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations';

function tx(t, key) {
  const out = t(key);
  if (out !== key) return out;
  return translations.en[key] ?? key;
}

const inputClass =
  'w-full rounded-lg border border-pos-border bg-pos-bg px-3 py-2.5 text-sm text-pos-text outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20';

export function DeviceRegisterModal({ verifyFailed = false, apiPrefix, onLogin }) {
  const { t } = useLanguage();
  const [registerName, setRegisterName] = useState('');
  const [ipField, setIpField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const titleKey = verifyFailed ? 'deviceGateTitleVerifyFailed' : 'deviceGateTitle';

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-pos-bg px-4 py-10 text-pos-text">
      <div className="w-full max-w-md rounded-xl border border-pos-border bg-pos-panel p-6 shadow-xl">
        <h1 className="text-center text-xl font-semibold text-pos-text">{tx(t, titleKey)}</h1>

        <div className="mt-6 space-y-3 text-left">
          <div>
            <label htmlFor="device-gate-register-name" className="mb-1 block text-xs font-medium text-pos-text-dim">
              {tx(t, 'deviceGateRegisterNameLabel')}
            </label>
            <input
              id="device-gate-register-name"
              type="text"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              placeholder={tx(t, 'deviceGateRegisterNamePlaceholder')}
              className={inputClass}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="device-gate-ip" className="mb-1 block text-xs font-medium text-pos-text-dim">
              {tx(t, 'deviceGateIpFieldLabel')}
            </label>
            <input
              id="device-gate-ip"
              type="text"
              value={ipField}
              onChange={(e) => setIpField(e.target.value)}
              placeholder={tx(t, 'deviceGateIpFieldPlaceholder')}
              className={`${inputClass} font-mono`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {formError ? (
            <p className="text-sm text-red-400" role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={submitting}
          className="mt-8 w-full rounded-lg bg-pos-bg py-3 text-sm font-medium text-white border border-transparent hover:border-white/30 active:bg-green-600 disabled:opacity-50 disabled:pointer-events-none"
          onClick={() => {
            setFormError('');
            const name = String(registerName || '').trim();
            const ip = String(ipField || '').trim();
            if (!name || !ip) {
              setFormError(tx(t, 'deviceGateBindMissingFields'));
              return;
            }
            if (!apiPrefix || !onLogin) return;
            setSubmitting(true);
            void (async () => {
              try {
                const res = await fetch(`${apiPrefix}/pos-registers/terminal-bind`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, ip }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setFormError(String(data.error || tx(t, 'deviceGateBindFailed')));
                  return;
                }
                if (!data.token) {
                  setFormError(tx(t, 'deviceGateBindFailed'));
                  return;
                }
                await onLogin(data.token);
              } catch {
                setFormError(tx(t, 'deviceGateBindFailed'));
              } finally {
                setSubmitting(false);
              }
            })();
          }}
        >
          {submitting ? tx(t, 'deviceGateLoginWorking') : tx(t, 'deviceGateLogin')}
        </button>
      </div>
    </div>
  );
}
