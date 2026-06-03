import React from 'react';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';

export function ControlViewManageGroupsModal({
  tr,
  showManageGroupsModal,
  closeManageGroupsModal,
  subproductGroups,
  newGroupName,
  setNewGroupName,
  savingGroup,
  handleAddGroup,
  manageGroupsListRef,
  manageGroupsDragRef,
  updateManageGroupsPaginationState,
  selectedManageGroupId,
  setSelectedManageGroupId,
  editingGroupId,
  setEditingGroupId,
  editingGroupName,
  setEditingGroupName,
  handleSaveEditGroup,
  setDeleteConfirmGroupId,
  canManageGroupsPageUp,
  canManageGroupsPageDown,
  pageManageGroups
}) {
  if (!showManageGroupsModal) return null;

  const sortedGroups = [...subproductGroups].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-4 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeManageGroupsModal} aria-label="Close">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex-1 min-h-0 overflow-auto w-full">
          <div className="p-6 flex flex-col space-y-6 w-full justify-center items-center pt-14">
            <div className="w-full flex flex-col justify-center items-center gap-5 max-w-xl">
              <div className="flex gap-2 w-full items-center justify-center flex-wrap">
                <label className="block text-md pr-[20px] font-medium text-gray-200 mb-2">{tr('control.subproducts.manageGroups.newGroup', 'New group :')} </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={tr('control.subproducts.manageGroups.newGroupPlaceholder', 'New group name')}
                  className="px-4 w-[200px] bg-pos-panel h-[40px] py-3 text-md border border-gray-300 rounded-lg text-gray-200 placeholder:text-gray-500"
                />
                <button type="button" className="flex ml-20 items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 shrink-0" disabled={savingGroup} onClick={handleAddGroup}>
                  {tr('control.subproducts.manageGroups.add', 'Add')}
                </button>
              </div>
              <div
                ref={manageGroupsListRef}
                className="w-full border border-gray-300 max-h-[250px] overflow-y-auto rounded-lg overflow-hidden bg-pos-panel/30 cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onScroll={updateManageGroupsPaginationState}
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  // Do not capture the pointer for drag when clicking edit/delete (capture would steal clicks).
                  if (e.target.closest?.('button, input, textarea, a, [role="button"]')) return;
                  const el = manageGroupsListRef.current;
                  if (!el) return;
                  manageGroupsDragRef.current = {
                    active: true,
                    startY: e.clientY,
                    startScrollTop: el.scrollTop,
                    pointerId: e.pointerId,
                  };
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const drag = manageGroupsDragRef.current;
                  if (!drag.active) return;
                  const el = manageGroupsListRef.current;
                  if (!el) return;
                  const deltaY = e.clientY - drag.startY;
                  el.scrollTop = drag.startScrollTop - deltaY;
                }}
                onPointerUp={(e) => {
                  const drag = manageGroupsDragRef.current;
                  if (!drag.active) return;
                  manageGroupsDragRef.current = { active: false, startY: 0, startScrollTop: 0, pointerId: null };
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  updateManageGroupsPaginationState();
                }}
                onPointerCancel={(e) => {
                  const drag = manageGroupsDragRef.current;
                  if (!drag.active) return;
                  manageGroupsDragRef.current = { active: false, startY: 0, startScrollTop: 0, pointerId: null };
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  updateManageGroupsPaginationState();
                }}
              >
                <table className="w-full border-collapse">
                  <tbody>
                    {sortedGroups.map((grp) => (
                      <tr
                        key={grp.id}
                        className={`border-b border-gray-300 w-full items-center min-h-[40px] flex justify-between ${selectedManageGroupId === grp.id ? 'bg-pos-panel/70' : ''}`}
                        onClick={(e) => { if (!e.target.closest('button')) setSelectedManageGroupId(grp.id); }}
                      >
                        <td className="w-full py-2 px-3">
                          {editingGroupId === grp.id ? (
                            <div className="flex items-center w-full justify-between gap-2 flex-wrap">
                              <input
                                type="text"
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                className="flex min-w-[200px] max-w-[200px] px-4 h-[40px] py-3 bg-pos-panel border border-gray-300 rounded-lg text-gray-200 text-md"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <button type="button" className="flex items-center text-md gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 shrink-0" disabled={savingGroup} onClick={(e) => { e.stopPropagation(); handleSaveEditGroup(); }}>{tr('control.save', 'Save')}</button>
                                <button type="button" className="flex items-center text-md gap-2 px-4 py-2 rounded-lg bg-pos-panel border border-gray-300 text-gray-200 font-medium active:bg-green-500 shrink-0" onClick={(e) => { e.stopPropagation(); setEditingGroupId(null); setEditingGroupName(''); }}>{tr('cancel', 'Cancel')}</button>
                              </div>
                            </div>
                          ) : (
                            <span className="font-medium text-md text-gray-200">{grp.name}</span>
                          )}
                        </td>
                        {editingGroupId !== grp.id && (
                          <td className="py-2 px-3 text-right flex items-center gap-1 shrink-0">
                            <button type="button" className="p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500 inline-flex align-middle" onClick={(e) => { e.stopPropagation(); setEditingGroupId(grp.id); setEditingGroupName(grp.name || ''); }} aria-label={tr('control.edit', 'Edit')}>
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" className="p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500 inline-flex align-middle" onClick={(e) => { e.stopPropagation(); setDeleteConfirmGroupId(grp.id); }} aria-label={tr('delete', 'Delete')}>
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex w-full justify-around gap-4 items-center pt-2">
                <button
                  type="button"
                  className="p-2 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 border border-gray-300 disabled:opacity-40 disabled:pointer-events-none"
                  disabled={savingGroup || !canManageGroupsPageUp}
                  onClick={() => pageManageGroups('up')}
                  aria-label="Previous page"
                >
                  <img src={publicAssetUrl('/arrow-up.svg')} alt="" className="w-5 h-5 invert opacity-90" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 border border-gray-300 disabled:opacity-40 disabled:pointer-events-none"
                  disabled={savingGroup || !canManageGroupsPageDown}
                  onClick={() => pageManageGroups('down')}
                  aria-label="Next page"
                >
                  <img src={publicAssetUrl('/arrow-down.svg')} alt="" className="w-5 h-5 invert opacity-90" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <KeyboardWithNumpad
            value={editingGroupId ? editingGroupName : newGroupName}
            onChange={editingGroupId ? setEditingGroupName : setNewGroupName}
          />
        </div>
      </div>
    </div>
  );
}
