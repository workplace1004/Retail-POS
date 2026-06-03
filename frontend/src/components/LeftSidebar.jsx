import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
const LANG_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'nl', label: 'NL' },
  { value: 'fr', label: 'FR' },
  { value: 'tr', label: 'TR' },
];

export function LeftSidebar({ categories, selectedCategoryId, onSelectCategory, currentUser, onControlClick, onLogout, time }) {
  const { t } = useLanguage();
  const categoriesListRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = categoriesListRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(maxScrollTop - el.scrollTop > 1);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [categories, updateScrollState]);

  const scrollCategories = (direction) => {
    const el = categoriesListRef.current;
    if (!el) return;
    const amount = Math.max(80, Math.round(el.clientHeight * 0.35));
    el.scrollBy({ top: direction * amount, behavior: 'smooth' });
  };

  return (
    <aside className="w-[18%] shrink-0 flex flex-col bg-pos-bg p-4 px-2">

      <div className="flex items-center mb-4 gap-2 px-1">
        <button
          type="button"
          onClick={() => onLogout?.()}
          className="w-10 h-10 rounded-md bg-pos-panel/60 text-pos-text flex items-center justify-center active:bg-green-500 shrink-0"
          aria-label={t('logOut')}
          title={t('logOut')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 flex justify-center pr-10">
          <div className="text-3xl font-semibold text-pos-text">{time != null ? time : '--:--'}</div>
        </div>
      </div>
      <div
        ref={categoriesListRef}
        onScroll={updateScrollState}
        className="flex flex-col text-md gap-1 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
      >
        {categories.map((cat) => (
          <button
            type="button"
            key={cat.id}
            className={`flex items-center gap-2 text-left px-4 py-3 rounded-lg ${selectedCategoryId === cat.id ? 'bg-pos-panel font-medium text-green-500 border border-green-500' : 'bg-pos-panel/50 text-pos-text'
              }`}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 py-2 w-full">
        <button
          type="button"
          onClick={() => scrollCategories(-1)}
          disabled={!canScrollUp}
          className={`w-full h-8 rounded-md border border-pos-border flex items-center justify-center text-pos-text ${
            canScrollUp ? 'bg-pos-panel/60 active:bg-green-500' : 'bg-pos-panel/30 opacity-40 cursor-not-allowed'
          }`}
          aria-label="Scroll categories up"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollCategories(1)}
          disabled={!canScrollDown}
          className={`w-full h-8 rounded-md border border-pos-border flex items-center justify-center text-pos-text ${
            canScrollDown ? 'bg-pos-panel/60 active:bg-green-500' : 'bg-pos-panel/30 opacity-40 cursor-not-allowed'
          }`}
          aria-label="Scroll categories down"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col items-center border-t border-gray-500">
        <div className="px-4 py-1 text-center flex flex-col">
          {currentUser && (
            <span className="text-xl font-medium mb-1 text-pos-text">{currentUser.label}</span>
          )}
        </div>
        <div className="px-10 py-1 flex flex-col gap-2 items-center w-full">
          <button
            type="button"
            className="bg-transparent border-none text-red-500 text-2xl font-semibold p-0 active:text-red-400"
            onClick={() => onControlClick?.()}
          >
            {t('control')}
          </button>
        </div>
      </div>

    </aside>
  );
}
