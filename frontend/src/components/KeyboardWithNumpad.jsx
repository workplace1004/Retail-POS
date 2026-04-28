import React, { useEffect, useState } from 'react';

// Alphanumeric layout (AZERTY-style): row1 a z e r t y u i o p, row2 q s d f g h j k l m, row3 w x c v b n , €
const ROW1 = 'a z e r t y u i o p'.split(' ');
const ROW2 = 'q s d f g h j k l m'.split(' ');
const ROW3 = 'w x c v b n , €'.split(' ');
const NUMPAD = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['-', '0', '.']];

const KEY_STYLE = 'w-[60px] h-[50px] bg-pos-panel rounded text-white text-2xl active:bg-green-500 border border-transparent transition-colors';

/**
 * Reusable virtual keyboard with alphanumeric keys and numpad.
 * @param {string} value - Current input value (controlled)
 * @param {(value: string) => void} onChange - Called when value changes (e.g. after key press)
 * @param {string} [className] - Optional wrapper className
 */
export function KeyboardWithNumpad({
  value = '',
  onChange,
  className = '',
  selectionStart = null,
  selectionEnd = null,
  onSelectionChange
}) {
  const [uppercase, setUppercase] = useState(false);
  const [internalSelectionStart, setInternalSelectionStart] = useState(String(value).length);
  const [internalSelectionEnd, setInternalSelectionEnd] = useState(String(value).length);

  const display = (k) => (/^[a-z]$/.test(k) ? (uppercase ? k.toUpperCase() : k) : k);

  const hasSelectionApi = Number.isInteger(selectionStart) && Number.isInteger(selectionEnd) && typeof onSelectionChange === 'function';
  const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined';

  useEffect(() => {
    if (hasSelectionApi) return;
    const len = String(value).length;
    setInternalSelectionStart((prev) => Math.min(len, Math.max(0, prev)));
    setInternalSelectionEnd((prev) => Math.min(len, Math.max(0, prev)));
  }, [value, hasSelectionApi]);

  const readActiveInputSelection = () => {
    if (!hasWindow) return null;
    const active = document.activeElement;
    if (!active) return null;
    const isInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA';
    if (!isInput) return null;
    if (typeof active.selectionStart !== 'number' || typeof active.selectionEnd !== 'number') return null;
    return {
      start: active.selectionStart,
      end: active.selectionEnd,
      element: active
    };
  };

  const getSelectionRange = () => {
    if (hasSelectionApi) {
      return {
        start: Math.max(0, Math.min(selectionStart, selectionEnd)),
        end: Math.max(0, Math.max(selectionStart, selectionEnd))
      };
    }
    const activeSel = readActiveInputSelection();
    if (activeSel) {
      const start = Math.max(0, Math.min(activeSel.start, activeSel.end));
      const end = Math.max(0, Math.max(activeSel.start, activeSel.end));
      setInternalSelectionStart(start);
      setInternalSelectionEnd(end);
      return { start, end };
    }
    return {
      start: Math.max(0, Math.min(internalSelectionStart, internalSelectionEnd)),
      end: Math.max(0, Math.max(internalSelectionStart, internalSelectionEnd))
    };
  };

  const applySelection = (start, end) => {
    if (hasSelectionApi) {
      onSelectionChange(start, end);
      return;
    }
    setInternalSelectionStart(start);
    setInternalSelectionEnd(end);
    const activeSel = readActiveInputSelection();
    if (activeSel?.element && typeof activeSel.element.setSelectionRange === 'function') {
      const el = activeSel.element;
      window.requestAnimationFrame(() => {
        try {
          el.focus();
          el.setSelectionRange(start, end);
        } catch {}
      });
    }
  };

  const moveCursor = (direction) => {
    const { start, end } = getSelectionRange();
    const len = String(value).length;
    if (direction === 'left') {
      const next = Math.max(0, start - 1);
      applySelection(next, next);
      return;
    }
    const next = Math.min(len, end + 1);
    applySelection(next, next);
  };

  const sendKey = (char) => {
    const { start, end } = getSelectionRange();
    if (char === 'Backspace') {
      if (start !== end) {
        onChange(value.slice(0, start) + value.slice(end));
        applySelection(start, start);
        return;
      }
      if (start > 0) {
        const nextPos = start - 1;
        onChange(value.slice(0, nextPos) + value.slice(end));
        applySelection(nextPos, nextPos);
      }
      return;
    }
    const text = String(char ?? '');
    if (!text) return;
    const next = value.slice(0, start) + text + value.slice(end);
    const nextPos = start + text.length;
    onChange(next);
    applySelection(nextPos, nextPos);
  };

  const sendLetterOrSymbol = (k) => {
    if (/^[a-z]$/.test(k)) sendKey(uppercase ? k.toUpperCase() : k);
    else sendKey(k);
  };

  return (
    <div
      className={`p-4 flex gap-4 flex-wrap ${className}`}
      onMouseDownCapture={(e) => {
        // Keep focus on the currently edited input so caret stays visible.
        if (e.target instanceof HTMLElement && e.target.closest('button')) e.preventDefault();
      }}
    >
      <div className="flex gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1.5">
            {ROW1.map((k) => (
              <button key={k} type="button" className={KEY_STYLE} onClick={() => sendLetterOrSymbol(k)}>
                {display(k)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {ROW2.map((k) => (
              <button key={k} type="button" className={KEY_STYLE} onClick={() => sendLetterOrSymbol(k)}>
                {display(k)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {ROW3.map((k) => (
              <button key={k} type="button" className={KEY_STYLE} onClick={() => sendLetterOrSymbol(k)}>
                {display(k)}
              </button>
            ))}
            <button type="button" className={`${KEY_STYLE} min-w-[126px] active:bg-green-500`} onClick={() => sendKey('Backspace')} aria-label="Backspace">
              ←
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`${KEY_STYLE} ${uppercase ? 'bg-blue-600 ring-2 ring-blue-400' : ''} active:bg-green-500`}
              onClick={() => setUppercase((p) => !p)}
              title="Shift"
            >
              ↑
            </button>
            <button type="button" className={KEY_STYLE} onClick={() => sendKey('@')}>
              @
            </button>
            <button type="button" className={KEY_STYLE} onClick={() => sendKey('/')}>
              /
            </button>
            <button type="button" className="bg-pos-panel rounded active:bg-green-500 w-[258px] h-[50px] border border-transparent transition-colors" onClick={() => sendKey(' ')} aria-label="Space" />
            <button type="button" className={KEY_STYLE} onClick={() => sendKey('Backspace')} aria-label="Backspace">
              _
            </button>
            <button type="button" className={KEY_STYLE} onClick={() => moveCursor('left')} aria-label="Move cursor left">
              ←
            </button>
            <button type="button" className={KEY_STYLE} onClick={() => moveCursor('right')} aria-label="Move cursor right">
              →
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {NUMPAD.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map((k) => (
                <button key={k} type="button" className={KEY_STYLE} onClick={() => sendKey(k)}>
                  {k}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

