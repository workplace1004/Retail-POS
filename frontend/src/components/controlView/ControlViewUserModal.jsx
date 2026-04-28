import React, { useState, useRef, useEffect } from 'react';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';

const USER_ROLE_OPTIONS = [
  { value: 'admin', labelKey: 'control.userModal.roleAdmin', fallback: 'Admin' },
  { value: 'waiter', labelKey: 'control.userModal.roleWaiter', fallback: 'Waiter' }
];

// User modal privilege avatars: blue, green, yellow, red, gray, dark gray, orange, magenta, pink
const USER_PRIVILEGE_AVATAR_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#9ca3af', '#4b5563', '#f97316', '#d946ef', '#f472b6'];

const USER_PRIVILEGE_OPTIONS = [
  { id: 'roundTables', label: 'Rounding tables:' },
  { id: 'adjustCustomers', label: 'Customize customers:' },
  { id: 'openDrawer', label: 'Open drawer:' },
  { id: 'discount', label: 'Discount:' },
  { id: 'tableReturns', label: 'Table returns:' },
  { id: 'historyReturns', label: 'History of returns:' },
  { id: 'looseReturns', label: 'Individual returns:' },
  { id: 'showInSellerList', label: 'Show in seller list:' },
  { id: 'cancelPlannedOrders', label: 'Canceling planned orders:' },
  { id: 'cashMachineReceiveManually', label: 'With cash machine recieve cash manually:' },
  { id: 'createNewCustomer', label: 'Create new customer:' },
  { id: 'revenueVisible', label: 'Turnover visible:' }
];

export const DEFAULT_USER_PRIVILEGES = Object.fromEntries(USER_PRIVILEGE_OPTIONS.map((p) => [p.id, true]));

export function ControlViewUserModal({
  tr,
  showUserModal,
  closeUserModal,
  userModalTab,
  setUserModalTab,
  userName,
  setUserName,
  userPin,
  setUserPin,
  userRole,
  setUserRole,
  userModalActiveField,
  setUserModalActiveField,
  userAvatarColorIndex,
  setUserAvatarColorIndex,
  userPrivileges,
  setUserPrivileges,
  savingUser,
  handleSaveUser
}) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleDropdownRef = useRef(null);

  useEffect(() => {
    if (!roleMenuOpen) return undefined;
    const onDoc = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [roleMenuOpen]);

  useEffect(() => {
    if (!showUserModal) setRoleMenuOpen(false);
  }, [showUserModal]);

  useEffect(() => {
    setRoleMenuOpen(false);
  }, [userModalTab]);

  if (!showUserModal) return null;

  const userModalKeyboardValue =
    userModalActiveField === 'name' ? userName : userModalActiveField === 'pincode' ? userPin : '';
  const userModalKeyboardOnChange = (v) => {
    if (userModalActiveField === 'name') setUserName(v);
    else if (userModalActiveField === 'pincode') setUserPin(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-pos-bg rounded-xl border border-pos-border shadow-2xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeUserModal} aria-label="Close">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex justify-around mt-[20px] shrink-0">
          <button type="button" className={`px-8 py-4 text-md font-medium border-b-2 transition-colors ${userModalTab === 'general' ? 'border-blue-500 text-blue-500 bg-pos-panel/50' : 'border-transparent text-pos-text active:bg-green-500'}`} onClick={() => setUserModalTab('general')}>{tr('control.userModal.general', 'General')}</button>
          <button type="button" className={`px-8 py-4 text-md font-medium border-b-2 transition-colors ${userModalTab === 'privileges' ? 'border-blue-500 text-blue-500 bg-pos-panel/50' : 'border-transparent text-pos-text active:bg-green-500'}`} onClick={() => setUserModalTab('privileges')}>{tr('control.userModal.privileges', 'Privileges')}</button>
        </div>
        <div className="flex-1 overflow-hidden px-6 py-4">
          {userModalTab === 'general' ? (
            <div className="grid grid-cols-2 mx-auto">
              <div className="flex flex-col gap-4">
                <div className="flex items-center">
                  <label className="text-pos-text text-sm font-medium shrink-0 min-w-[100px] max-w-[100px]">{tr('control.userModal.name', 'Name')}:</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onFocus={() => setUserModalActiveField('name')}
                    placeholder=""
                    className="px-4 py-3 rounded-lg max-w-[150px] bg-pos-panel border border-pos-border text-pos-text placeholder-pos-muted focus:outline-none focus:border-green-500 text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <label className="text-pos-text text-sm font-medium shrink-0 min-w-[100px] max-w-[100px]">{tr('control.userModal.pincode', 'Pincode')}:</label>
                  <input
                    type="text"
                    value={userPin}
                    onChange={(e) => setUserPin(String(e.target.value || '').replace(/\D/g, '').slice(0, 4))}
                    onFocus={() => setUserModalActiveField('pincode')}
                    placeholder=""
                    className="px-4 py-3 rounded-lg max-w-[150px] bg-pos-panel border border-pos-border text-pos-text placeholder-pos-muted focus:outline-none focus:border-green-500 text-sm"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex items-center">
                  <label className="text-pos-text text-sm font-medium shrink-0 min-w-[100px] max-w-[100px]" id="user-modal-role-label">
                    {tr('control.userModal.role', 'Role')}:
                  </label>
                  <div className="relative max-w-[200px] w-full" ref={roleDropdownRef}>
                    <button
                      type="button"
                      id="user-modal-role"
                      aria-labelledby="user-modal-role-label"
                      aria-haspopup="listbox"
                      aria-expanded={roleMenuOpen}
                      onClick={() => {
                        setRoleMenuOpen((o) => !o);
                        setUserModalActiveField(null);
                      }}
                      className={`flex w-full min-h-[44px] items-center justify-between gap-2 px-4 py-3 rounded-lg bg-pos-panel text-pos-text text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 border ${
                        roleMenuOpen ? 'border-green-500' : 'border-pos-border focus:border-green-500'
                      }`}
                    >
                      <span className="truncate">
                        {userRole === 'admin'
                          ? tr('control.userModal.roleAdmin', 'Admin')
                          : tr('control.userModal.roleWaiter', 'Waiter')}
                      </span>
                      <svg
                        className={`w-4 h-4 shrink-0 text-pos-text/80 transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {roleMenuOpen && (
                      <ul
                        role="listbox"
                        aria-labelledby="user-modal-role-label"
                        className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-green-500 bg-pos-panel py-1 shadow-xl ring-1 ring-black/20"
                      >
                        {USER_ROLE_OPTIONS.map((opt) => {
                          const selected = (userRole === 'admin' ? 'admin' : 'waiter') === opt.value;
                          return (
                            <li key={opt.value} role="option" aria-selected={selected}>
                              <button
                                type="button"
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                                  selected
                                    ? 'bg-blue-600 text-white'
                                    : 'text-pos-text hover:bg-pos-bg active:bg-green-500/25'
                                }`}
                                onClick={() => {
                                  setUserRole(opt.value);
                                  setRoleMenuOpen(false);
                                  setUserModalActiveField(null);
                                }}
                              >
                                {tr(opt.labelKey, opt.fallback)}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="text-pos-text text-sm font-medium mb-2">{tr('control.userModal.privileges', 'Privileges')}</div>
                <div className="grid grid-cols-3 gap-4">
                  {USER_PRIVILEGE_AVATAR_COLORS.map((color, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`w-14 h-14 rounded-full border-4 transition-colors ${userAvatarColorIndex === idx ? 'border-gray-400 ring-2 ring-offset-2 ring-offset-pos-bg ring-gray-300' : 'border-transparent active:opacity-90'} active:bg-green-500`}
                      style={{ backgroundColor: color }}
                      onClick={() => setUserAvatarColorIndex(idx)}
                      aria-label={tr('control.userModal.avatarColor', 'Avatar color {n}').replace('{n}', String(idx + 1))}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="">
              <div className="grid grid-cols-3 gap-x-12 w-full gap-y-5">
                {USER_PRIVILEGE_OPTIONS.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                    <span className="text-pos-text min-w-[200px] max-w-[200px]">{tr(`control.userModal.privilege.${p.id}`, p.label)}</span>
                    <input
                      type="checkbox"
                      checked={!!userPrivileges[p.id]}
                      onChange={(e) => setUserPrivileges((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                      className="w-10 h-10 rounded border-pos-border bg-pos-panel text-green-600 focus:ring-green-500"
                    />
                  </label>
                ))}
              </div>
              <div className="flex justify-center mt-20">
                <button type="button" className="flex items-center gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 text-md" disabled={savingUser} onClick={handleSaveUser}>
                  <svg fill="currentColor" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                  {tr('control.save', 'Save')}
                </button>
              </div>
            </div>
          )}
          {userModalTab === 'general' && (
            <div className="flex justify-center mt-14">
              <button type="button" className="flex items-center gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 text-md" disabled={savingUser} onClick={handleSaveUser}>
                <svg fill="currentColor" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                {tr('control.save', 'Save')}
              </button>
            </div>
          )}
        </div>
        <div className="shrink-0 w-full flex justify-center">
          <KeyboardWithNumpad value={userModalKeyboardValue} onChange={userModalKeyboardOnChange} />
        </div>
      </div>
    </div>
  );
}
