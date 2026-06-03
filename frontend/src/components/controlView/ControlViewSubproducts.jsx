import React from 'react';
import { PaginationArrows } from '../PaginationArrows';

export function ControlViewSubproducts({
  tr,
  subproductsLoading,
  openSubproductModal,
  setShowManageGroupsModal,
  subproductGroups,
  selectedSubproductGroupId,
  setSelectedSubproductGroupId,
  setSelectedSubproductId,
  subproductsGroupTabsRef,
  subproductsListRef,
  updateSubproductsScrollState,
  subproductGroupsLoading,
  subproducts,
  selectedSubproductId,
  openEditSubproductModal,
  setDeleteConfirmSubproductId,
  canSubproductsScrollUp,
  canSubproductsScrollDown,
  scrollSubproductsByPage
}) {
  return (
    <div className="relative min-h-[650px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px] flex flex-col">
      <div className="flex items-center w-full justify-center gap-4 mb-2 flex-wrap">
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors"
          onClick={openSubproductModal}
        >
          {tr('control.subproducts.new', 'New subproduct')}
        </button>
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors"
          onClick={() => setShowManageGroupsModal(true)}
        >
          {tr('control.subproducts.manageGroups', 'Manage Groups')}
        </button>
      </div>

      {subproductGroups.length > 0 && (
        <div className="flex items-center gap-2 mb-2 overflow-hidden">
          <button
            type="button"
            className="p-2 rounded text-pos-text active:bg-green-500 shrink-0"
            onClick={() => {
              const currentIndex = subproductGroups.findIndex((grp) => grp.id === selectedSubproductGroupId);
              if (currentIndex <= 0) return;
              setSelectedSubproductGroupId(subproductGroups[currentIndex - 1].id);
              setSelectedSubproductId(null);
            }}
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div
            ref={subproductsGroupTabsRef}
            className="flex gap-2 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {subproductGroups.map((grp) => (
              <button
                key={grp.id}
                data-group-id={String(grp.id)}
                type="button"
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 ${selectedSubproductGroupId === grp.id
                  ? 'bg-pos-bg/80 text-pos-text border-green-500'
                  : 'text-pos-muted active:text-pos-text bg-transparent border-transparent active:bg-green-500'
                  }`}
                onClick={() => setSelectedSubproductGroupId(grp.id)}
              >
                {grp.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="p-2 rounded text-pos-text active:bg-green-500 shrink-0"
            onClick={() => {
              const currentIndex = subproductGroups.findIndex((grp) => grp.id === selectedSubproductGroupId);
              if (currentIndex < 0 || currentIndex >= subproductGroups.length - 1) return;
              setSelectedSubproductGroupId(subproductGroups[currentIndex + 1].id);
              setSelectedSubproductId(null);
            }}
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      <div
        ref={subproductsListRef}
        className="flex-1 overflow-auto min-h-0 bg-pos-bg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={updateSubproductsScrollState}
      >
        {!selectedSubproductGroupId ? (
          <p className="text-pos-muted text-xl py-4 text-center">{tr('control.subproducts.selectGroupHint', 'Select a group or add one via Manage Groups.')}</p>
        ) : subproductGroupsLoading && subproductGroups.length === 0 ? null : subproductsLoading && subproducts.length === 0 ? null : subproducts.length === 0 ? (
          <p className="text-pos-muted text-xl py-4 text-center">{tr('control.subproducts.empty', 'No subproducts in this group yet.')}</p>
        ) : (
          <ul className="w-full flex flex-col">
            {subproducts.map((sp) => (
              <li
                key={sp.id}
                className={`flex items-center w-full justify-between px-4 py-2 border-y border-pos-panel text-pos-text text-sm cursor-pointer ${selectedSubproductId === sp.id ? 'bg-pos-panel/70' : 'bg-pos-bg'}`}
                onClick={(e) => { if (!e.target.closest('button')) setSelectedSubproductId(sp.id); }}
              >
                <span className="flex-1 font-medium truncate" title={sp.name}>{sp.name}</span>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="p-2 rounded text-pos-text mr-5 active:bg-green-500" onClick={() => openEditSubproductModal(sp)} aria-label="Edit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button type="button" className="p-2 rounded text-pos-text active:text-rose-500" onClick={() => setDeleteConfirmSubproductId(sp.id)} aria-label="Delete">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedSubproductGroupId && subproducts.length > 0 && (
        <PaginationArrows
          canPrev={canSubproductsScrollUp}
          canNext={canSubproductsScrollDown}
          onPrev={() => scrollSubproductsByPage('up')}
          onNext={() => scrollSubproductsByPage('down')}
        />
      )}
    </div>
  );
}
