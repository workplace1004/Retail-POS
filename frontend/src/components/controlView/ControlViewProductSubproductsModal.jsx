import React from 'react';
import { Dropdown } from '../Dropdown';

export function ControlViewProductSubproductsModal({
  tr,
  showProductSubproductsModal,
  closeProductSubproductsModal,
  loadingProductSubproductsLinked,
  subproductGroups,
  productSubproductsGroupId,
  setProductSubproductsGroupId,
  productSubproductsAvailable,
  productSubproductsLeftSelectedIds,
  setProductSubproductsLeftSelectedIds,
  productSubproductsLeftListRef,
  handleAddProductSubproductLinks,
  productSubproductsLinked,
  productSubproductsRightSelectedIds,
  setProductSubproductsRightSelectedIds,
  productSubproductsListRef,
  removeProductSubproductLink,
  handleRemoveProductSubproductLinks,
  handleSaveProductSubproducts,
  savingProductSubproducts,
  productSubproductsProduct,
  onUserEdited
}) {
  if (!showProductSubproductsModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-pos-bg rounded-xl min-w-[600px] border border-pos-border shadow-2xl p-6 text-sm max-h-[90vh] overflow-auto [scrollbar-width:none]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeProductSubproductsModal} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div
          className="space-y-4 mt-6"
          onChangeCapture={() => onUserEdited?.()}
          onInputCapture={() => onUserEdited?.()}
        >
          {loadingProductSubproductsLinked && (
            <div className="w-full flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-pos-text">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
                  <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="text-sm">{tr('control.productSubproducts.loading', 'Loading...')}</span>
              </div>
            </div>
          )}
          <Dropdown
            options={[
              { value: '', label: tr('control.productSubproducts.withoutGroup', 'Without group') },
              ...subproductGroups.map((g) => ({ value: g.id, label: g.name }))
            ]}
            value={productSubproductsGroupId}
            onChange={(v) => {
              onUserEdited?.();
              setProductSubproductsGroupId(v);
            }}
            className="w-full max-w-[200px]"
          />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch min-h-[280px]">
            {/* Left: Available in group */}
            <div className="flex flex-col rounded-lg border border-pos-border bg-pos-panel/30 overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-pos-border bg-pos-panel/50 font-medium text-pos-text shrink-0">
                {tr('control.productSubproducts.available', 'Available in group')}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 border-b border-pos-border text-pos-text shrink-0 cursor-pointer active:bg-green-500">
                <input
                  type="checkbox"
                  checked={productSubproductsAvailable.length > 0 && productSubproductsAvailable.every((sp) => productSubproductsLeftSelectedIds.has(sp.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setProductSubproductsLeftSelectedIds(new Set(productSubproductsAvailable.map((sp) => sp.id)));
                    } else {
                      setProductSubproductsLeftSelectedIds(new Set());
                    }
                  }}
                  className="rounded"
                />
                <span>{tr('control.productSubproducts.selectAll', 'Select all')}</span>
              </label>
              <div
                ref={productSubproductsLeftListRef}
                className="flex-1 overflow-y-auto p-2 min-h-[350px] max-h-[350px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {!productSubproductsGroupId ? (
                  <div className="text-pos-muted px-2 py-4">{tr('control.productSubproducts.selectGroupFirst', 'Select a group above')}</div>
                ) : productSubproductsAvailable.length === 0 ? (
                  <div className="text-pos-muted px-2 py-4">{tr('control.productSubproducts.allLinked', 'All subproducts in this group are linked')}</div>
                ) : (
                  <ul className="space-y-1">
                    {productSubproductsAvailable.map((sp) => (
                      <li key={sp.id}>
                        <label className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer active:bg-green-500 text-pos-text">
                          <input
                            type="checkbox"
                            checked={productSubproductsLeftSelectedIds.has(sp.id)}
                            onChange={(e) => {
                              setProductSubproductsLeftSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(sp.id);
                                else next.delete(sp.id);
                                return next;
                              });
                            }}
                            className="rounded"
                          />
                          <span className="truncate">{sp.name}</span>
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
                  onClick={handleAddProductSubproductLinks}
                  disabled={!productSubproductsLeftSelectedIds.size}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {tr('control.productSubproducts.add', 'Add')}
                </button>
              </div>
            </div>

            {/* Center: transfer hint (optional visual spacer on desktop) */}
            <div className="hidden md:flex items-center justify-center text-pos-muted shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </div>

            {/* Right: Linked to product */}
            <div className="flex flex-col rounded-lg border border-pos-border bg-pos-panel/30 overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-pos-border bg-pos-panel/50 font-medium text-pos-text shrink-0">
                {tr('control.productSubproducts.linked', 'Linked to product')}
              </div>
              <label className={`flex items-center gap-2 px-3 py-2 border-b border-pos-border text-pos-text shrink-0 cursor-pointer active:bg-green-500 ${!productSubproductsLinked.length ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={productSubproductsLinked.length > 0 && productSubproductsLinked.every((l) => productSubproductsRightSelectedIds.has(l.subproductId))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setProductSubproductsRightSelectedIds(new Set(productSubproductsLinked.map((l) => l.subproductId)));
                    } else {
                      setProductSubproductsRightSelectedIds(new Set());
                    }
                  }}
                  className="rounded"
                />
                <span>{tr('control.productSubproducts.selectAll', 'Select all')}</span>
              </label>
              <div
                ref={productSubproductsListRef}
                className="flex-1 overflow-y-auto p-2 min-h-[350px] max-h-[350px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {loadingProductSubproductsLinked ? (
                  <div className="text-pos-muted px-2 py-4">{tr('control.productSubproducts.loading', 'Loading...')}</div>
                ) : productSubproductsLinked.length === 0 ? (
                  <div className="text-pos-muted px-2 py-4">{tr('control.productSubproducts.noLinkedYet', 'No subproducts linked yet.')}</div>
                ) : (
                  <ul className="space-y-1">
                    {productSubproductsLinked.map((link) => (
                      <li key={link.subproductId}>
                        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded cursor-pointer active:bg-green-500 text-pos-text group">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={productSubproductsRightSelectedIds.has(link.subproductId)}
                              onChange={(e) => {
                                setProductSubproductsRightSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(link.subproductId);
                                  else next.delete(link.subproductId);
                                  return next;
                                });
                              }}
                              className="rounded shrink-0"
                              onClick={(ev) => ev.stopPropagation()}
                            />
                            <span className="truncate">{link.subproductName}</span>
                          </div>
                          <button
                            type="button"
                            className="p-1 rounded active:bg-green-500 text-pos-muted active:text-red-400 shrink-0 opacity-0 group-active:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              removeProductSubproductLink(link.subproductId);
                            }}
                            aria-label={tr('delete', 'Delete')}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                  onClick={handleRemoveProductSubproductLinks}
                  disabled={!productSubproductsRightSelectedIds.size}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
            onClick={handleSaveProductSubproducts}
            disabled={savingProductSubproducts || !productSubproductsProduct}
          >
            {savingProductSubproducts ? tr('control.saving', 'Saving...') : tr('control.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
