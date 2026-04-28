import React from 'react';
import { PaginationArrows } from '../PaginationArrows';

export function ControlViewPriceGroups({
  tr,
  priceGroupsLoading,
  openPriceGroupModal,
  priceGroups,
  priceGroupsListRef,
  updatePriceGroupsScrollState,
  openEditPriceGroupModal,
  setDeleteConfirmId,
  canPriceGroupsScrollUp,
  canPriceGroupsScrollDown,
  scrollPriceGroupsByPage
}) {
  return (
    <div className="relative min-h-[650px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
      <div className="flex items-center w-full justify-center mb-2">
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors"
          onClick={openPriceGroupModal}
        >
          {tr('control.priceGroups.new', 'New price group')}
        </button>
      </div>
      {(() => {
        if (priceGroupsLoading && priceGroups.length === 0) {
          return null;
        }
        if (priceGroups.length === 0) {
          return <ul className="w-full flex flex-col"><li className="text-pos-muted text-xl font-medium text-center py-4">{tr('control.priceGroups.empty', 'No price groups yet.')}</li></ul>;
        }
        return (
          <>
            <div
              ref={priceGroupsListRef}
              className="max-h-[510px] overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onScroll={updatePriceGroupsScrollState}
            >
              <ul className="w-full flex flex-col">
                {priceGroups.map((pg) => (
                  <li
                    key={pg.id}
                    className="flex items-center w-full justify-between px-4 py-2 bg-pos-bg border-y border-pos-panel text-pos-text text-sm"
                  >
                    <span className="font-medium">{pg.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="p-2 rounded text-pos-text mr-5 active:text-green-500"
                        onClick={() => openEditPriceGroupModal(pg)}
                        aria-label="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded text-pos-text active:text-rose-500"
                        onClick={() => setDeleteConfirmId(pg.id)}
                        aria-label="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <PaginationArrows
              canPrev={canPriceGroupsScrollUp}
              canNext={canPriceGroupsScrollDown}
              onPrev={() => scrollPriceGroupsByPage('up')}
              onNext={() => scrollPriceGroupsByPage('down')}
            />
          </>
        );
      })()}
    </div>
  );
}
