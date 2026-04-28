import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Reusable dropdown component.
 * When inline=false (default): options list is portaled to document.body with position:fixed so it appears above keyboard/modals.
 * When inline=true: options list is rendered directly under the trigger (position:absolute) so it appears under the dropdown.
 * @param {Object} props
 * @param {{ value: string, label: string }[]} props.options - List of { value, label }
 * @param {string} props.value - Current selected value
 * @param {(value: string) => void} props.onChange - Called when selection changes
 * @param {string} [props.placeholder] - Placeholder when no value selected
 * @param {boolean} [props.disabled] - Disable the dropdown
 * @param {boolean} [props.inline] - If true, render options list under the trigger (no portal)
 * @param {string} [props.className] - Additional classes for the trigger button
 * @param {string} [props.labelClassName] - Additional classes for the option list container
 * @param {boolean} [props.openUp] - Force the list to open above the trigger (portaled mode only)
 */
export function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  inline = false,
  className = '',
  labelClassName = '',
  openUp = false,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || inline) return;
    const updatePosition = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const gap = 6;
        const viewportPadding = 8;
        const desiredHeight = 240;
        const minHeight = 120;
        const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
        const spaceAbove = Math.max(0, rect.top - viewportPadding);
        const shouldOpenUp = openUp || (spaceBelow < minHeight && spaceAbove > spaceBelow);
        const maxHeight = Math.max(minHeight, Math.min(desiredHeight, shouldOpenUp ? spaceAbove : spaceBelow));
        const top = shouldOpenUp ? Math.max(viewportPadding, rect.top - maxHeight - gap) : rect.bottom + gap;
        setPosition({ top, left: rect.left, width: rect.width, maxHeight });
      }
    };
    updatePosition();
    const raf = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, inline, openUp]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const inTrigger = ref.current && ref.current.contains(e.target);
      const inList = listRef.current && listRef.current.contains(e.target);
      if (!inTrigger && !inList) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((opt) => opt.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  const listCommonClasses = `w-full py-1 bg-pos-bg border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto z-[10000] [scrollbar-width:thin] [scrollbar-color:#9ca3af_#34495e] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-pos-panel [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-pos-panel active:[&::-webkit-scrollbar-thumb]:bg-gray-300 ${labelClassName}`;

  const listContent = open ? (
    <ul
      ref={listRef}
      className={inline ? `absolute top-full left-0 mt-1 ${listCommonClasses}` : `fixed ${listCommonClasses}`}
      role="listbox"
      style={inline ? undefined : { top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
    >
      {options.map((opt) => (
        <li
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          className={`px-4 py-2 cursor-pointer text-md transition-colors ${
            opt.value === value
              ? 'bg-green-600 text-white font-medium'
              : 'text-pos-text hover:bg-green-500 hover:text-white active:bg-green-600 active:text-white'
          }`}
          onClick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
        >
          {opt.label}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="w-full flex items-center h-[40px] justify-between gap-2 px-4 py-3 text-left border border-gray-300 rounded-lg bg-pos-panel text-white text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={displayLabel}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <svg className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {inline ? listContent : (typeof document !== 'undefined' && open && createPortal(listContent, document.body))}
    </div>
  );
}
