import React from 'react';

export function ControlViewProductPositioningModal({
  tr,
  showProductPositioningModal,
  closeProductPositioningModal,
  positioningCategoryId,
  setPositioningCategoryId,
  selectedCategoryId,
  categories,
  products,
  positioningSubproducts,
  positioningLayoutByCategory,
  setPositioningLayoutByCategory,
  positioningColorByCategory,
  setPositioningColorByCategory,
  positioningSelectedProductId,
  setPositioningSelectedProductId,
  positioningSelectedCellIndex,
  setPositioningSelectedCellIndex,
  positioningSelectedPoolItemId,
  setPositioningSelectedPoolItemId,
  positioningCategoryTabsRef,
  saveProductPositioningLayout,
  savingPositioningLayout
}) {
  if (!showProductPositioningModal) return null;

  const GRID_COLUMNS = 6;
  const GRID_ROWS = 8;
  const PAGE_SIZE = GRID_COLUMNS * GRID_ROWS;
  const positionCategoryId = positioningCategoryId || selectedCategoryId || categories[0]?.id || null;
  const positioningProducts = products
    .filter((p) => p.categoryId === positionCategoryId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((p) => ({ ...p, type: 'product', _positioningId: `p:${p.id}` }));
  const allItems = [...positioningProducts, ...positioningSubproducts];
  const itemMap = new Map(allItems.map((it) => [it._positioningId, it]));
  const hasStoredLayout = Array.isArray(positioningLayoutByCategory[positionCategoryId]);
  let cells = [];
  if (hasStoredLayout) {
    const existingLayout = positioningLayoutByCategory[positionCategoryId].slice(0, PAGE_SIZE);
    while (existingLayout.length < PAGE_SIZE) existingLayout.push(null);
    cells = existingLayout.map((id) => (id && itemMap.has(id) ? id : null));
  } else {
    // No auto-placement: keep grid empty until user drags items from sidebar.
    cells = Array.from({ length: PAGE_SIZE }, () => null);
  }
  const pages = 1;
  const categoryColors = positioningColorByCategory[positionCategoryId] || {};
  const categoryIndex = categories.findIndex((c) => c.id === positionCategoryId);
  const canPrevCategory = categoryIndex > 0;
  const canNextCategory = categoryIndex >= 0 && categoryIndex < categories.length - 1;
  /** Swatch order matches product palette: green, orange, blue, red, purple, gold. */
  const COLOR_OPTIONS = [
    { id: 'green', className: 'bg-[#1F8E41] text-white' },
    { id: 'orange', className: 'bg-[#B45309] text-white' },
    { id: 'blue', className: 'bg-[#1D4ED8] text-white' },
    { id: 'pink', className: 'bg-[#B91C1C] text-white' },
    { id: 'gray', className: 'bg-[#6D28D9] text-white' },
    { id: 'yellow', className: 'bg-[#CA8A04] text-white' },
  ];
  const tileClassByColorId = (colorId, fallbackType) => {
    const found = COLOR_OPTIONS.find((c) => c.id === colorId);
    if (found) return found.className;
    return fallbackType === 'subproduct' ? 'bg-amber-500 text-white' : 'bg-[#1F8E41] text-white';
  };
  const updateLayout = (nextCells) => {
    if (!positionCategoryId) return;
    const normalized = Array.from({ length: PAGE_SIZE }, (_, i) => nextCells[i] || null);
    setPositioningLayoutByCategory((prev) => ({ ...prev, [positionCategoryId]: normalized }));
  };
  const removeFromPlace = () => {
    let idx = Number.isInteger(positioningSelectedCellIndex) ? positioningSelectedCellIndex : -1;
    if (idx < 0 || idx >= PAGE_SIZE) {
      if (positioningSelectedProductId) {
        idx = cells.findIndex((id) => {
          const item = id ? itemMap.get(id) : null;
          return item?.id === positioningSelectedProductId;
        });
      }
    }
    if (idx < 0 || idx >= PAGE_SIZE) return;
    const next = [...cells];
    next[idx] = null;
    updateLayout(next);
    if (positionCategoryId) {
      setPositioningColorByCategory((prev) => {
        const byCategory = { ...(prev[positionCategoryId] || {}) };
        delete byCategory[String(idx)];
        return { ...prev, [positionCategoryId]: byCategory };
      });
    }
    setPositioningSelectedProductId(null);
    setPositioningSelectedCellIndex(null);
    setPositioningSelectedPoolItemId(null);
  };
  const applyColorToSelectedCell = (colorId) => {
    if (!positionCategoryId) return;
    if (!Number.isInteger(positioningSelectedCellIndex) || positioningSelectedCellIndex < 0 || positioningSelectedCellIndex >= PAGE_SIZE) return;
    setPositioningColorByCategory((prev) => {
      const byCategory = { ...(prev[positionCategoryId] || {}) };
      byCategory[String(positioningSelectedCellIndex)] = colorId;
      return { ...prev, [positionCategoryId]: byCategory };
    });
    // After applying a color, require explicit re-selection for another change.
    setPositioningSelectedProductId(null);
    setPositioningSelectedCellIndex(null);
  };
  const handleDragStartFromPool = (event, itemId) => {
    event.dataTransfer.setData('text/plain', JSON.stringify({ itemId, source: 'pool' }));
    event.dataTransfer.effectAllowed = 'move';
  };
  const handleDragStartFromCell = (event, index, itemId) => {
    event.dataTransfer.setData('text/plain', JSON.stringify({ itemId, source: 'cell', index }));
    event.dataTransfer.effectAllowed = 'move';
  };
  const handleDropOnCell = (event, targetIndex) => {
    event.preventDefault();
    let payload = null;
    try {
      payload = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
    } catch {
      return;
    }
    const itemId = payload?.itemId;
    if (!itemId || !itemMap.has(itemId)) return;
    const next = [...cells];
    const sourceIndex = next.findIndex((id) => id === itemId);
    const movingFromCell = sourceIndex >= 0;
    const targetItemBeforeMove = next[targetIndex];
    if (sourceIndex >= 0) next[sourceIndex] = null;
    if (payload?.source === 'cell' && Number.isInteger(payload?.index) && payload.index >= 0 && payload.index < PAGE_SIZE && payload.index !== targetIndex) {
      const targetItem = next[targetIndex];
      if (targetItem) next[payload.index] = targetItem;
    }
    next[targetIndex] = itemId;
    updateLayout(next);
    if (positionCategoryId) {
      setPositioningColorByCategory((prev) => {
        const byCategory = { ...(prev[positionCategoryId] || {}) };
        const sourceKey = String(sourceIndex);
        const targetKey = String(targetIndex);
        const sourceColor = movingFromCell ? byCategory[sourceKey] : undefined;
        const targetColor = byCategory[targetKey];

        if (movingFromCell && sourceIndex !== targetIndex) {
          if (sourceColor) byCategory[targetKey] = sourceColor; else delete byCategory[targetKey];
          if (targetItemBeforeMove && targetColor) byCategory[sourceKey] = targetColor; else delete byCategory[sourceKey];
        } else if (!movingFromCell) {
          // Item comes from pool: default tile to first swatch (green), same as POS grid.
          byCategory[targetKey] = 'green';
        }
        return { ...prev, [positionCategoryId]: byCategory };
      });
    }
  };
  const handleDropOnPool = (event) => {
    event.preventDefault();
    let payload = null;
    try {
      payload = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
    } catch {
      return;
    }
    const itemId = payload?.itemId;
    if (!itemId || !itemMap.has(itemId)) return;
    const next = cells.map((id) => (id === itemId ? null : id));
    updateLayout(next);
  };
  const handleCellClick = (idx) => {
    const itemIdAtCell = cells[idx];
    const itemAtCell = itemIdAtCell ? itemMap.get(itemIdAtCell) : null;
    const hasPoolSelection = positioningSelectedPoolItemId && itemMap.has(positioningSelectedPoolItemId);
    const hasGridSelection = Number.isInteger(positioningSelectedCellIndex) && positioningSelectedCellIndex >= 0 && positioningSelectedCellIndex < PAGE_SIZE;
    const selectedItemId = hasGridSelection ? cells[positioningSelectedCellIndex] : null;

    if (hasPoolSelection && !itemIdAtCell) {
      const next = [...cells];
      next[idx] = positioningSelectedPoolItemId;
      updateLayout(next);
      if (positionCategoryId) {
        setPositioningColorByCategory((prev) => ({
          ...prev,
          [positionCategoryId]: { ...(prev[positionCategoryId] || {}), [String(idx)]: 'green' },
        }));
      }
      setPositioningSelectedPoolItemId(null);
      return;
    }
    if (hasGridSelection && selectedItemId && itemMap.has(selectedItemId) && idx !== positioningSelectedCellIndex) {
      const sourceIndex = positioningSelectedCellIndex;
      const targetIndex = idx;
      const next = [...cells];
      const targetItemBeforeMove = next[targetIndex];
      next[sourceIndex] = targetItemBeforeMove;
      next[targetIndex] = selectedItemId;
      updateLayout(next);
      if (positionCategoryId) {
        setPositioningColorByCategory((prev) => {
          const byCategory = { ...(prev[positionCategoryId] || {}) };
          const sourceKey = String(sourceIndex);
          const targetKey = String(targetIndex);
          const sourceColor = byCategory[sourceKey];
          const targetColor = byCategory[targetKey];
          if (sourceColor) byCategory[targetKey] = sourceColor; else delete byCategory[targetKey];
          if (targetColor) byCategory[sourceKey] = targetColor; else delete byCategory[sourceKey];
          return { ...prev, [positionCategoryId]: byCategory };
        });
      }
      setPositioningSelectedProductId(null);
      setPositioningSelectedCellIndex(null);
      return;
    }
    if (itemAtCell) {
      if (positioningSelectedCellIndex === idx && positioningSelectedProductId === itemAtCell.id) {
        setPositioningSelectedProductId(null);
        setPositioningSelectedCellIndex(null);
        setPositioningSelectedPoolItemId(null);
        return;
      }
      setPositioningSelectedProductId(itemAtCell.id);
      setPositioningSelectedCellIndex(idx);
      setPositioningSelectedPoolItemId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute top-4 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500"
          onClick={closeProductPositioningModal}
          aria-label="Close positioning modal"
        >
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="flex-1 min-h-0 w-full p-6 flex flex-col pt-20">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <button
              type="button"
              className="p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500 disabled:opacity-40 shrink-0"
              disabled={!canPrevCategory}
              onClick={() => {
                if (!canPrevCategory) return;
                setPositioningCategoryId(categories[categoryIndex - 1].id);
                setPositioningSelectedProductId(null);
                setPositioningSelectedCellIndex(null);
              }}
              aria-label="Previous category"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div ref={positioningCategoryTabsRef} className="flex-1 overflow-x-auto min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max border-b border-gray-300">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    data-category-id={String(c.id)}
                    type="button"
                    onClick={() => { setPositioningCategoryId(c.id); setPositioningSelectedProductId(null); setPositioningSelectedCellIndex(null); setPositioningSelectedPoolItemId(null); }}
                    className={`px-4 py-2 text-sm font-medium border-r border-gray-300 ${c.id === positionCategoryId ? 'bg-green-600 text-white' : 'bg-pos-panel text-gray-200 active:bg-green-500'
                      }`}
                  >
                    {(c.name || '').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500 disabled:opacity-40 shrink-0"
              disabled={!canNextCategory}
              onClick={() => {
                if (!canNextCategory) return;
                setPositioningCategoryId(categories[categoryIndex + 1].id);
                setPositioningSelectedProductId(null);
                setPositioningSelectedCellIndex(null);
              }}
              aria-label="Next category"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="flex justify-center gap-4 mb-4 shrink-0">
            {Array.from({ length: pages }, (_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-gray-300' : 'bg-gray-600'}`} />
            ))}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr] gap-4">
            <div
              className="border border-gray-300 bg-pos-panel/50 p-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-lg"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropOnPool}
            >
              <div className="grid grid-cols-1 gap-2">
                {allItems
                  .filter((it) => !cells.includes(it._positioningId))
                  .map((item) => (
                    <button
                      key={item._positioningId}
                      type="button"
                      draggable
                      onDragStart={(e) => handleDragStartFromPool(e, item._positioningId)}
                      onClick={() => {
                        setPositioningSelectedPoolItemId(item._positioningId);
                        setPositioningSelectedProductId(null);
                        setPositioningSelectedCellIndex(null);
                      }}
                      className={`text-left px-3 py-2 rounded border text-md ${item.type === 'product' ? 'bg-green-500/90 text-white border-green-600' : 'bg-amber-500/90 text-white border-amber-600'
                        } ${positioningSelectedPoolItemId === item._positioningId ? 'ring-2 ring-white' : ''}`}
                    >
                      <div className="truncate">{item.name}</div>
                      <div className="text-xs opacity-90">€{Number(item._positioningPrice ?? item.price ?? 0).toFixed(2)} · {item.type}</div>
                    </button>
                  ))}
              </div>
            </div>
            <div className="grid gap-0 flex h-full justify-center items-center bg-pos-panel/30 rounded-lg overflow-hidden" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))` }}>
              {cells.map((itemId, idx) => {
                const item = itemId ? itemMap.get(itemId) : null;
                const selected = item && positioningSelectedProductId === item.id && positioningSelectedCellIndex === idx;
                const selectedColorId = categoryColors[String(idx)];
                const tileClass = item
                  ? tileClassByColorId(selectedColorId, item.type)
                  : 'bg-pos-panel/50';
                return (
                  <div
                    key={item?.id || `empty-${idx}`}
                    role="button"
                    tabIndex={0}
                    className={`h-[55px] border border-gray-300 px-2 text-center text-md cursor-pointer ${tileClass} ${selected ? 'ring-2 ring-gray-300' : ''}`}
                    style={selected ? { boxShadow: 'inset 0 0 0 2px #000000' } : undefined}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnCell(e, idx)}
                    onClick={() => handleCellClick(idx)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCellClick(idx)}
                  >
                    {item ? (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStartFromCell(e, idx, item._positioningId)}
                        className="w-full h-full"
                      >
                        <div className="truncate text-md">{item.name}</div>
                        <div className="text-md">€{Number(item._positioningPrice ?? item.price ?? 0).toFixed(2)}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 shrink-0 pt-5 pb-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-6 py-2 rounded-lg border border-gray-300 text-md font-medium text-gray-200 bg-pos-panel active:bg-green-500 disabled:opacity-50 disabled:pointer-events-none"
                disabled={!Number.isInteger(positioningSelectedCellIndex)}
                onClick={removeFromPlace}
              >
                {tr('control.functionButtons.removeFromPlace', 'Remove from place')}
              </button>
            </div>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!Number.isInteger(positioningSelectedCellIndex)}
                  onClick={() => applyColorToSelectedCell(option.id)}
                  className={`w-14 h-8 rounded border border-gray-300 text-md ${option.className} ${Number.isInteger(positioningSelectedCellIndex) &&
                    categoryColors[String(positioningSelectedCellIndex)] === option.id
                    ? 'ring-2 ring-gray-300'
                    : ''
                    }`}
                  aria-label={`Set tile color ${option.id}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
              disabled={savingPositioningLayout}
              onClick={saveProductPositioningLayout}
            >
              <svg fill="#ffffff" width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {savingPositioningLayout ? tr('control.saving', 'Saving...') : tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
