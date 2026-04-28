import React from 'react';
import { Dropdown } from '../Dropdown';

export function ControlViewKitchenAssignProductsModal({
  tr,
  showKitchenProductsModal,
  kitchenProductsKitchen,
  closeKitchenProductsModal,
  loadingKitchenProductsCatalog,
  kitchenProductsModalCategories,
  kitchenProductsCategoryFilter,
  setKitchenProductsCategoryFilter,
  kitchenProductsCatalog,
  kitchenProductsAvailable,
  kitchenProductsLeftSelectedIds,
  setKitchenProductsLeftSelectedIds,
  kitchenProductsLeftListRef,
  handleAddKitchenProductLinks,
  kitchenProductsLinked,
  kitchenProductsRightSelectedIds,
  setKitchenProductsRightSelectedIds,
  kitchenProductsRightListRef,
  removeKitchenProductLink,
  handleRemoveKitchenProductLinks,
  handleSaveKitchenProducts,
  savingKitchenProducts
}) {
  if (!showKitchenProductsModal || !kitchenProductsKitchen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative bg-pos-bg rounded-xl min-w-[600px] border border-pos-border shadow-2xl p-6 text-sm max-h-[90vh] overflow-auto [scrollbar-width:none]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-2 right-4 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500"
          onClick={closeKitchenProductsModal}
          aria-label="Close"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-4 mt-6">
          <Dropdown
            options={[
              { value: '', label: tr('control.kitchen.allCategories', 'All categories') },
              ...kitchenProductsModalCategories.map((c) => ({ value: c.id, label: c.name }))
            ]}
            value={kitchenProductsCategoryFilter}
            onChange={setKitchenProductsCategoryFilter}
            className="w-full max-w-[200px]"
          />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch min-h-[280px]">
            <div className="flex flex-col rounded-lg border border-pos-border bg-pos-panel/30 overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-pos-border bg-pos-panel/50 font-medium text-pos-text shrink-0">
                {tr('control.kitchen.availableProducts', 'Available products')}
              </div>
              <label
                className={`flex items-center gap-2 px-3 py-2 border-b border-pos-border text-pos-text shrink-0 cursor-pointer active:bg-green-500 ${!kitchenProductsAvailable.length ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={
                    kitchenProductsAvailable.length > 0 &&
                    kitchenProductsAvailable.every((p) => kitchenProductsLeftSelectedIds.has(p.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setKitchenProductsLeftSelectedIds(new Set(kitchenProductsAvailable.map((p) => p.id)));
                    } else {
                      setKitchenProductsLeftSelectedIds(new Set());
                    }
                  }}
                  className="rounded"
                />
                <span>{tr('control.productSubproducts.selectAll', 'Select all')}</span>
              </label>
              <div
                ref={kitchenProductsLeftListRef}
                className="flex-1 overflow-y-auto p-2 min-h-[350px] max-h-[350px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {loadingKitchenProductsCatalog && kitchenProductsCatalog.length === 0 ? null : kitchenProductsCatalog.length === 0 ? (
                  <div className="text-pos-muted px-2 py-4">{tr('control.kitchen.productsEmpty', 'No products yet.')}</div>
                ) : kitchenProductsAvailable.length === 0 ? (
                  <div className="text-pos-muted px-2 py-4">
                    {kitchenProductsCategoryFilter
                      ? tr('control.kitchen.noProductsInCategory', 'No products in this category.')
                      : tr('control.kitchen.allLinkedOrEmpty', 'All matching products are linked.')}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {kitchenProductsAvailable.map((p) => (
                      <li key={p.id}>
                        <label className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer active:bg-green-500 text-pos-text">
                          <input
                            type="checkbox"
                            checked={kitchenProductsLeftSelectedIds.has(p.id)}
                            onChange={(e) => {
                              setKitchenProductsLeftSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              });
                            }}
                            className="rounded"
                          />
                          <span className="truncate">{p.name || p.id}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-3 py-2 border-t border-pos-border shrink-0">
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 py-2 rounded bg-green-600/80 active:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAddKitchenProductLinks}
                  disabled={!kitchenProductsLeftSelectedIds.size}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {tr('control.productSubproducts.add', 'Add')}
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center text-pos-muted shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>

            <div className="flex flex-col rounded-lg border border-pos-border bg-pos-panel/30 overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-pos-border bg-pos-panel/50 font-medium text-pos-text shrink-0">
                {tr('control.kitchen.linkedProducts', 'Linked to kitchen')}
              </div>
              <label
                className={`flex items-center gap-2 px-3 py-2 border-b border-pos-border text-pos-text shrink-0 cursor-pointer active:bg-green-500 ${!kitchenProductsLinked.length ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={
                    kitchenProductsLinked.length > 0 &&
                    kitchenProductsLinked.every((l) => kitchenProductsRightSelectedIds.has(l.productId))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setKitchenProductsRightSelectedIds(new Set(kitchenProductsLinked.map((l) => l.productId)));
                    } else {
                      setKitchenProductsRightSelectedIds(new Set());
                    }
                  }}
                  className="rounded"
                />
                <span>{tr('control.productSubproducts.selectAll', 'Select all')}</span>
              </label>
              <div
                ref={kitchenProductsRightListRef}
                className="flex-1 overflow-y-auto p-2 min-h-[350px] max-h-[350px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {loadingKitchenProductsCatalog && kitchenProductsLinked.length === 0 ? null : kitchenProductsLinked.length === 0 ? (
                  <div className="text-pos-muted px-2 py-4">
                    {tr('control.kitchen.noLinkedProducts', 'No products linked yet.')}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {kitchenProductsLinked.map((link) => (
                      <li key={link.productId}>
                        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded cursor-pointer active:bg-green-500 text-pos-text group">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={kitchenProductsRightSelectedIds.has(link.productId)}
                              onChange={(e) => {
                                setKitchenProductsRightSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(link.productId);
                                  else next.delete(link.productId);
                                  return next;
                                });
                              }}
                              className="rounded shrink-0"
                              onClick={(ev) => ev.stopPropagation()}
                            />
                            <span className="truncate">{link.productName}</span>
                          </div>
                          <button
                            type="button"
                            className="p-1 rounded active:bg-green-500 text-pos-muted active:text-red-400 shrink-0 opacity-0 group-active:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              removeKitchenProductLink(link.productId);
                            }}
                            aria-label={tr('delete', 'Delete')}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-3 py-2 border-t border-pos-border shrink-0">
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 py-2 rounded bg-red-600/80 active:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleRemoveKitchenProductLinks}
                  disabled={!kitchenProductsRightSelectedIds.size}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {tr('control.productSubproducts.remove', 'Remove')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center shrink-0">
          <button
            type="button"
            className="px-6 py-3 rounded-lg bg-green-600 text-white text-sm font-medium active:bg-green-500 disabled:opacity-50"
            onClick={handleSaveKitchenProducts}
            disabled={savingKitchenProducts || loadingKitchenProductsCatalog || !kitchenProductsKitchen}
          >
            {savingKitchenProducts ? tr('control.saving', 'Saving...') : tr('control.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
