import React, { useState, useEffect, useMemo } from 'react';
import { Dropdown } from './Dropdown';
import { KeyboardWithNumpad } from './KeyboardWithNumpad';
import { useLanguage } from '../contexts/LanguageContext';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';
import { safeNumberInputValue } from './controlView/controlViewUtils.js';

const PRINTER_FORM_TYPE_OPTIONS = [
  { value: 'COM', label: 'COM' },
  { value: 'USB', label: 'USB' },
  { value: 'Network', label: 'Network' }
];

const PRINTER_FORM_COM_PORT_OPTIONS = [
  { value: 'COM1', label: 'COM 1' },
  { value: 'COM2', label: 'COM 2' },
  { value: 'COM3', label: 'COM 3' },
  { value: 'COM4', label: 'COM 4' },
  { value: 'COM5', label: 'COM 5' },
  { value: 'COM6', label: 'COM 6' },
  { value: 'COM7', label: 'COM 7' },
  { value: 'COM8', label: 'COM 8' }
];

const PRINTER_FORM_CHARACTERS_OPTIONS = [
  { value: '48', label: '48' },
  { value: '80', label: '80' },
  { value: '96', label: '96' }
];

const PRINTER_FORM_BAUDRATE_OPTIONS = [
  { value: '9600', label: '9600' },
  { value: '19200', label: '19200' },
  { value: '38400', label: '38400' },
  { value: '57600', label: '57600' },
  { value: '115200', label: '115200' }
];

const PRINTER_FORM_TICKET_SIZE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'small', label: 'Small' }
];

const PRINTER_FORM_SPACE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

const PRINTER_FORM_LOGO_OPTIONS = [
  { value: 'disable', label: 'Disable' },
  { value: 'enable', label: 'Enable' }
];

const PRINTER_FORM_PRINTER_TYPE_OPTIONS = [
  { value: 'Esc', label: 'Esc' },
  { value: 'TSPL', label: 'TSPL' }
];

const defaultForm = () => ({
  name: '',
  printerName: '',
  ipAddress: '',
  port: '',
  tab: 'general',
  type: 'COM',
  comPort: '',
  baudrate: '9600',
  characters: '48',
  standard: false,
  numberOfPrints: 1,
  productionTicketSize: 'normal',
  vatTicketSize: 'normal',
  spaceBetweenProducts: 'none',
  logo: 'disable',
  printerType: 'Esc'
});

export function PrinterModal({ open, initialPrinter, onClose, onSave, onNotify }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const typeOptions = useMemo(() => [
    { value: 'COM', label: tr('printerModal.typeCom', 'COM') },
    { value: 'USB', label: tr('printerModal.typeUsb', 'USB') },
    { value: 'Network', label: tr('printerModal.typeNetwork', 'Network') }
  ], [t]);
  const ticketSizeOptions = useMemo(() => [
    { value: 'normal', label: tr('printerModal.sizeNormal', 'Normal') },
    { value: 'large', label: tr('printerModal.sizeLarge', 'Large') },
    { value: 'small', label: tr('printerModal.sizeSmall', 'Small') }
  ], [t]);
  const spaceOptions = useMemo(() => [
    { value: 'none', label: tr('printerModal.spaceNone', 'None') },
    { value: 'small', label: tr('printerModal.spaceSmall', 'Small') },
    { value: 'medium', label: tr('printerModal.spaceMedium', 'Medium') },
    { value: 'large', label: tr('printerModal.spaceLarge', 'Large') }
  ], [t]);
  const logoOptions = useMemo(() => [
    { value: 'disable', label: tr('printerModal.logoDisable', 'Disable') },
    { value: 'enable', label: tr('printerModal.logoEnable', 'Enable') }
  ], [t]);
  const [name, setName] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [activeField, setActiveField] = useState('name');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('');
  const [tab, setTab] = useState('general');
  const [type, setType] = useState('COM');
  const [comPort, setComPort] = useState('');
  const [baudrate, setBaudrate] = useState('9600');
  const [characters, setCharacters] = useState('48');
  const [standard, setStandard] = useState(false);
  const [numberOfPrints, setNumberOfPrints] = useState(1);
  const [productionTicketSize, setProductionTicketSize] = useState('normal');
  const [vatTicketSize, setVatTicketSize] = useState('normal');
  const [spaceBetweenProducts, setSpaceBetweenProducts] = useState('none');
  const [logo, setLogo] = useState('disable');
  const [printerType, setPrinterType] = useState('Esc');
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = defaultForm();
    if (initialPrinter) {
      setName(initialPrinter.name || '');
      setPrinterName(initialPrinter.printerName || initialPrinter.name || '');
      setIpAddress(initialPrinter.ipAddress || '');
      setPort(initialPrinter.port || '');
      setTab('general');
      setType(initialPrinter.type || 'COM');
      setComPort(initialPrinter.comPort || '');
      setBaudrate(initialPrinter.baudrate || '9600');
      setCharacters(initialPrinter.characters || '48');
      setStandard(!!initialPrinter.standard);
      {
        const nop = Number(initialPrinter.numberOfPrints);
        setNumberOfPrints(Number.isFinite(nop) && nop >= 1 ? Math.floor(nop) : 1);
      }
      setProductionTicketSize(initialPrinter.productionTicketSize || 'normal');
      setVatTicketSize(initialPrinter.vatTicketSize || 'normal');
      setSpaceBetweenProducts(initialPrinter.spaceBetweenProducts || 'none');
      setLogo(initialPrinter.logo || 'disable');
      setPrinterType(initialPrinter.printerType || 'Esc');
      setActiveField(
        (initialPrinter.type || 'COM') === 'USB'
          ? 'printerName'
          : (initialPrinter.type || 'COM') === 'Network'
            ? 'ipAddress'
            : 'name'
      );
    } else {
      setName(d.name);
      setPrinterName(d.printerName);
      setIpAddress(d.ipAddress);
      setPort(d.port);
      setTab(d.tab);
      setType(d.type);
      setComPort(d.comPort);
      setBaudrate(d.baudrate);
      setCharacters(d.characters);
      setStandard(d.standard);
      setNumberOfPrints(d.numberOfPrints);
      setProductionTicketSize(d.productionTicketSize);
      setVatTicketSize(d.vatTicketSize);
      setSpaceBetweenProducts(d.spaceBetweenProducts);
      setLogo(d.logo);
      setPrinterType(d.printerType);
      setActiveField('name');
    }
  }, [open, initialPrinter]);

  const handleSave = () => {
    const trimmedName = (name || '').trim();
    const trimmedPrinterName = (printerName || '').trim();
    const trimmedIpAddress = (ipAddress || '').trim();
    const trimmedPort = (port || '').trim();
    const finalName = type === 'USB' ? (trimmedPrinterName || trimmedName) : trimmedName;
    if (!finalName) return;
    if (type === 'Network' && (!trimmedIpAddress || !trimmedPort)) return;
    onSave({
      name: finalName,
      printerName: trimmedPrinterName,
      ipAddress: trimmedIpAddress,
      port: trimmedPort,
      type,
      comPort,
      baudrate,
      characters,
      standard,
      numberOfPrints,
      productionTicketSize,
      vatTicketSize,
      spaceBetweenProducts,
      logo,
      printerType
    });
  };

  const buildApiPrinterPayload = () => {
    const trimmedName = (name || '').trim();
    const trimmedPrinterName = (printerName || '').trim();
    const trimmedIpAddress = (ipAddress || '').trim();
    const trimmedPort = (port || '').trim();
    const safePort = trimmedPort || '9100';
    const apiType = type === 'COM' ? 'serial' : 'windows';
    const connectionString =
      type === 'COM'
        ? `serial://${(comPort || '').trim().toUpperCase()}`
        : type === 'USB'
          ? trimmedPrinterName
          : `tcp://${trimmedIpAddress}:${safePort}`;
    return {
      name: type === 'USB' ? (trimmedPrinterName || trimmedName) : trimmedName,
      type: apiType,
      connection_string: connectionString,
      baud_rate: type === 'COM' ? baudrate : null,
      data_bits: null,
      parity: null,
      stop_bits: null,
      is_main: standard ? 1 : 0,
      enabled: 1,
    };
  };

  const handleTestPrint = async () => {
    setTestLoading(true);
    try {
      const payload = buildApiPrinterPayload();
      const res = await fetch(`${API}/printers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onNotify?.('success', data?.message || tr('printerModal.testSuccess', 'Test print succeeded.'));
    } catch (err) {
      onNotify?.('error', err?.message || tr('printerModal.testFailed', 'Test print failed.'));
    } finally {
      setTestLoading(false);
    }
  };

  const keyboardValue =
    activeField === 'printerName'
      ? printerName
      : activeField === 'ipAddress'
        ? ipAddress
        : activeField === 'port'
          ? port
      : activeField === 'baudrate'
        ? baudrate
        : name;

  const handleKeyboardChange = (nextValue) => {
    if (activeField === 'printerName') {
      setPrinterName(nextValue);
      return;
    }
    if (activeField === 'baudrate') {
      setBaudrate(nextValue);
      return;
    }
    if (activeField === 'ipAddress') {
      setIpAddress(nextValue);
      return;
    }
    if (activeField === 'port') {
      setPort(nextValue);
      return;
    }
    setName(nextValue);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={onClose} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex mt-6 mb-4 px-6 w-full justify-center shrink-0 gap-20">
          {[
            { id: 'general', label: tr('printerModal.tabGeneral', 'General') },
            { id: 'production', label: tr('printerModal.tabProductionSorting', 'Production sorting') }
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tabItem.id ? 'border-blue-500 text-pos-text' : 'border-transparent text-pos-muted active:text-pos-text'} active:bg-green-500`}
              onClick={() => setTab(tabItem.id)}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
        <div className="p-6 overflow-hidden flex-1 flex flex-col py-2">
          {tab === 'general' && (
            <div className="grid grid-cols-3 w-full gap-6 text-sm">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('name', 'Name')} :</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setActiveField('name')}
                    onClick={() => setActiveField('name')}
                    className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.type', 'Type')} :</label>
                  <Dropdown options={typeOptions} value={type} onChange={setType} placeholder="COM" className="text-md min-w-[150px]" />
                </div>
                {type === 'USB' ? (
                  <div className="flex items-center gap-3">
                    <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.printerName', 'Printer Name')} *</label>
                    <input
                      type="text"
                      value={printerName}
                      onChange={(e) => setPrinterName(e.target.value)}
                      onFocus={() => setActiveField('printerName')}
                      onClick={() => setActiveField('printerName')}
                      className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200"
                    />
                  </div>
                ) : type === 'Network' ? (
                  <>
                    <div className="flex items-center gap-3">
                      <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.ipAddress', 'IP address')} :</label>
                      <input
                        type="text"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        onFocus={() => setActiveField('ipAddress')}
                        onClick={() => setActiveField('ipAddress')}
                        className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.port', 'Port')} :</label>
                      <input
                        type="text"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        onFocus={() => setActiveField('port')}
                        onClick={() => setActiveField('port')}
                        className="px-4 w-[100px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.comPort', 'Com port')} :</label>
                      <Dropdown options={PRINTER_FORM_COM_PORT_OPTIONS} value={comPort} onChange={setComPort} placeholder="Select" className="text-md min-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.baudrate', 'Baudrate')} :</label>
                      <Dropdown
                        options={PRINTER_FORM_BAUDRATE_OPTIONS}
                        value={baudrate}
                        onChange={setBaudrate}
                        placeholder="9600"
                        className="text-md min-w-[100px]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.characters', 'Characters')} :</label>
                      <Dropdown options={PRINTER_FORM_CHARACTERS_OPTIONS} value={characters} onChange={setCharacters} placeholder="48" className="text-md min-w-[100px]" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex gap-2 items-center justify-start">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.standard', 'Standard')} :</label>
                  <div className="w-[150px] flex items-center justify-start">
                    <input type="checkbox" checked={standard} onChange={(e) => setStandard(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.numberOfPrints', 'Number of prints')} :</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 font-medium"
                      onClick={() =>
                        setNumberOfPrints((n) => {
                          const cur = Number.isFinite(n) ? n : 1;
                          return Math.max(1, cur - 1);
                        })
                      }
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={safeNumberInputValue(numberOfPrints, 1)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setNumberOfPrints(Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1);
                      }}
                      className="w-16 px-2 py-2 bg-pos-panel border border-gray-300 rounded text-gray-200 text-center h-[40px]"
                    />
                    <button
                      type="button"
                      className="p-2 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 font-medium"
                      onClick={() =>
                        setNumberOfPrints((n) => {
                          const cur = Number.isFinite(n) ? n : 1;
                          return cur + 1;
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <label className="block min-w-[130px] max-w-[130px] font-medium text-gray-200">{tr('printerModal.textSizeProduction', 'Text size Production ticket')} :</label>
                  <Dropdown options={ticketSizeOptions} value={productionTicketSize} onChange={setProductionTicketSize} placeholder={tr('printerModal.sizeNormal', 'Normal')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[130px] max-w-[130px] font-medium text-gray-200">{tr('printerModal.vatTicketSize', 'Total amount of VAT ticket size')} :</label>
                  <Dropdown options={ticketSizeOptions} value={vatTicketSize} onChange={setVatTicketSize} placeholder={tr('printerModal.sizeNormal', 'Normal')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[130px] max-w-[130px] font-medium text-gray-200">{tr('printerModal.spaceBetweenProducts', 'Space between products')} :</label>
                  <Dropdown options={spaceOptions} value={spaceBetweenProducts} onChange={setSpaceBetweenProducts} placeholder={tr('printerModal.spaceNone', 'None')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[130px] max-w-[130px] font-medium text-gray-200">{tr('printerModal.logo', 'Logo')} :</label>
                  <Dropdown options={logoOptions} value={logo} onChange={setLogo} placeholder={tr('printerModal.logoDisable', 'Disable')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[130px] max-w-[130px] font-medium text-gray-200">{tr('printerModal.printerType', 'Printer type')} :</label>
                  <Dropdown options={PRINTER_FORM_PRINTER_TYPE_OPTIONS} value={printerType} onChange={setPrinterType} placeholder="Esc" className="text-md min-w-[120px]" />
                </div>
              </div>
            </div>
          )}
          {tab === 'production' && (
            <div className="grid grid-cols-3 w-full gap-6 text-sm mb-10 mt-5">
              <div className="flex flex-col gap-6">
                <div className="flex gap-2 items-center justify-start">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.standard', 'Standard')} :</label>
                  <div className="w-[200px] flex items-center justify-start">
                    <input type="checkbox" checked={standard} onChange={(e) => setStandard(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.numberOfPrints', 'Number of prints')} :</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 font-medium"
                      onClick={() =>
                        setNumberOfPrints((n) => {
                          const cur = Number.isFinite(n) ? n : 1;
                          return Math.max(1, cur - 1);
                        })
                      }
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={safeNumberInputValue(numberOfPrints, 1)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setNumberOfPrints(Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1);
                      }}
                      className="w-16 px-2 py-2 bg-pos-panel border border-gray-300 rounded text-gray-200 text-center h-[40px]"
                    />
                    <button
                      type="button"
                      className="p-2 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 font-medium"
                      onClick={() =>
                        setNumberOfPrints((n) => {
                          const cur = Number.isFinite(n) ? n : 1;
                          return cur + 1;
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <label className="block min-w-[140px] max-w-[140px] font-medium text-gray-200">{tr('printerModal.textSizeProduction', 'Text size Production ticket')} :</label>
                  <Dropdown options={ticketSizeOptions} value={productionTicketSize} onChange={setProductionTicketSize} placeholder={tr('printerModal.sizeNormal', 'Normal')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[140px] max-w-[140px] font-medium text-gray-200">{tr('printerModal.vatTicketSize', 'Total amount of VAT ticket size')} :</label>
                  <Dropdown options={ticketSizeOptions} value={vatTicketSize} onChange={setVatTicketSize} placeholder={tr('printerModal.sizeNormal', 'Normal')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[140px] max-w-[140px] font-medium text-gray-200">{tr('printerModal.spaceBetweenProducts', 'Space between products')} :</label>
                  <Dropdown options={spaceOptions} value={spaceBetweenProducts} onChange={setSpaceBetweenProducts} placeholder={tr('printerModal.spaceNone', 'None')} className="text-md min-w-[120px]" />
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.logo', 'Logo')} :</label>
                  <Dropdown options={logoOptions} value={logo} onChange={setLogo} placeholder={tr('printerModal.logoDisable', 'Disable')} className="text-md min-w-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="block min-w-[100px] max-w-[100px] font-medium text-gray-200">{tr('printerModal.printerType', 'Printer type')} :</label>
                  <Dropdown options={PRINTER_FORM_PRINTER_TYPE_OPTIONS} value={printerType} onChange={setPrinterType} placeholder="Esc" className="text-md min-w-[120px]" />
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-center gap-4 text-md pt-5">
            <button type="button" className="flex items-center gap-4 px-6 py-3 rounded-lg bg-pos-panel border border-pos-border text-pos-text font-medium active:bg-green-500 disabled:opacity-60" onClick={handleTestPrint} disabled={testLoading}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              {testLoading ? tr('printerModal.testing', 'Testing...') : tr('printerModal.testPrint', 'Test print')}
            </button>
            <button type="button" className="flex items-center gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={!(name || '').trim()} onClick={handleSave}>
              <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
        <div className="shrink-0">
          <KeyboardWithNumpad value={keyboardValue} onChange={handleKeyboardChange} />
        </div>
      </div>
    </div>
  );
}
