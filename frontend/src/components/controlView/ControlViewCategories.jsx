import React from 'react';
import { PaginationArrows } from '../PaginationArrows';

export function ControlViewCategories({
  tr,
  categories,
  categoriesLoading,
  openCategoryModal,
  categoriesListRef,
  updateCategoriesScrollState,
  handleMoveCategory,
  openEditCategoryModal,
  setDeleteConfirmCategoryId,
  canCategoriesScrollUp,
  canCategoriesScrollDown,
  scrollCategoriesByPage
}) {
  const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="relative min-h-[650px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
      <div className="flex items-center w-full justify-center mb-2">
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors"
          onClick={openCategoryModal}
        >
          {tr('control.categories.new', 'New category')}
        </button>
      </div>
      {categoriesLoading && sortedCategories.length === 0 ? null : sortedCategories.length === 0 ? (
        <ul className="w-full flex flex-col">
          <li className="text-pos-muted text-xl font-medium text-center py-4">{tr('control.categories.empty', 'No categories yet.')}</li>
        </ul>
      ) : (
        <>
          <div
            ref={categoriesListRef}
            className="max-h-[510px] overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onScroll={updateCategoriesScrollState}
          >
            <ul className="w-full flex flex-col">
              {sortedCategories.map((cat, index) => (
                <li
                  key={cat.id}
                  className="flex items-center w-full justify-between px-4 py-2 bg-pos-bg border-y border-pos-panel text-pos-text text-sm"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="p-2 rounded text-pos-text active:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => handleMoveCategory(cat.id, 'down')}
                      disabled={index >= sortedCategories.length - 1}
                      aria-label="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded text-pos-text active:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => handleMoveCategory(cat.id, 'up')}
                      disabled={index <= 0}
                      aria-label="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v14" /></svg>
                    </button>
                  </div>
                  <span className="flex-1 text-center font-medium">{cat.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="p-2 mr-5 rounded text-pos-text active:bg-green-500"
                      onClick={() => openEditCategoryModal(cat)}
                      aria-label="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded text-pos-text active:text-rose-500"
                      onClick={() => setDeleteConfirmCategoryId(cat.id)}
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {sortedCategories.length > 0 && (
        <PaginationArrows
          canPrev={canCategoriesScrollUp}
          canNext={canCategoriesScrollDown}
          onPrev={() => scrollCategoriesByPage('up')}
          onNext={() => scrollCategoriesByPage('down')}
        />
      )}
    </div>
  );
}
