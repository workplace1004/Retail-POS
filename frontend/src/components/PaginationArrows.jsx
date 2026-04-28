import React from 'react';

/**
 * Reusable pagination arrows (previous / next page).
 * Renders a fixed bar at the bottom of the parent (parent must have position: relative).
 * @param {boolean} canPrev - Whether previous page is available (enables arrow up)
 * @param {boolean} canNext - Whether next page is available (enables arrow down)
 * @param {() => void} onPrev - Called when arrow up is clicked
 * @param {() => void} onNext - Called when arrow down is clicked
 * @param {string} [className] - Optional extra classes for the wrapper
 */
export function PaginationArrows({ canPrev, canNext, onPrev, onNext, className = '' }) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-40 py-2  z-10 ${className}`.trim()}
      role="navigation"
      aria-label="Pagination"
    >
      <button
        type="button"
        className="p-3 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        disabled={!canPrev}
        onClick={onPrev}
        aria-label="Previous page"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11 17V5.414l3.293 3.293a.999.999 0 101.414-1.414l-5-5a.999.999 0 00-1.414 0l-5 5a.997.997 0 000 1.414.999.999 0 001.414 0L9 5.414V17a1 1 0 102 0z" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className="p-3 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        disabled={!canNext}
        onClick={onNext}
        aria-label="Next page"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M10.707 17.707l5-5a.999.999 0 10-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-3.293-3.293a.999.999 0 10-1.414 1.414l5 5a.999.999 0 001.414 0z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
