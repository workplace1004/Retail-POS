import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { posProductDisplayPhotoPath } from '../lib/productDisplayPhoto.js';
import { resolveMediaSrc } from '../lib/publicAssetUrl.js';

export function ProductArea({
  products,
  selectedCategoryId,
  categories,
  onSelectCategory,
  onAddProduct,
  fetchSubproductsForProduct,
  positioningLayoutByCategory,
  positioningColorByCategory,
  appendSubproductNoteToItem
}) {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState(null);
  const [subproducts, setSubproducts] = useState([]);
  const [loadingSubproducts, setLoadingSubproducts] = useState(false);
  const [showSubproductModal, setShowSubproductModal] = useState(false);
  const [productPressLocked, setProductPressLocked] = useState(false);
  const [subproductPressLocked, setSubproductPressLocked] = useState(false);
  const [addedSubproductIds, setAddedSubproductIds] = useState(() => new Set());
  const subproductsRequestIdRef = useRef(0);
  const productPressLockRef = useRef(false);
  const subproductPressLockRef = useRef(false);
  const subproductsCacheRef = useRef(new Map());
  /** No TTL — avoid showing old prices after Control edits; list is refetched on each product tap. */
  const SUBPRODUCTS_CACHE_TTL_MS = 0;
  const getSubproductExtra = useCallback(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_subproduct_extra') : null;
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);
  const hydrateSubproducts = useCallback((list) => {
    const extraMap = getSubproductExtra();
    return (Array.isArray(list) ? list : []).map((sp) => ({
      ...sp,
      kioskPicture: extraMap?.[sp.id]?.kioskPicture || ''
    }));
  }, [getSubproductExtra]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const layoutForCategory = Array.isArray(positioningLayoutByCategory?.[selectedCategoryId])
    ? positioningLayoutByCategory[selectedCategoryId]
    : null;
  const colorForCategory = positioningColorByCategory?.[selectedCategoryId] || {};
  const PAGE_SIZE = 48; // 6 x 8, same as positioning modal
  const totalPages = Math.max(1, Math.ceil((layoutForCategory?.length || PAGE_SIZE) / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageCells = Array.from({ length: PAGE_SIZE }, (_, i) => layoutForCategory?.[pageStart + i] || null);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  useEffect(() => {
    // Category switch should always clear selected product and subproducts panel.
    subproductsRequestIdRef.current += 1;
    setSelectedProduct(null);
    setSelectedOrderItemId(null);
    setSubproducts([]);
    setShowSubproductModal(false);
    setAddedSubproductIds(new Set());
    setLoadingSubproducts(false);
    productPressLockRef.current = false;
    setProductPressLocked(false);
    subproductPressLockRef.current = false;
    setSubproductPressLocked(false);
    setPage(0);
  }, [selectedCategoryId]);

  useEffect(() => {
    setPage(0);
  }, [selectedCategoryId, layoutForCategory?.length]);

  const handleProductPress = useCallback(
    async (product) => {
      if (productPressLockRef.current) return;
      productPressLockRef.current = true;
      setProductPressLocked(true);

      if (!fetchSubproductsForProduct) {
        try {
          await onAddProduct(product);
        } finally {
          productPressLockRef.current = false;
          setProductPressLocked(false);
        }
        return;
      }
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const runWithRetry = async (runner, retries = 1) => {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            return await runner();
          } catch (error) {
            lastError = error;
            if (attempt < retries) await wait(120);
          }
        }
        throw lastError;
      };

      setSelectedProduct(product);
      setSelectedOrderItemId(null);
      const now = Date.now();
      const cached = subproductsCacheRef.current.get(product.id);
      const hasFreshCache = !!(cached && Array.isArray(cached.list) && (now - cached.at) < SUBPRODUCTS_CACHE_TTL_MS);
      const cachedList = hasFreshCache ? cached.list : [];
      setSubproducts(hydrateSubproducts(cachedList));
      setAddedSubproductIds(new Set());
      // Open immediately only when we already know this product has subproducts.
      // Prevents wrong "open then close" flicker for products without subproducts.
      setShowSubproductModal(cachedList.length > 0);
      setLoadingSubproducts(true);
      const requestId = subproductsRequestIdRef.current + 1;
      subproductsRequestIdRef.current = requestId;
      try {
        // Run both requests together so the subproduct modal can appear faster.
        const [createdItemId, data] = await Promise.all([
          runWithRetry(() => onAddProduct(product), 1),
          runWithRetry(() => fetchSubproductsForProduct(product.id), 1)
        ]);
        if (requestId !== subproductsRequestIdRef.current) return;
        if (createdItemId === false) {
          setSelectedProduct(null);
          setSelectedOrderItemId(null);
          setSubproducts([]);
          setShowSubproductModal(false);
          setAddedSubproductIds(new Set());
          return;
        }
        setSelectedOrderItemId(createdItemId || null);
        const list = Array.isArray(data) ? data : [];
        subproductsCacheRef.current.set(product.id, { at: Date.now(), list });
        setSubproducts(hydrateSubproducts(list));
        if (list.length > 0) {
          setShowSubproductModal(true);
        } else {
          setShowSubproductModal(false);
          setSelectedProduct(null);
          setSelectedOrderItemId(null);
        }
      } catch {
        if (requestId !== subproductsRequestIdRef.current) return;
        setSelectedProduct(null);
        setSelectedOrderItemId(null);
        setSubproducts([]);
        setShowSubproductModal(false);
      } finally {
        if (requestId === subproductsRequestIdRef.current) setLoadingSubproducts(false);
        productPressLockRef.current = false;
        setProductPressLocked(false);
      }
    },
    [fetchSubproductsForProduct, hydrateSubproducts, onAddProduct]
  );

  const handleSubproductPress = useCallback(
    async (subproduct) => {
      if (!selectedProduct || !selectedOrderItemId) return;
      if (subproductPressLockRef.current) return;
      const note = subproduct?.name || '';
      if (!note) return;

      subproductPressLockRef.current = true;
      setSubproductPressLocked(true);

      const wasSelected = addedSubproductIds.has(subproduct.id);

      try {
        // Optimistic UI: reflect toggle immediately, then sync with backend result.
        setAddedSubproductIds((prev) => {
          const next = new Set(prev);
          if (next.has(subproduct.id)) next.delete(subproduct.id);
          else next.add(subproduct.id);
          return next;
        });
        let wasAdded = !wasSelected;
        try {
          wasAdded = await appendSubproductNoteToItem?.(
            selectedOrderItemId,
            note,
            Number(subproduct?.price) || 0
          );
        } catch {
          // Revert on request failure.
          setAddedSubproductIds((prev) => {
            const next = new Set(prev);
            if (wasSelected) next.add(subproduct.id);
            else next.delete(subproduct.id);
            return next;
          });
          return;
        }
        setAddedSubproductIds((prev) => {
          const next = new Set(prev);
          if (wasAdded) next.add(subproduct.id);
          else next.delete(subproduct.id);
          return next;
        });
      } finally {
        subproductPressLockRef.current = false;
        setSubproductPressLocked(false);
      }
    },
    [addedSubproductIds, appendSubproductNoteToItem, selectedOrderItemId, selectedProduct]
  );

  const closeSubproductModal = useCallback(() => {
    setShowSubproductModal(false);
    setSelectedProduct(null);
    setSelectedOrderItemId(null);
    setAddedSubproductIds(new Set());
  }, []);

  const subproductsByGroup = useMemo(() => {
    if (!subproducts.length) return [];
    const byGroup = new Map();
    for (const sp of subproducts) {
      const gid = sp?.groupId || sp?.group?.id || '';
      const gname = sp?.group?.name || '';
      if (!byGroup.has(gid)) byGroup.set(gid, { groupName: gname, sortOrder: sp?.group?.sortOrder ?? 0, items: [] });
      byGroup.get(gid).items.push(sp);
    }
    return Array.from(byGroup.entries())
      .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0) || (a[1].groupName || '').localeCompare(b[1].groupName || ''))
      .map(([gid, data]) => ({ groupId: gid, groupName: data.groupName, items: data.items }));
  }, [subproducts]);

  const colorStyleById = {
    green: { backgroundColor: '#1F8E41', color: '#ffffff' },
    orange: { backgroundColor: '#B45309', color: '#ffffff' },
    blue: { backgroundColor: '#1D4ED8', color: '#ffffff' },
    pink: { backgroundColor: '#B91C1C', color: '#ffffff' },
    gray: { backgroundColor: '#6D28D9', color: '#ffffff' },
    yellow: { backgroundColor: '#CA8A04', color: '#ffffff' },
  };

  const productGridLocked = productPressLocked || loadingSubproducts || subproductPressLocked;

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 bg-pos-bg py-2">
        <div className="p-1 overflow-auto flex-1">
          {!layoutForCategory ? (
            <div className="col-span-full flex items-center justify-center text-pos-surface text-lg min-h-[100px] max-h-[100px]">
              {t('selectCategoryToSeeProducts')}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1 content-start text-lg">
              {pageCells.map((entry, idx) => {
                const product = typeof entry === 'string' && entry.startsWith('p:')
                  ? productById.get(entry.slice(2))
                  : null;
                const absoluteIdx = pageStart + idx;
                const colorId = colorForCategory[String(absoluteIdx)];
                const tileStyle = colorStyleById[colorId] || colorStyleById.green;
                if (!product) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[76px] max-h-[76px] rounded-lg bg-transparent"
                    />
                  );
                }
                const posPhotoPath = posProductDisplayPhotoPath(product);
                return (
                  <button
                    type="button"
                    key={`${product.id}-${idx}`}
                    aria-disabled={productGridLocked}
                    tabIndex={productGridLocked ? -1 : undefined}
                    style={tileStyle}
                    className={`flex relative flex-row items-center gap-1 justify-center px-1 border-none rounded-lg text-sm min-h-[76px] max-h-[76px] ${productGridLocked ? 'pointer-events-none cursor-wait' : ''} ${
                      selectedProduct?.id === product.id ? 'ring-2 ring-pos-text' : ''
                    }`}
                    onClick={() => handleProductPress(product)}
                  >
                    {posPhotoPath ? (
                      <img
                        src={resolveMediaSrc(posPhotoPath)}
                        alt={product.name}
                        className="max-w-[45px] absolute top-0 left-0 mt-1 ml-1 min-w-[45px] max-h-[45px] min-h-[45px] object-cover rounded"
                      />
                    ) : null}
                    <span className="text-sm absolute bottom-0 left-0 pb-1 pl-1 block max-w-[100px] break-words leading-tight">{product.name}</span>
                    <span className="font-semibold absolute top-0 right-0 pr-1 pt-1 text-sm">€{Number(product.price).toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showSubproductModal && selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-start bg-black/50"
          onClick={() => {
            if (!subproductPressLocked) closeSubproductModal();
          }}
        >
          <div
            className="bg-pos-bg relative rounded-r-xl border-r border-y border-pos-border shadow-2xl p-6 w-[max(360px,min(90vw,770px))] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-pos-text">
                {selectedProduct.name} — {t('subproducts', 'Subproducts')}
              </h3>
              <button
                type="button"
                aria-disabled={subproductPressLocked}
                tabIndex={subproductPressLocked ? -1 : undefined}
                className={`p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500 ${subproductPressLocked ? 'pointer-events-none cursor-wait' : ''}`}
                onClick={closeSubproductModal}
                aria-label={t('close', 'Close')}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-6 pb-24">
              {loadingSubproducts && subproducts.length === 0 ? (
                <div className="py-8 text-center text-pos-muted">{t('loading', 'Loading...')}</div>
              ) : null}
              {subproductsByGroup.map(({ groupId, groupName, items }) => (
                <div key={groupId} className="flex">
                  <h4 className="text-md font-medium text-pos-text mb-2 min-w-[80px] shrink-0">
                    {groupName || t('other', 'Other')}
                  </h4>
                  <div className="grid grid-cols-5 gap-2 w-full">
                    {items.map((sp) => (
                      <button
                        type="button"
                        key={sp.id}
                        aria-disabled={subproductPressLocked}
                        tabIndex={subproductPressLocked ? -1 : undefined}
                        className={`flex items-center justify-center p-1 min-h-[50px] max-h-[50px] rounded-lg transition-colors active:bg-green-500 ${
                          subproductPressLocked ? 'pointer-events-none cursor-wait' : ''
                        } ${
                          addedSubproductIds.has(sp.id)
                            ? 'bg-green-600 text-white'
                            : 'bg-pos-panel text-pos-text'
                        }`}
                        onClick={() => handleSubproductPress(sp)}
                      >
                        {sp.kioskPicture ? (
                          <img src={resolveMediaSrc(sp.kioskPicture)} alt={sp.name} className="w-10 h-10 object-cover rounded" />
                        ) : null}
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-sm font-medium truncate w-full text-center">{sp.name}</span>
                          <span className={`text-xs ${addedSubproductIds.has(sp.id) ? 'text-white/90' : 'text-pos-muted'}`}>
                            €{Number(sp.price ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="w-full px-5 pb-4 flex justify-end gap-2 absolute bottom-0 left-0 right-0 bg-pos-bg border-t border-pos-border pt-3">
              <button
                type="button"
                aria-disabled={subproductPressLocked}
                tabIndex={subproductPressLocked ? -1 : undefined}
                className={`px-4 py-2 min-w-[100px] rounded-lg border border-pos-border bg-pos-panel text-pos-text active:bg-green-500 ${subproductPressLocked ? 'pointer-events-none cursor-wait' : ''}`}
                onClick={closeSubproductModal}
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                aria-disabled={subproductPressLocked}
                tabIndex={subproductPressLocked ? -1 : undefined}
                className={`px-4 py-2 min-w-[100px] rounded-lg bg-green-600 text-white active:bg-green-500 ${subproductPressLocked ? 'pointer-events-none cursor-wait' : ''}`}
                onClick={closeSubproductModal}
              >
                {t('ok', 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
