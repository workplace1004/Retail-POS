import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Dropdown } from './Dropdown';

import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';
import { posTerminalAuthHeaders } from '../lib/posTerminalSession.js';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';
const TOAST_DURATION_MS = 3500;
const PIN_LEN = 4;

const PAD = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['Again', '0']
];

export function LoginScreen({ time, onLogin }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const loginSubmittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/users`, { headers: { ...posTerminalAuthHeaders() } })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setUsers(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setUsers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = (message) => setToast(message);

  const keypadLocked = loading || !selectedUser;

  const handlePadKey = (key) => {
    if (keypadLocked) return;
    if (key === 'Again') {
      setPinInput('');
      return;
    }
    setPinInput((prev) => (prev.length >= PIN_LEN ? prev : prev + key));
  };

  useEffect(() => {
    if (pinInput.length !== PIN_LEN) return;
    if (loginSubmittingRef.current) return;
    loginSubmittingRef.current = true;

    let cancelled = false;

    const run = async () => {
      try {
        if (!selectedUser) {
          if (!cancelled) {
            showToast(t('loginSelectUser'));
            setPinInput('');
          }
          return;
        }
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...posTerminalAuthHeaders() },
          body: JSON.stringify({ userId: selectedUser.id, pin: pinInput })
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          let msg = data.error || t('loginWrongPin');
          if (res.status === 403) {
            const err = String(data.error || '');
            if (err.includes('No POS registers')) msg = t('loginNoRegistersConfigured');
            else if (err.includes('not registered')) msg = t('loginTerminalNotRegistered');
            else if (err.includes('not assigned')) msg = t('loginTerminalUserNotAllowed');
          }
          showToast(msg);
          setPinInput('');
          return;
        }
        onLogin?.(data);
      } catch {
        if (!cancelled) {
          showToast(t('loginFailed'));
          setPinInput('');
        }
      } finally {
        if (!cancelled) loginSubmittingRef.current = false;
      }
    };

    void run();
    return () => {
      cancelled = true;
      loginSubmittingRef.current = false;
    };
  }, [pinInput, selectedUser, onLogin, t]);

  return (
    <div className="flex flex-col h-full bg-pos-bg text-pos-text">
      <div className="flex shrink-0 items-center justify-between px-6 py-5 border-b border-pos-border">
        <span className="text-xl font-medium">{time}</span>
        <span className="text-xl font-semibold text-pos-text">Retail</span>
        <div className="w-16" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col items-center gap-6 p-6">
        <img
          src={publicAssetUrl('/logo.png')}
          alt=""
          className="max-h-[250px] w-auto max-w-[min(280px,85vw)] object-contain shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="w-full -mt-10 max-w-md">
          {loading ? (
            <p className="text-pos-muted text-xl text-center py-3">{t('loginLoadingUsers')}</p>
          ) : (
            <Dropdown
              options={users.map((u) => ({ value: String(u.id), label: u.label }))}
              value={selectedUser ? String(selectedUser.id) : ''}
              onChange={(userId) => {
                const u = users.find((x) => String(x.id) === userId);
                setSelectedUser(u || null);
                setPinInput('');
              }}
              placeholder={t('loginSelectUser')}
              disabled={users.length === 0}
              className="w-full min-h-[48px]"
            />
          )}
        </div>

        <div className="bg-pos-panel rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="mb-4 h-16 flex items-center bg-pos-bg justify-center rounded text-xl font-mono text-white tracking-widest">
            {pinInput.replace(/./g, '•') || t('pin')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PAD.map((row, ri) =>
              row.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={keypadLocked}
                  className={`col-span-1 py-2 rounded-lg font-semibold transition-colors border border-transparent disabled:opacity-40 disabled:cursor-not-allowed disabled:active:bg-pos-bg ${key === 'Again'
                    ? 'col-span-2 text-xl bg-pos-bg text-white enabled:active:border-white'
                    : 'bg-pos-bg text-xl text-white enabled:active:border-white'
                    } enabled:active:bg-green-500`}
                  onClick={() => {
                    if (key === 'Again') handlePadKey('Again');
                    else handlePadKey(key);
                  }}
                >
                  {key === 'Again' ? t('again') : key}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed top-8 right-8 z-50 flex items-stretch rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl shadow-black/40 border border-white/10 overflow-hidden min-w-[280px]"
          role="alert"
          aria-live="polite"
        >
          <div className="flex-shrink-0 w-1 bg-amber-400/90" aria-hidden />
          <div className="flex items-center gap-3 py-4 pr-6 pl-2">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center" aria-hidden>
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <p className="text-lg font-medium tracking-tight text-white/95">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
}
