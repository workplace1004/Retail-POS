import React from 'react';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';

export function ControlViewProductionMessagesModal({
  tr,
  showProductionMessagesModal,
  closeProductionMessagesModal,
  productionMessageInput,
  setProductionMessageInput,
  editingProductionMessageId,
  handleAddOrUpdateProductionMessage,
  productionMessages,
  productionMessagesListRef,
  updateProductionMessagesScrollState,
  canProductionMessagesScrollUp,
  canProductionMessagesScrollDown,
  startEditProductionMessage,
  setDeleteConfirmProductionMessageId
}) {
  if (!showProductionMessagesModal) return null;

  const sorted = [...productionMessages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const scrollProductionMessages = (dir) => {
    if (productionMessagesListRef.current) {
      productionMessagesListRef.current.scrollBy({ top: dir * 120, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-5xl justify-center items-center w-full mx-4 overflow-hidden flex flex-col h-[700px]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeProductionMessagesModal} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="w-full flex items-center justify-center mt-[30px] px-6 gap-4 py-4 shrink-0 pr-14">
          <div className="flex gap-2 items-center gap-[100px]">
            <input
              type="text"
              value={productionMessageInput}
              onChange={(e) => setProductionMessageInput(e.target.value)}
              placeholder="New message"
              className="px-4 py-2 bg-pos-panel border border-pos-border rounded-lg min-w-[400px] text-pos-text text-sm"
            />
            <button
              type="button"
              className="px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 text-sm shrink-0"
              disabled={!(productionMessageInput || '').trim()}
              onClick={handleAddOrUpdateProductionMessage}
            >
              {editingProductionMessageId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col rounded-xl p-6 py-0 w-full min-h-0 overflow-hidden pb-24 relative">
          <>
            <ul
              ref={productionMessagesListRef}
              className="overflow-auto min-h-[300px] mx-10 border border-pos-border rounded-xl relative p-2"
              onScroll={updateProductionMessagesScrollState}
            >
              {sorted.map((m) => (
                <li key={m.id} className="flex items-center px-4 py-1 border-b border-pos-border last:border-b-0 gap-2">
                  <span className="flex-1 text-pos-text text-sm break-words min-w-0">{m.text || ''}</span>
                  <button type="button" className="p-2 shrink-0 rounded text-pos-text active:bg-green-500" onClick={() => startEditProductionMessage(m)} aria-label="Edit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button type="button" className="p-2 shrink-0 rounded text-pos-text active:bg-green-500" onClick={() => setDeleteConfirmProductionMessageId(m.id)} aria-label="Delete">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-center gap-10 py-3">
              <button
                type="button"
                className="p-3 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                disabled={!canProductionMessagesScrollUp}
                onClick={() => scrollProductionMessages(-1)}
                aria-label={tr('scrollUp', 'Scroll up')}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M11 17V5.414l3.293 3.293a.999.999 0 101.414-1.414l-5-5a.999.999 0 00-1.414 0l-5 5a.997.997 0 000 1.414.999.999 0 001.414 0L9 5.414V17a1 1 0 102 0z" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className="p-3 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                disabled={!canProductionMessagesScrollDown}
                onClick={() => scrollProductionMessages(1)}
                aria-label={tr('scrollDown', 'Scroll down')}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M10.707 17.707l5-5a.999.999 0 10-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-3.293-3.293a.999.999 0 10-1.414 1.414l5 5a.999.999 0 001.414 0z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </>
        </div>
        <div className="shrink-0">
          <KeyboardWithNumpad value={productionMessageInput} onChange={setProductionMessageInput} />
        </div>
      </div>
    </div>
  );
}
