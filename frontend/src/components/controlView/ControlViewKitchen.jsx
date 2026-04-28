import React from 'react';
import { PaginationArrows } from '../PaginationArrows';

export function ControlViewKitchen({
  tr,
  openNewKitchenModal,
  kitchens,
  kitchenListRef,
  updateKitchenScrollState,
  openKitchenProductsModal,
  openEditKitchenModal,
  setDeleteConfirmKitchenId,
  canKitchenScrollUp,
  canKitchenScrollDown,
  scrollKitchenByPage
}) {
  return (
    <div className="relative min-h-[650px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
      <div className="flex items-center w-full justify-center mb-2">
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors"
          onClick={openNewKitchenModal}
        >
          {tr('control.kitchen.newKitchen', 'New Kitchen')}
        </button>
      </div>
      {kitchens.length === 0 ? (
        <ul className="w-full flex flex-col">
          <li className="text-pos-muted text-xl py-4 text-center">{tr('control.kitchen.empty', 'No kitchens yet.')}</li>
        </ul>
      ) : (
        <>
          <div
            ref={kitchenListRef}
            className="max-h-[510px] overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onScroll={updateKitchenScrollState}
          >
            <ul className="w-full flex flex-col">
              {kitchens.map((m) => {
                const kitchenHasProducts = Array.isArray(m.productIds) && m.productIds.length > 0;
                return (
                  <li
                    key={m.id}
                    className="flex items-center w-full gap-2 px-4 py-2 bg-pos-bg border-y border-pos-panel text-pos-text text-sm"
                  >
                    <span className="min-w-0 flex-1 font-medium truncate" title={m.name || '—'}>{m.name || '—'}</span>
                    <div className="justify-center min-w-0 absolute left-1/2">
                      <button
                        type="button"
                        className={`shrink-0 py-1.5 text-xs font-semibold active:bg-green-500 active:border-white/30 ${kitchenHasProducts ? 'text-white' : 'text-pos-muted'}`}
                        onClick={() => openKitchenProductsModal(m)}
                      >
                        {tr('control.kitchen.setProduct', 'Set product')}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="p-2 rounded text-pos-text mr-5 active:text-green-500"
                        onClick={() => openEditKitchenModal(m)}
                        aria-label="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded text-pos-text active:text-rose-500"
                        onClick={() => setDeleteConfirmKitchenId(m.id)}
                        aria-label="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <PaginationArrows
            canPrev={canKitchenScrollUp}
            canNext={canKitchenScrollDown}
            onPrev={() => scrollKitchenByPage('up')}
            onNext={() => scrollKitchenByPage('down')}
          />
        </>
      )}
    </div>
  );
}
