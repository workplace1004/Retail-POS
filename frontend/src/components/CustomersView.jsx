import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { KeyboardWithNumpad } from './KeyboardWithNumpad';

import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';
const ROW1_KEYS = 'a z e r t y u i o p'.split(' ');
const ROW2_KEYS = 'q s d f g h j k l m'.split(' ');
const ROW3_KEYS = 'w x c v b n , €'.split(' ');
const NUMPAD_KEYS = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['-', '0', '.']];
const KEY_STYLE = 'w-[100px] h-[60px] bg-pos-panel rounded text-white text-4xl active:bg-green-500 border border-transparent transition-colors';
const INPUT_STYLE = 'w-full py-3 px-3 bg-pos-bg min-w-[175px] border border-pos-panel text-pos-text outline-none';
const DISABLED_PRICE_GROUP = { value: 'disabled', labelKey: 'control.productModal.disabled' };
const EMPTY_NEW_CUSTOMER = {
  companyName: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  discount: '',
  priceGroup: 'disabled',
  streetHouseNumber: '',
  postalCode: '',
  city: '',
  vatNumber: '',
  loyaltyBarcode: '',
  loyaltyTag: ''
};

export function CustomersView({
  onBack,
  onSelectCustomer,
  onNoCustomer,
  orderCustomer
}) {
  const { t } = useLanguage();
  const [uppercase, setUppercase] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState({ companyName: '', name: '', street: '', phone: '' });
  const [quickSearch, setQuickSearch] = useState('');
  const [priceGroups, setPriceGroups] = useState([]);
  const [customerFormMode, setCustomerFormMode] = useState(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isPriceGroupOpen, setIsPriceGroupOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState(EMPTY_NEW_CUSTOMER);
  const activeInputRef = useRef(null);
  const listRef = useRef(null);
  const priceGroupDropdownRef = useRef(null);
  const isCustomerFormOpen = customerFormMode !== null;

  const fetchCustomers = useCallback(async () => {
    try {
      // Full list; no server-side search — sidebar quick search filters in the UI.
      const res = await fetch(`${API}/customers`, { cache: 'no-store' });
      const data = res.ok ? await res.json() : [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  /** If the order still references a customer that is missing from the list, fetch that row (edge cases / race). */
  useEffect(() => {
    const id = orderCustomer?.id != null ? String(orderCustomer.id).trim() : '';
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/customers/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const one = await res.json();
        if (!one?.id || cancelled) return;
        setCustomers((prev) => {
          if (prev.some((c) => c.id === one.id)) return prev;
          return [...prev, one].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
          );
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderCustomer?.id, API]);

  useEffect(() => {
    const id = orderCustomer?.id != null ? String(orderCustomer.id).trim() : '';
    if (!id || !customers.length) return;
    const match = customers.find((c) => String(c.id) === id);
    if (match) setSelectedCustomer(match);
  }, [orderCustomer?.id, customers]);

  useEffect(() => {
    const fetchPriceGroups = async () => {
      try {
        const res = await fetch(`${API}/price-groups`);
        const data = res.ok ? await res.json() : [];
        setPriceGroups(Array.isArray(data) ? data : []);
      } catch {
        setPriceGroups([]);
      }
    };
    fetchPriceGroups();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!isPriceGroupOpen) return;
      if (priceGroupDropdownRef.current && !priceGroupDropdownRef.current.contains(event.target)) {
        setIsPriceGroupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPriceGroupOpen]);

  const setActiveInput = (e) => {
    activeInputRef.current = e.target;
  };

  const handleKeyboardChange = (nextValue) => {
    const el = activeInputRef.current;
    if (!el) return;
    const name = el.name;
    if (!name) return;
    if (name === 'quickSearch') {
      setQuickSearch(nextValue);
      return;
    }
    if (isCustomerFormOpen) {
      setNewCustomerForm((s) => ({ ...s, [name]: nextValue }));
      return;
    }
    setSearch((s) => ({ ...s, [name]: nextValue }));
  };

  const activeValue = activeInputRef.current?.name
    ? (activeInputRef.current.name === 'quickSearch'
      ? quickSearch
      : isCustomerFormOpen
        ? (newCustomerForm[activeInputRef.current.name] || '')
        : (search[activeInputRef.current.name] || ''))
    : '';

  const displayKey = (key) => (/^[a-z]$/.test(key) ? (uppercase ? key.toUpperCase() : key) : key);

  const pressKey = (key) => {
    if (key === 'Backspace') {
      handleKeyboardChange(activeValue.slice(0, -1));
      return;
    }
    handleKeyboardChange(activeValue + key);
  };

  const pressLetterOrSymbol = (key) => {
    if (/^[a-z]$/.test(key)) {
      pressKey(uppercase ? key.toUpperCase() : key);
      return;
    }
    pressKey(key);
  };

  const scrollList = (direction) => {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(96, Math.round(el.clientHeight * 0.72));
    el.scrollBy({ top: direction * step, behavior: 'smooth' });
  };

  const mapCustomerToForm = (customer) => {
    const nameParts = String(customer?.name || '').trim().split(/\s+/).filter(Boolean);
    const selectedPriceGroup = customer?.priceGroup || 'disabled';
    return {
      ...EMPTY_NEW_CUSTOMER,
      companyName: customer?.companyName || '',
      firstName: customer?.firstName || nameParts[0] || '',
      lastName: customer?.lastName || nameParts.slice(1).join(' '),
      phone: customer?.phone || '',
      email: customer?.email || '',
      discount: customer?.discount || '',
      priceGroup: selectedPriceGroup,
      streetHouseNumber: customer?.street || '',
      postalCode: customer?.postalCode || '',
      city: customer?.city || '',
      vatNumber: customer?.vatNumber || '',
      loyaltyBarcode: customer?.loyaltyCardBarcode || '',
      loyaltyTag: customer?.creditTag || ''
    };
  };

  const openNewCustomerMode = () => {
    activeInputRef.current = null;
    setIsPriceGroupOpen(false);
    setNewCustomerForm(EMPTY_NEW_CUSTOMER);
    setCustomerFormMode('create');
  };

  const openEditCustomerMode = () => {
    if (!selectedCustomer) return;
    activeInputRef.current = null;
    setIsPriceGroupOpen(false);
    setNewCustomerForm(mapCustomerToForm(selectedCustomer));
    setCustomerFormMode('edit');
  };

  const closeCustomerForm = () => {
    activeInputRef.current = null;
    setCustomerFormMode(null);
    setIsSavingCustomer(false);
    setIsPriceGroupOpen(false);
    setNewCustomerForm(EMPTY_NEW_CUSTOMER);
  };

  const saveCustomer = async () => {
    if (isSavingCustomer) return;
    setIsSavingCustomer(true);
    try {
      const fullName = `${newCustomerForm.firstName} ${newCustomerForm.lastName}`.trim();
      const companyName = newCustomerForm.companyName.trim();
      const resolvedName = fullName || companyName;
      if (!resolvedName) return;
      const payload = {
        companyName,
        firstName: newCustomerForm.firstName.trim(),
        lastName: newCustomerForm.lastName.trim(),
        name: resolvedName,
        street: [newCustomerForm.streetHouseNumber, newCustomerForm.postalCode, newCustomerForm.city]
          .map((v) => v.trim())
          .filter(Boolean)
          .join(' '),
        postalCode: newCustomerForm.postalCode.trim(),
        city: newCustomerForm.city.trim(),
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim(),
        discount: newCustomerForm.discount.trim(),
        priceGroup: newCustomerForm.priceGroup === 'disabled' ? '' : newCustomerForm.priceGroup,
        vatNumber: newCustomerForm.vatNumber.trim(),
        loyaltyCardBarcode: newCustomerForm.loyaltyBarcode.trim(),
        creditTag: newCustomerForm.loyaltyTag.trim()
      };
      const isEdit = customerFormMode === 'edit' && selectedCustomer?.id;
      const response = await fetch(isEdit ? `${API}/customers/${selectedCustomer.id}` : `${API}/customers`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to save customer');
      const saved = await response.json();
      await fetchCustomers();
      if (saved?.id) setSelectedCustomer(saved);
      closeCustomerForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const normalizedQuickSearch = quickSearch.trim().toLowerCase();
  const priceGroupOptions = [
    { value: DISABLED_PRICE_GROUP.value, label: t(DISABLED_PRICE_GROUP.labelKey) },
    ...priceGroups.map((group) => ({ value: group.id, label: group.name || '-' }))
  ];
  const selectedPriceGroupOption = priceGroupOptions.find((option) => option.value === newCustomerForm.priceGroup) || priceGroupOptions[0];
  const visibleCustomers = normalizedQuickSearch
    ? customers.filter((customer) =>
        [customer.companyName, customer.name, customer.street, customer.phone, customer.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuickSearch))
      )
    : customers;

  return (
    <div className="flex flex-col h-full bg-pos-bg text-pos-text p-3 gap-3">
      <div className="flex flex-1 min-h-0 gap-3">
        <main className="flex-1 min-w-0 flex flex-col">
          {isCustomerFormOpen ? (
            <div className="flex-1 min-h-0 border border-pos-panel rounded-md p-3">
              <div className="flex justify-around h-full">
                <div className='flex flex-col'>
                  <div className='text-sm flex items-center'>
                    <label className="block min-w-[160px] max-w-[160px] text-sm font-semibold w-full flex">{t('customersCompanyName')}:</label>
                    <input name="companyName" value={newCustomerForm.companyName} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, companyName: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersFirstName')}:</label>
                    <input name="firstName" value={newCustomerForm.firstName} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, firstName: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('name')}:</label>
                    <input name="lastName" value={newCustomerForm.lastName} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, lastName: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersPhone')}:</label>
                    <input name="phone" value={newCustomerForm.phone} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, phone: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersEmail')}:</label>
                    <input name="email" value={newCustomerForm.email} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, email: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersDiscount')}:</label>
                    <input name="discount" value={newCustomerForm.discount} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, discount: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersPriceGroup')}:</label>
                    <div ref={priceGroupDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsPriceGroupOpen((prev) => !prev)}
                        className={`${INPUT_STYLE} flex items-center justify-between`}
                      >
                        <span>{selectedPriceGroupOption.label}</span>
                        <span className="text-sm">▼</span>
                      </button>
                      {isPriceGroupOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-pos-panel border border-pos-border rounded-md overflow-hidden shadow-lg">
                          {priceGroupOptions.map((option) => {
                            const isSelected = newCustomerForm.priceGroup === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setNewCustomerForm((prev) => ({ ...prev, priceGroup: option.value }));
                                  setIsPriceGroupOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 transition-colors ${isSelected ? 'bg-pos-surface text-white' : 'bg-pos-panel text-pos-text active:bg-green-500'
                                  }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className='text-sm flex flex-col items-center'>
                  <div className='flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersStreetHouseNumber')}:</label>
                    <input name="streetHouseNumber" value={newCustomerForm.streetHouseNumber} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, streetHouseNumber: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersPostcode')}:</label>
                    <input name="postalCode" value={newCustomerForm.postalCode} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, postalCode: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersCity')}:</label>
                    <input name="city" value={newCustomerForm.city} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, city: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersVatNumber')}:</label>
                    <input name="vatNumber" value={newCustomerForm.vatNumber} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, vatNumber: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                    <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersLoyaltyCardBarcode')}:</label>
                    <input name="loyaltyBarcode" value={newCustomerForm.loyaltyBarcode} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, loyaltyBarcode: e.target.value }))} className={INPUT_STYLE} />
                  </div>
                  <div className='pt-4 text-sm flex items-center'>
                        <label className="block text-sm font-semibold w-full flex min-w-[160px] max-w-[160px]">{t('customersCreditTag')}:</label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input name="loyaltyTag" value={newCustomerForm.loyaltyTag} onFocus={setActiveInput} onChange={(e) => setNewCustomerForm((s) => ({ ...s, loyaltyTag: e.target.value }))} className={INPUT_STYLE} />
                      {/* <button type="button" className="py-3 px-6 bg-pos-surface rounded-md text-2xl active:bg-green-500">
                        {t('customersExtraTags')}
                      </button> */}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6 min-w-[200px] h-full justify-around py-20">
                  <button type="button" onClick={saveCustomer} disabled={isSavingCustomer} className="py-3 px-5 bg-pos-surface rounded-md text-md active:bg-green-500 disabled:opacity-60">
                    {t('control.save')}
                  </button>
                  <button type="button" onClick={closeCustomerForm} className="py-3 px-5 bg-pos-surface rounded-md text-md active:bg-green-500">
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 px-3 pb-2 pt-5 text-md font-semibold text-pos-text">
                <div>{t('customersCompanyName')}:</div>
                <div>{t('name')}:</div>
                <div>{t('customersStreetHouseNumber')}:</div>
                <div>{t('customersPhone')}:</div>
              </div>

              <div
                ref={listRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-pos-bg border border-pos-panel rounded-md scroll-smooth"
              >
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {visibleCustomers.map((c) => (
                      <tr
                        key={c.id}
                        className={`grid grid-cols-[1fr_1fr_1fr_1fr] px-3 py-3 border-b border-pos-border cursor-pointer transition-colors ${selectedCustomer?.id === c.id ? 'bg-green-600 text-white' : ''
                          }`}
                        onClick={() => setSelectedCustomer(c)}
                      >
                        <td>{c.companyName || ''}</td>
                        <td>{c.name || ''}</td>
                        <td>{c.street || ''}</td>
                        <td>{c.phone || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-center gap-40 py-2 text-xl">
                <button type="button" className="text-pos-text active:text-white active:bg-green-500" onClick={() => scrollList(-1)}>↑</button>
                <button type="button" className="text-pos-text active:text-white active:bg-green-500" onClick={() => scrollList(1)}>↓</button>
              </div>
            </>
          )}
        </main>

        {!isCustomerFormOpen && (
          <aside className="w-[170px] shrink-0 flex flex-col gap-4 text-sm h-full justify-around py-8">
            <input
              name="quickSearch"
              value={quickSearch}
              onFocus={setActiveInput}
              onClick={setActiveInput}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder={t('customersSearchPlaceholder')}
              className="py-3 px-3 bg-pos-surface border border-pos-border rounded-md text-pos-text outline-none"
            />
            <button type="button" onClick={openNewCustomerMode} className="py-3 px-3 bg-pos-surface border-none rounded-md text-pos-text text-left active:bg-green-500">
              {t('customersNewCustomer')}
            </button>
            <button type="button" onClick={openEditCustomerMode} disabled={!selectedCustomer} className="py-3 px-3 bg-pos-surface border-none rounded-md text-pos-text text-left active:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {t('customersEditCustomer')}
            </button>
            <button type="button" className="py-3 px-3 bg-pos-surface border-none rounded-md text-pos-text text-left active:bg-green-500">
              {t('history')}
            </button>
            <button type="button" className="py-3 px-3 bg-pos-surface border-none rounded-md text-pos-text text-left active:bg-green-500">
              {t('customersPickup')}
            </button>
            <button type="button" className="py-3 px-3 bg-pos-surface border-none rounded-md text-pos-text text-left active:bg-green-500">
              {t('customersDeliver')}
            </button>
            <button
              type="button"
              className="py-3 px-3 bg-pos-surface border-none rounded-md text-pos-text text-left active:bg-green-500"
              onClick={() => onNoCustomer?.()}
            >
              {t('customersNone')}
            </button>
          </aside>
        )}
      </div>

      {!isCustomerFormOpen && (
        <div className="grid grid-cols-4 gap-3 text-sm shrink-0">
          <button type="button" className="py-3 px-4 bg-pos-panel border-none rounded text-pos-text active:bg-green-500" onClick={onBack}>
            {t('backName')}
          </button>
          <button type="button" className="py-3 px-4 bg-pos-panel border-none rounded text-pos-text active:bg-green-500">
            {t('customersNewReservation')}
          </button>
          <button
            type="button"
            className="py-3 px-4 bg-pos-panel border-none rounded text-pos-text active:bg-green-500"
            onClick={() => onNoCustomer?.()}
          >
            {t('customersNoCustomer')}
          </button>
          <button
            type="button"
            disabled={!selectedCustomer}
            className="py-3 px-4 bg-pos-panel border-none rounded text-pos-text active:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => selectedCustomer && onSelectCustomer?.(selectedCustomer)}
          >
            {t('customersSelectCustomer')}
          </button>
        </div>
      )}

      <div className="shrink-0 p-0 flex gap-4 w-full justify-center">
        <KeyboardWithNumpad
          value={activeValue}
          onChange={handleKeyboardChange}
        />
      </div>
    </div>
  );
}

