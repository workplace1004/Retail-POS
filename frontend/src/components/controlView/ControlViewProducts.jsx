import React from 'react';
import { PaginationArrows } from '../PaginationArrows';

export function ControlViewProducts({
  tr,
  selectedCategoryId,
  selectedProductId,
  productsLoading,
  openProductModal,
  openProductPositioningModal,
  productSearch,
  setProductSearch,
  setShowProductSearchKeyboard,
  categories,
  setSelectedCategoryId,
  setSelectedProductId,
  productsCategoryTabsRef,
  productsListRef,
  updateProductsScrollState,
  filteredProducts,
  productHasSubproductsById,
  openProductSubproductsModal,
  openEditProductModal,
  setDeleteConfirmProductId,
  canProductsScrollUp,
  canProductsScrollDown,
  scrollProductsByPage
}) {
  return (
    <div className="relative min-h-[650px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px] flex flex-col">
      {/* Action bar: New Product, Positioning, Search */}
      <div className="flex items-center w-full justify-center gap-4 mb-2 flex-wrap">
        <button
          type="button"
          disabled={!selectedCategoryId}
          onClick={openProductModal}
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors disabled:opacity-50"
        >
          {tr('control.products.new', 'New Product')}
        </button>
        <button
          type="button"
          onClick={openProductPositioningModal}
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors disabled:opacity-50"
        >
          {tr('control.products.positioning', 'Positioning')}
        </button>
        <input
          type="text"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder={tr('control.products.searchPlaceholder', 'Search products')}
          onClick={() => setShowProductSearchKeyboard(true)}
          onFocus={() => setShowProductSearchKeyboard(true)}
          className="px-4 py-3 rounded-lg bg-pos-bg border border-pos-border z-[20] text-pos-text text-sm min-w-[200px] placeholder:text-pos-muted cursor-pointer"
        />
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-2 overflow-hidden">
          <button
            type="button"
            className="p-2 rounded text-pos-text active:bg-green-500 shrink-0"
            onClick={() => {
              const currentIndex = categories.findIndex((cat) => cat.id === selectedCategoryId);
              if (currentIndex <= 0) return;
              setSelectedCategoryId(categories[currentIndex - 1].id);
              setSelectedProductId(null);
            }}
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div
            ref={productsCategoryTabsRef}
            className="flex gap-2 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                data-category-id={String(cat.id)}
                type="button"
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 ${selectedCategoryId === cat.id
                  ? 'bg-pos-bg/80 text-pos-text border-green-500'
                  : 'text-pos-muted active:text-pos-text bg-transparent border-transparent active:bg-green-500'
                  }`}
                onClick={() => { setSelectedCategoryId(cat.id); setSelectedProductId(null); }}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="p-2 rounded text-pos-text active:bg-green-500 shrink-0"
            onClick={() => {
              const currentIndex = categories.findIndex((cat) => cat.id === selectedCategoryId);
              if (currentIndex < 0 || currentIndex >= categories.length - 1) return;
              setSelectedCategoryId(categories[currentIndex + 1].id);
              setSelectedProductId(null);
            }}
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      <div
        ref={productsListRef}
        className="flex-1 overflow-auto max-h-[470px] min-h-0 bg-pos-bg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={updateProductsScrollState}
      >
        {!selectedCategoryId ? (
          <p className="text-pos-muted text-xl py-4 text-center">{tr('control.products.selectCategoryHint', 'Select a category or add one in Categories.')}</p>
        ) : productsLoading && filteredProducts.length === 0 ? null : filteredProducts.length === 0 ? (
          <p className="text-pos-muted text-xl py-4 text-center">{tr('control.products.emptyInCategory', 'No products in this category yet.')}</p>
        ) : (
          <ul className="w-full flex flex-col">
            {filteredProducts.map((product) => {
              const hasSubproducts = !!productHasSubproductsById[product.id];
              return (
                <li
                  key={product.id}
                  className={`flex items-center w-full justify-between px-4 py-2 border-y border-pos-panel text-pos-text text-sm cursor-pointer ${selectedProductId === product.id ? 'bg-pos-panel/70' : 'bg-pos-bg'}`}
                  onClick={(e) => { if (!e.target.closest('button')) setSelectedProductId(product.id); }}
                >
                  <span className="min-w-[30%] text-left font-medium truncate" title={product.name}>
                    {product.name}
                  </span>
                  <span className={`flex-shrink-0 min-w-[30%] text-center text-sm ${hasSubproducts ? 'text-white' : 'text-pos-muted'}`}>
                    <button
                      type="button"
                      className={`px-2 py-1 rounded text-sm active:text-pos-text active:bg-green-500 ${hasSubproducts ? 'text-white font-medium' : 'text-pos-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductSubproductsModal(product);
                      }}
                    >
                      {tr('control.products.subproductsColumn', 'Subproducts')}
                    </button>
                  </span>
                  <div className="flex items-center justify-end min-w-[40%] gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="p-2 rounded text-pos-text mr-5 active:text-green-500"
                      onClick={() => openEditProductModal(product)}
                      aria-label="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded text-pos-text active:text-rose-500"
                      onClick={() => setDeleteConfirmProductId(product.id)}
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedCategoryId && filteredProducts.length > 0 && (
        <PaginationArrows
          canPrev={canProductsScrollUp}
          canNext={canProductsScrollDown}
          onPrev={() => scrollProductsByPage('up')}
          onNext={() => scrollProductsByPage('down')}
        />
      )}
    </div>
  );
}
