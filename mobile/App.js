import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import {
  createProduct,
  fetchCategories,
  fetchPriceGroups,
  fetchPrinters,
  fetchProducts,
  getApiBaseUrl,
  setApiBaseUrl,
  updateProduct
} from './src/api';

function toNumberOrZero(value) {
  const num = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

const PRODUCT_TABS = [
  { id: 'general', label: 'General' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'extra_prices', label: 'Extra prices' },
  { id: 'purchase_stock', label: 'Purchase & stock' }
];

const VAT_OPTIONS = ['0', '6', '9', '12', '21'];
const PURCHASE_UNITS = ['Piece', 'Kg', 'Liter', 'Meter'];
const ADDITION_OPTIONS = ['Subproducts'];
const SUPPLIER_OPTIONS = ['Disabled'];
const PREPACK_EXPIRY_TYPE_OPTIONS = ['Shelf life', 'Expiration date'];
const LABEL_TYPE_VALUES = new Set(['production-labels', 'article-label', 'scale-labels', 'pre-packaging-labels']);

function normalizeLabelType(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (LABEL_TYPE_VALUES.has(value)) return value;
  return 'production-labels';
}

function CheckboxRow({ label, value, onValueChange }) {
  return (
    <Pressable style={styles.checkboxFieldRow} onPress={() => onValueChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: !!value }}>
      <Text style={styles.checkboxFieldLabel} numberOfLines={2}>
        {label}
      </Text>
      <View style={[styles.checkboxBox, value ? styles.checkboxBoxChecked : null]}>{value ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
    </Pressable>
  );
}

export default function App() {
  const toastTimerRef = useRef(null);
  const mainScrollRef = useRef(null);
  const inputRefs = useRef({});
  const scrollYRef = useRef(0);
  const keyboardTopRef = useRef(Dimensions.get('window').height);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(getApiBaseUrl());
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [missingBarcode, setMissingBarcode] = useState('');
  const [isNotFoundModalVisible, setIsNotFoundModalVisible] = useState(false);
  const [isCreateProductModalVisible, setIsCreateProductModalVisible] = useState(false);
  const [isCategorySelectVisible, setIsCategorySelectVisible] = useState(false);
  const [isAdditionSelectVisible, setIsAdditionSelectVisible] = useState(false);
  const [isSupplierSelectVisible, setIsSupplierSelectVisible] = useState(false);
  const [isPurchaseVatSelectVisible, setIsPurchaseVatSelectVisible] = useState(false);
  const [isProductPurchaseVatSelectVisible, setIsProductPurchaseVatSelectVisible] = useState(false);
  const [isPrepackExpiryTypeSelectVisible, setIsPrepackExpiryTypeSelectVisible] = useState(false);
  const [isPrinterSelectVisible, setIsPrinterSelectVisible] = useState(false);
  const [isProductLabelsModalVisible, setIsProductLabelsModalVisible] = useState(false);
  const [isLabelCategorySelectVisible, setIsLabelCategorySelectVisible] = useState(false);
  const [isLabelFormatSelectVisible, setIsLabelFormatSelectVisible] = useState(false);
  const [printerSelectField, setPrinterSelectField] = useState('printer1');
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newProductTab, setNewProductTab] = useState('general');
  const [categories, setCategories] = useState([]);
  const [priceGroups, setPriceGroups] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    keyName: '',
    productionName: '',
    price: '',
    categoryId: '',
    categoryIdsJson: [],
    addition: 'Subproducts',
    vatTakeOut: '6',
    vatEatIn: '6',
    barcode: '',
    printer1: '',
    printer2: '',
    printer3: '',
    openPrice: false,
    weegschaal: false,
    subproductRequires: false,
    leeggoedPrijs: '0.00',
    pagerVerplicht: false,
    boldPrint: false,
    groupingReceipt: true,
    labelExtraInfo: '',
    voorverpakVervaltype: 'Shelf life',
    houdbareDagen: '0',
    bewarenGebruik: '',
    extraPricesRows: [],
    purchaseVat: '6',
    purchasePriceExcl: '',
    purchasePriceIncl: '',
    profitPct: '0.00',
    unit: 'Piece',
    unitContent: '0',
    stock: '0',
    supplier: '',
    supplierCode: '',
    stockNotification: true,
    expirationDate: '',
    declarationExpiryDays: '0',
    notificationSoldOutPieces: ''
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    price: '',
    purchaseVat: '6',
    purchasePriceExcl: '',
    purchasePriceIncl: '',
    profitPct: '0.00'
  });
  const [labelCategories, setLabelCategories] = useState([]);
  const [labelCategoryId, setLabelCategoryId] = useState('');
  const [labelProducts, setLabelProducts] = useState([]);
  const [labelProductsLoading, setLabelProductsLoading] = useState(false);
  const [labelSelectedProductId, setLabelSelectedProductId] = useState('');
  const [labelSearch, setLabelSearch] = useState('');
  const [labelPrintCount, setLabelPrintCount] = useState('1');
  const [labelFormats, setLabelFormats] = useState([]);
  const [labelFormat, setLabelFormat] = useState('');
  const [includeProductName, setIncludeProductName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeBarcode, setIncludeBarcode] = useState(true);
  const [configuredLabelPrinterId, setConfiguredLabelPrinterId] = useState('');
  const [configuredLabelType, setConfiguredLabelType] = useState('production-labels');
  const [printingLabel, setPrintingLabel] = useState(false);
  const [labelPrintError, setLabelPrintError] = useState('');
  const [categorySortDirection, setCategorySortDirection] = useState('asc');

  const canUseCamera = permission?.granted === true;

  const registerInputRef = useCallback((key) => (node) => {
    inputRefs.current[key] = node;
  }, []);

  const scrollFocusedInputIntoView = useCallback((key) => {
    const node = inputRefs.current[key];
    if (!node || typeof node.measureInWindow !== 'function') return;
    setTimeout(() => {
      node.measureInWindow((_x, y, _w, h) => {
        const keyboardTop = keyboardTopRef.current || Dimensions.get('window').height;
        const bottom = y + h;
        const visibleBottom = keyboardTop - 16;
        if (bottom <= visibleBottom) return;
        const delta = bottom - visibleBottom;
        mainScrollRef.current?.scrollTo({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true
        });
      });
    }, 50);
  }, []);

  const setProductInForm = useCallback((product) => {
    setSelectedProduct(product);
    setForm({
      price: String(product.price ?? ''),
      purchaseVat: String(product.purchaseVat ?? '6'),
      purchasePriceExcl: String(product.purchasePriceExcl ?? ''),
      purchasePriceIncl: String(product.purchasePriceIncl ?? ''),
      profitPct: String(product.profitPct ?? '0.00')
    });
  }, []);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    try {
      const products = await fetchProducts();
      setAllProducts(products);
      return products;
    } catch (err) {
      Alert.alert('Load error', err.message || 'Could not load products');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const list = await fetchCategories();
      setCategories(list);
      return list;
    } catch (err) {
      Alert.alert('Load error', err.message || 'Could not load categories');
      return [];
    }
  }, []);

  const refreshPriceGroups = useCallback(async () => {
    try {
      const list = await fetchPriceGroups();
      setPriceGroups(list);
      return list;
    } catch (err) {
      Alert.alert('Load error', err.message || 'Could not load price groups');
      return [];
    }
  }, []);

  const refreshPrinters = useCallback(async () => {
    try {
      const list = await fetchPrinters();
      setPrinters(list);
      return list;
    } catch (err) {
      Alert.alert('Load error', err.message || 'Could not load printers');
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isProductLabelsModalVisible) return undefined;
    let cancelled = false;
    const run = async () => {
      setLabelProductsLoading(true);
      setLabelPrintError('');
      try {
        const base = getApiBaseUrl();
        const [catRes, productsRes, formatsRes, labelsSettingsRes] = await Promise.all([
          fetch(`${base}/api/categories`),
          fetch(`${base}/api/products/catalog`),
          fetch(`${base}/api/printer-labels`),
          fetch(`${base}/api/settings/printer-labels`)
        ]);
        const categoriesJson = await catRes.json().catch(() => []);
        const productsJson = await productsRes.json().catch(() => []);
        const formatsJson = await formatsRes.json().catch(() => []);
        const settingsJson = await labelsSettingsRes.json().catch(() => ({}));
        if (cancelled) return;
        const categoriesList = Array.isArray(categoriesJson) ? categoriesJson : [];
        const productsList = Array.isArray(productsJson) ? productsJson : [];
        const formatsList = Array.isArray(formatsJson) ? formatsJson : [];
        setLabelCategories(categoriesList);
        setLabelProducts(productsList);
        setLabelFormats(formatsList);
        setConfiguredLabelPrinterId(String(settingsJson?.printer || '').trim());
        setConfiguredLabelType(normalizeLabelType(settingsJson?.type));
        setLabelCategoryId('');
        setLabelSelectedProductId('');
        setLabelSearch('');
        setLabelPrintCount('1');
        setIncludeProductName(true);
        setIncludePrice(true);
        setIncludeBarcode(true);
        setCategorySortDirection('asc');
        const defaultFormat =
          formatsList.find((f) => f?.standard)?.sizeLabel
          || formatsList.find((f) => f?.standard)?.name
          || formatsList[0]?.sizeLabel
          || formatsList[0]?.name
          || '';
        setLabelFormat(String(defaultFormat || ''));
      } catch (err) {
        if (!cancelled) {
          setLabelCategories([]);
          setLabelProducts([]);
          setLabelFormats([]);
          setLabelFormat('');
          setConfiguredLabelPrinterId('');
          setConfiguredLabelType('production-labels');
          setLabelPrintError(err?.message || 'Could not load product labels data');
        }
      } finally {
        if (!cancelled) setLabelProductsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isProductLabelsModalVisible]);

  const filteredLabelProducts = useMemo(() => {
    const term = String(labelSearch || '').trim().toLowerCase();
    return labelProducts
      .filter((p) => {
        if (labelCategoryId && String(p?.categoryId || '') !== String(labelCategoryId)) return false;
        if (!term) return true;
        return String(p?.name || '').toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const left = String(a?.name || '').toLowerCase();
        const right = String(b?.name || '').toLowerCase();
        if (left === right) return 0;
        return categorySortDirection === 'asc' ? (left < right ? -1 : 1) : (left > right ? -1 : 1);
      });
  }, [labelProducts, labelCategoryId, labelSearch, categorySortDirection]);

  const selectedLabelProduct = useMemo(
    () => labelProducts.find((p) => String(p?.id) === String(labelSelectedProductId)) || null,
    [labelProducts, labelSelectedProductId]
  );

  const selectedLabelFormat = useMemo(
    () => labelFormats.find((f) => String(f?.sizeLabel || f?.name || '') === String(labelFormat || '')) || null,
    [labelFormats, labelFormat]
  );

  const handlePrintLabel = useCallback(async () => {
    if (!selectedLabelProduct || printingLabel) return;
    const printerId = String(configuredLabelPrinterId || '').trim();
    if (!printerId) {
      setLabelPrintError('No label printer configured in External Devices > Printer > Labels.');
      return;
    }
    const copiesRaw = Number.parseInt(String(labelPrintCount || '1'), 10);
    const copies = Number.isInteger(copiesRaw) ? Math.max(1, Math.min(50, copiesRaw)) : 1;
    setPrintingLabel(true);
    setLabelPrintError('');
    try {
      const payload = {
        printerId,
        labelType: normalizeLabelType(configuredLabelType),
        copies,
        productName: selectedLabelProduct?.name || selectedLabelProduct?.keyName || selectedLabelProduct?.productionName || '',
        price: selectedLabelProduct?.price,
        barcode: selectedLabelProduct?.barcode || selectedLabelProduct?.number || selectedLabelProduct?.sku || selectedLabelProduct?.id || '',
        formatLabel: labelFormat,
        formatWidth: selectedLabelFormat?.width,
        formatHeight: selectedLabelFormat?.height,
        marginLeft: selectedLabelFormat?.marginLeft,
        marginRight: selectedLabelFormat?.marginRight,
        marginTop: selectedLabelFormat?.marginTop,
        marginBottom: selectedLabelFormat?.marginBottom,
        includeProductName,
        includePrice,
        includeBarcode
      };
      const res = await fetch(`${getApiBaseUrl()}/api/printers/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to print label.');
      Alert.alert('Printed', 'Label printed successfully.');
    } catch (err) {
      setLabelPrintError(err?.message || 'Failed to print label.');
    } finally {
      setPrintingLabel(false);
    }
  }, [
    selectedLabelProduct,
    printingLabel,
    configuredLabelPrinterId,
    labelPrintCount,
    configuredLabelType,
    labelFormat,
    selectedLabelFormat,
    includeProductName,
    includePrice,
    includeBarcode
  ]);

  const openCreateProductModal = useCallback(
    async (barcode) => {
      const [cats, groups] = await Promise.all([
        categories.length ? Promise.resolve(categories) : refreshCategories(),
        priceGroups.length ? Promise.resolve(priceGroups) : refreshPriceGroups(),
        printers.length ? Promise.resolve(printers) : refreshPrinters()
      ]);
      const list = cats || [];
      const firstCategoryId = String(list?.[0]?.id || '').trim();
      const extraRows = (groups || []).map((g) => ({
        priceGroupId: g.id,
        priceGroupLabel: g.name || g.label || 'Price group',
        otherName: '',
        otherPrinter: '',
        otherPrice: ''
      }));
      setNewProductTab('general');
      setNewProductForm({
        name: '',
        keyName: '',
        productionName: '',
        price: '',
        categoryId: firstCategoryId,
        categoryIdsJson: firstCategoryId ? [firstCategoryId] : [],
        addition: 'Subproducts',
        vatTakeOut: '6',
        vatEatIn: '6',
        barcode: String(barcode || ''),
        printer1: '',
        printer2: '',
        printer3: '',
        openPrice: false,
        weegschaal: false,
        subproductRequires: false,
        leeggoedPrijs: '0.00',
        pagerVerplicht: false,
        boldPrint: false,
        groupingReceipt: true,
        labelExtraInfo: '',
        voorverpakVervaltype: 'Shelf life',
        houdbareDagen: '0',
        bewarenGebruik: '',
        extraPricesRows: extraRows,
        purchaseVat: '6',
        purchasePriceExcl: '',
        purchasePriceIncl: '',
        profitPct: '0.00',
        unit: 'Piece',
        unitContent: '0',
        stock: '0',
        supplier: '',
        supplierCode: '',
        stockNotification: true,
        expirationDate: '',
        declarationExpiryDays: '0',
        notificationSoldOutPieces: ''
      });
      setIsCreateProductModalVisible(true);
    },
    [categories, priceGroups, printers, refreshCategories, refreshPriceGroups, refreshPrinters]
  );

  const onCreateProduct = useCallback(async () => {
    if (creatingProduct) return;
    const name = String(newProductForm.name || '').trim();
    const categoryId = String(newProductForm.categoryId || '').trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter product name.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Missing category', 'Please refresh and select a valid category.');
      return;
    }

    setCreatingProduct(true);
    try {
      const categoryIdsJson = Array.isArray(newProductForm.categoryIdsJson)
        ? newProductForm.categoryIdsJson.filter(Boolean)
        : [categoryId];

      const payload = {
        name,
        keyName: String(newProductForm.keyName || '').trim() || name,
        productionName: String(newProductForm.productionName || '').trim() || name,
        categoryId,
        price: toNumberOrZero(newProductForm.price),
        categoryIdsJson: JSON.stringify(categoryIdsJson),
        addition: String(newProductForm.addition || '').trim() || 'Subproducts',
        barcode: String(newProductForm.barcode || '').trim() || null,
        vatTakeOut: String(newProductForm.vatTakeOut || '').trim() || null,
        vatEatIn: String(newProductForm.vatEatIn || '').trim() || null,
        printer1: String(newProductForm.printer1 || '').trim() || null,
        printer2: String(newProductForm.printer2 || '').trim() || null,
        printer3: String(newProductForm.printer3 || '').trim() || null,
        openPrice: !!newProductForm.openPrice,
        weegschaal: !!newProductForm.weegschaal,
        subproductRequires: !!newProductForm.subproductRequires,
        leeggoedPrijs: String(newProductForm.leeggoedPrijs || '').trim() || null,
        pagerVerplicht: !!newProductForm.pagerVerplicht,
        boldPrint: !!newProductForm.boldPrint,
        groupingReceipt: newProductForm.groupingReceipt !== false,
        labelExtraInfo: String(newProductForm.labelExtraInfo || '').trim() || null,
        voorverpakVervaltype: String(newProductForm.voorverpakVervaltype || '').trim() || null,
        houdbareDagen: String(newProductForm.houdbareDagen || '').trim() || null,
        bewarenGebruik: String(newProductForm.bewarenGebruik || '').trim() || null,
        extraPricesJson: JSON.stringify(
          Array.isArray(newProductForm.extraPricesRows)
            ? newProductForm.extraPricesRows.map((r) => ({
              priceGroupId: r.priceGroupId,
              priceGroupLabel: r.priceGroupLabel,
              otherName: r.otherName || '',
              otherPrinter: r.otherPrinter || '',
              otherPrice: r.otherPrice || ''
            }))
            : []
        ),
        purchaseVat: String(newProductForm.purchaseVat || '').trim() || null,
        purchasePriceExcl: String(newProductForm.purchasePriceExcl || '').trim() || null,
        purchasePriceIncl: String(newProductForm.purchasePriceIncl || '').trim() || null,
        profitPct: String(newProductForm.profitPct || '').trim() || null,
        unit: String(newProductForm.unit || '').trim() || null,
        unitContent: String(newProductForm.unitContent || '').trim() || null,
        stock: String(newProductForm.stock || '').trim() || null,
        supplierCode: String(newProductForm.supplierCode || '').trim() || null,
        stockNotification: !!newProductForm.stockNotification,
        expirationDate: String(newProductForm.expirationDate || '').trim() || null,
        declarationExpiryDays: String(newProductForm.declarationExpiryDays || '').trim() || null,
        notificationSoldOutPieces: String(newProductForm.notificationSoldOutPieces || '').trim() || null,
        inWebshop: false,
        onlineOrderable: true,
        websiteRemark: null,
        websiteOrder: '0',
        shortWebText: null,
        websitePhotoPath: null,
        kioskInfo: null,
        kioskTakeAway: true,
        kioskEatIn: null,
        kioskSubtitle: null,
        kioskMinSubs: 'unlimited',
        kioskMaxSubs: 'unlimited',
        kioskPicturePath: null
      };
      const created = await createProduct(payload);
      const refreshed = await fetchProducts();
      setAllProducts(refreshed);
      setProductInForm(created);
      setBarcodeInput(String(created.barcode || newProductForm.barcode || ''));
      setIsCreateProductModalVisible(false);
      setIsNotFoundModalVisible(false);
      Alert.alert('Created', 'New product created successfully.');
    } catch (err) {
      Alert.alert('Create error', err.message || 'Could not create product');
    } finally {
      setCreatingProduct(false);
    }
  }, [creatingProduct, newProductForm, setProductInForm]);

  useEffect(() => {
    const excl = toNumberOrZero(newProductForm.purchasePriceExcl);
    const vat = toNumberOrZero(newProductForm.purchaseVat);
    if (!String(newProductForm.purchasePriceExcl || '').trim()) return;
    const nextIncl = (excl + (excl * vat / 100)).toFixed(2);
    if (String(newProductForm.purchasePriceIncl || '') !== nextIncl) {
      setNewProductForm((prev) => ({ ...prev, purchasePriceIncl: nextIncl }));
    }
  }, [newProductForm.purchasePriceExcl, newProductForm.purchaseVat, newProductForm.purchasePriceIncl]);

  useEffect(() => {
    const profit = toNumberOrZero(newProductForm.profitPct);
    if (Math.abs(profit) < 0.000001) return;
    const incl = toNumberOrZero(newProductForm.purchasePriceIncl);
    const computed = (incl * (1 + profit / 100)).toFixed(2);
    if (String(newProductForm.price || '') !== computed) {
      setNewProductForm((prev) => ({ ...prev, price: computed }));
    }
  }, [newProductForm.profitPct, newProductForm.purchasePriceIncl, newProductForm.price]);

  const getSelectedPrinterValue = useCallback(() => {
    if (String(printerSelectField || '').startsWith('extra:')) {
      const idx = Number(String(printerSelectField).split(':')[1]);
      if (!Number.isFinite(idx) || idx < 0) return '';
      return String(newProductForm.extraPricesRows?.[idx]?.otherPrinter || '');
    }
    return String(newProductForm[printerSelectField] || '');
  }, [newProductForm, printerSelectField]);

  const setSelectedPrinterValue = useCallback((value) => {
    const nextValue = String(value || '');
    if (String(printerSelectField || '').startsWith('extra:')) {
      const idx = Number(String(printerSelectField).split(':')[1]);
      setNewProductForm((p) => {
        if (!Number.isFinite(idx) || idx < 0 || idx >= p.extraPricesRows.length) return p;
        return {
          ...p,
          extraPricesRows: p.extraPricesRows.map((r, i) => (i === idx ? { ...r, otherPrinter: nextValue } : r))
        };
      });
      return;
    }
    setNewProductForm((p) => ({ ...p, [printerSelectField]: nextValue }));
  }, [printerSelectField]);

  const findByBarcode = useCallback(
    async (rawBarcode) => {
      if (finding) return;
      setFinding(true);
      const barcode = String(rawBarcode || '').trim();
      if (!barcode) {
        Alert.alert('Missing barcode', 'Scan or type a barcode first.');
        setFinding(false);
        return;
      }

      try {
        const products = allProducts.length ? allProducts : await refreshProducts();
        const found = products.find((p) => String(p.barcode || '').trim() === barcode);
        if (!found) {
          setMissingBarcode(barcode);
          setIsNotFoundModalVisible(true);
          return;
        }

        setBarcodeInput(barcode);
        setProductInForm(found);
      } finally {
        setFinding(false);
        setScannerLocked(false);
      }
    },
    [allProducts, finding, refreshProducts, setProductInForm]
  );

  const onBarcodeScanned = useCallback(
    ({ data }) => {
      if (scannerLocked) return;
      setScannerLocked(true);
      findByBarcode(data);
    },
    [findByBarcode, scannerLocked]
  );

  const onSave = useCallback(async () => {
    if (!selectedProduct?.id) {
      Alert.alert('No product selected', 'Scan a barcode first.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        price: toNumberOrZero(form.price),
        purchaseVat: String(form.purchaseVat || '').trim() || null,
        purchasePriceExcl: String(form.purchasePriceExcl || '').trim() || null,
        purchasePriceIncl: String(form.purchasePriceIncl || '').trim() || null,
        profitPct: String(form.profitPct || '').trim() || null
      };

      const updated = await updateProduct(selectedProduct.id, payload);
      setProductInForm(updated);
      setBarcodeInput(String(updated.barcode || ''));
      const refreshed = await fetchProducts();
      setAllProducts(refreshed);
      Alert.alert('Saved', 'Product fields updated successfully.');
    } catch (err) {
      Alert.alert('Save error', err.message || 'Could not update product');
    } finally {
      setSaving(false);
    }
  }, [form, selectedProduct, setProductInForm]);

  useEffect(() => {
    const excl = toNumberOrZero(form.purchasePriceExcl);
    const vat = toNumberOrZero(form.purchaseVat);
    if (!String(form.purchasePriceExcl || '').trim()) return;
    const nextIncl = (excl + (excl * vat / 100)).toFixed(2);
    if (String(form.purchasePriceIncl || '') !== nextIncl) {
      setForm((prev) => ({ ...prev, purchasePriceIncl: nextIncl }));
    }
  }, [form.purchasePriceExcl, form.purchaseVat, form.purchasePriceIncl]);

  useEffect(() => {
    const profit = toNumberOrZero(form.profitPct);
    if (Math.abs(profit) < 0.000001) return;
    const incl = toNumberOrZero(form.purchasePriceIncl);
    const computed = (incl * (1 + profit / 100)).toFixed(2);
    if (String(form.price || '') !== computed) {
      setForm((prev) => ({ ...prev, price: computed }));
    }
  }, [form.profitPct, form.purchasePriceIncl, form.price]);

  const cameraPermissionHint = useMemo(() => {
    if (!permission) return 'Checking camera permission...';
    if (canUseCamera) return 'Camera ready for barcode scanning.';
    return 'Camera access is required for barcode scanner.';
  }, [permission, canUseCamera]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const NavigationBar = await import('expo-navigation-bar');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setVisibilityAsync('hidden');
      } catch {
        // Module might be unavailable in an old installed build.
      }
    })();
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTopRef.current = e?.endCoordinates?.screenY || Dimensions.get('window').height;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = Dimensions.get('window').height;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const showCenterErrorToast = useCallback((message) => {
    setToastMessage(String(message || 'Connection failed'));
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  const onConfirmBackendUrl = useCallback(async () => {
    if (settingsSaving) return;
    const normalized = String(backendUrlInput || '').trim().replace(/\/+$/, '');
    if (!normalized) {
      Alert.alert('Missing URL', 'Enter backend URL like http://192.168.1.100:4000');
      return;
    }
    try {
      const parsed = new URL(normalized);
      if (!parsed.protocol.startsWith('http')) {
        Alert.alert('Invalid URL', 'Use http://IP:PORT (example: http://192.168.1.100:4000)');
        return;
      }
    } catch {
      Alert.alert('Invalid URL', 'Use full backend URL like http://192.168.1.100:4000');
      return;
    }

    setSettingsSaving(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      let res;
      try {
        res = await fetch(`${normalized}/api/health`, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res?.ok) {
        throw new Error(`Server responded with ${res?.status || 'unknown status'}`);
      }
      setApiBaseUrl(normalized);
      const products = await fetchProducts();
      setAllProducts(products);
      setIsSettingsModalVisible(false);
    } catch (err) {
      showCenterErrorToast(err?.message || 'Could not connect to backend');
    } finally {
      setSettingsSaving(false);
    }
  }, [backendUrlInput, settingsSaving, showCenterErrorToast]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      <View style={styles.headerBar}>
        {/* <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Retail Mobile Scanner</Text>
          <Text style={styles.subtitle}>Scan barcode and edit product price.</Text>
        </View> */}
        {/* <Pressable style={styles.headerSettingsButton} onPress={() => setIsSettingsModalVisible(true)}>
          <Image source={require('./assets/setting.png')} style={styles.headerSettingsIcon} />
        </Pressable> */}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollYRef.current = e?.nativeEvent?.contentOffset?.y || 0;
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.row}>
          <Pressable style={styles.secondaryButton} onPress={() => setIsProductLabelsModalVisible(true)}>
            <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>Product Labels</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setIsSettingsModalVisible(true)}>
            <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>
              Setting
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Barcode</Text>
          <View style={styles.barcodeInputRow}>
            <Pressable
              style={styles.barcodeClearButton}
              onPress={() => setBarcodeInput('')}
              accessibilityLabel="Clear barcode"
            >
              <Text style={styles.barcodeClearIcon}>🗑</Text>
            </Pressable>
            <TextInput
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              onFocus={() => setBarcodeInput('')}
              placeholder="Scan or type barcode"
              style={[styles.input, styles.barcodeInputFlex]}
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
            />
          </View>

          <View style={styles.row}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => findByBarcode(barcodeInput)}
              disabled={finding}
            >
              {finding ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Find Product</Text>
              )}
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={refreshProducts} disabled={loading}>
              <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>
                {loading ? 'Loading...' : `Refresh (${allProducts.length})`}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>{cameraPermissionHint}</Text>
          {scannerOpen && canUseCamera && (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                onBarcodeScanned={onBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Fields</Text>
          {selectedProduct ? (
            <>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.infoLabel}>Product name :</Text>
                <Text style={styles.productFieldInlineValue}>{selectedProduct.name || '-'}</Text>
              </View>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.infoLabel}>Product price :</Text>
                <TextInput
                  ref={registerInputRef('productPrice')}
                  value={form.price}
                  editable={Math.abs(toNumberOrZero(form.profitPct)) < 0.000001}
                  onChangeText={(v) => setForm((p) => ({ ...p, price: v }))}
                  onFocus={() => scrollFocusedInputIntoView('productPrice')}
                  placeholder="Enter product price"
                  style={[
                    styles.input,
                    styles.productFieldInlineControl,
                    Math.abs(toNumberOrZero(form.profitPct)) >= 0.000001 ? styles.inputDisabled : null
                  ]}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.infoLabel}>Purchase VAT</Text>
                <Pressable style={[styles.dropdownField, styles.productFieldInlineControl]} onPress={() => setIsProductPurchaseVatSelectVisible(true)}>
                  <Text style={styles.dropdownFieldText}>{`${form.purchaseVat || '6'}%`}</Text>
                  <Text style={styles.dropdownFieldArrow}>▼</Text>
                </Pressable>
              </View>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.infoLabel}>Purchase price excl</Text>
                <TextInput
                  ref={registerInputRef('purchasePriceExcl')}
                  value={form.purchasePriceExcl}
                  onChangeText={(v) => setForm((p) => ({ ...p, purchasePriceExcl: v }))}
                  onFocus={() => scrollFocusedInputIntoView('purchasePriceExcl')}
                  placeholder="0.00"
                  style={[styles.input, styles.productFieldInlineControl]}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.infoLabel}>Purchase price incl</Text>
                <TextInput
                  ref={registerInputRef('purchasePriceIncl')}
                  value={form.purchasePriceIncl}
                  onChangeText={(v) => setForm((p) => ({ ...p, purchasePriceIncl: v }))}
                  onFocus={() => scrollFocusedInputIntoView('purchasePriceIncl')}
                  placeholder="0.00"
                  style={[styles.input, styles.productFieldInlineControl]}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.infoLabel}>Profit percentage</Text>
                <TextInput
                  ref={registerInputRef('profitPct')}
                  value={form.profitPct}
                  onChangeText={(v) => setForm((p) => ({ ...p, profitPct: v }))}
                  onFocus={() => scrollFocusedInputIntoView('profitPct')}
                  placeholder="0.00"
                  style={[styles.input, styles.productFieldInlineControl]}
                  keyboardType="decimal-pad"
                />
              </View>
              <Pressable style={styles.primaryButton} onPress={onSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Save Product</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Text style={styles.hint}>No product selected. Scan or search a barcode first.</Text>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isProductLabelsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProductLabelsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.labelModalCard}>
            <Text style={styles.sectionTitle}>Product Labels</Text>
            <View style={styles.row}>
              <View style={styles.labelCategoryFieldWrap}>
                <Pressable style={styles.dropdownField} onPress={() => setIsLabelCategorySelectVisible(true)}>
                  <Text style={styles.dropdownFieldText}>
                    {labelCategoryId
                      ? (labelCategories.find((cat) => String(cat?.id || '') === String(labelCategoryId))?.name || 'All Categories')
                      : 'All Categories'}
                  </Text>
                  <Text style={styles.dropdownFieldArrow}>▼</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.sortButton}
                onPress={() => setCategorySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                <Text style={styles.sortButtonText}>{categorySortDirection === 'asc' ? 'A-Z' : 'Z-A'}</Text>
              </Pressable>
              <View style={styles.labelSearchFieldWrap}>
                <TextInput value={labelSearch} onChangeText={setLabelSearch} placeholder="Search" style={styles.input} />
              </View>
            </View>
            <View style={styles.labelProductsPanel}>
              {labelProductsLoading ? (
                <Text style={styles.hint}>Loading...</Text>
              ) : filteredLabelProducts.length === 0 ? (
                <Text style={styles.hint}>No products found</Text>
              ) : (
                <ScrollView>
                  {filteredLabelProducts.map((product) => {
                    const active = String(labelSelectedProductId) === String(product?.id);
                    return (
                      <Pressable
                        key={`lblprod-${product?.id}`}
                        style={[styles.labelProductOption, active ? styles.labelProductOptionActive : null]}
                        onPress={() => setLabelSelectedProductId(String(product?.id || ''))}
                      >
                        <Text style={[styles.labelProductOptionText, active ? styles.labelProductOptionTextActive : null]}>{String(product?.name || '-')}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.advancedCheckboxGrid}>
              <View style={styles.advancedCheckboxCell}>
                <CheckboxRow label="Product name" value={includeProductName} onValueChange={setIncludeProductName} />
              </View>
              <View style={styles.advancedCheckboxCell}>
                <CheckboxRow label="Price" value={includePrice} onValueChange={setIncludePrice} />
              </View>
              <View style={styles.advancedCheckboxCell}>
                <CheckboxRow label="Barcode" value={includeBarcode} onValueChange={setIncludeBarcode} />
              </View>
              <View style={styles.advancedCheckboxCell}>
                <View style={styles.inlineFieldRow}>
                  <Text style={styles.infoLabel}>Number of prints</Text>
                  <TextInput
                    value={labelPrintCount}
                    onChangeText={(v) => setLabelPrintCount(String(v).replace(/[^\d]/g, '').slice(0, 3))}
                    style={[styles.input, styles.printCountInput]}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
            <Text style={styles.infoLabel}>Standard label</Text>
            <Pressable style={styles.dropdownField} onPress={() => setIsLabelFormatSelectVisible(true)}>
              <Text style={styles.dropdownFieldText}>{labelFormat || 'Select label format'}</Text>
              <Text style={styles.dropdownFieldArrow}>▼</Text>
            </Pressable>
            {labelPrintError ? <Text style={styles.errorText}>{labelPrintError}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsProductLabelsModalVisible(false)}>
                <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, !selectedLabelProduct || printingLabel ? styles.primaryButtonDisabled : null]}
                onPress={handlePrintLabel}
                disabled={!selectedLabelProduct || printingLabel}
              >
                {printingLabel ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Print</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLabelCategorySelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLabelCategorySelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select category</Text>
            <Pressable
              style={[styles.selectOption, !labelCategoryId ? styles.selectOptionActive : null]}
              onPress={() => {
                setLabelCategoryId('');
                setIsLabelCategorySelectVisible(false);
              }}
            >
              <Text style={[styles.selectOptionText, !labelCategoryId ? styles.selectOptionTextActive : null]}>All Categories</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 300 }}>
              {labelCategories.map((cat) => {
                const value = String(cat?.id || '');
                const active = String(labelCategoryId) === value;
                return (
                  <Pressable
                    key={`label-category-${value}`}
                    style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                    onPress={() => {
                      setLabelCategoryId(value);
                      setIsLabelCategorySelectVisible(false);
                    }}
                  >
                    <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{String(cat?.name || '-')}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.selectCloseButton} onPress={() => setIsLabelCategorySelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLabelFormatSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLabelFormatSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select label format</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {labelFormats.map((format, idx) => {
                const value = String(format?.sizeLabel || format?.name || '').trim();
                if (!value) return null;
                const active = String(labelFormat || '') === value;
                return (
                  <Pressable
                    key={`lbl-format-${idx}-${value}`}
                    style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                    onPress={() => {
                      setLabelFormat(value);
                      setIsLabelFormatSelectVisible(false);
                    }}
                  >
                    <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{value}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.selectCloseButton} onPress={() => setIsLabelFormatSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isSettingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Backend Settings</Text>
            <Text style={styles.hint}>Set backend IP and port for API requests.</Text>
            <Text style={styles.infoLabel}>Backend URL</Text>
            <TextInput
              value={backendUrlInput}
              onChangeText={setBackendUrlInput}
              placeholder="http://192.168.1.100:4000"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.row}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setIsSettingsModalVisible(false)}
                disabled={settingsSaving}
              >
                <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.connectButton} onPress={onConfirmBackendUrl} disabled={settingsSaving}>
                {settingsSaving ? (
                  <View style={styles.connectLoadingRow}>
                    <ActivityIndicator color="#ffffff" />
                    <Text style={styles.connectButtonText}>Connecting...</Text>
                  </View>
                ) : (
                  <Text style={styles.connectButtonText}>Connect</Text>
                )}
              </Pressable>
            </View>
          </View>

          {toastMessage ? (
            <View style={styles.modalErrorToastWrap} pointerEvents="none">
              <View style={styles.errorToast}>
                <View style={styles.errorToastRow}>
                  <View style={styles.errorToastBadge}>
                    <Text style={styles.errorToastBadgeText}>!</Text>
                  </View>
                  <Text style={styles.errorToastText}>{toastMessage}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {toastMessage && !isSettingsModalVisible ? (
        <View style={styles.errorToastWrap} pointerEvents="none">
          <View style={styles.errorToast}>
            <View style={styles.errorToastRow}>
              <View style={styles.errorToastBadge}>
                <Text style={styles.errorToastBadgeText}>!</Text>
              </View>
              <Text style={styles.errorToastText}>{toastMessage}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <Modal
        visible={isNotFoundModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNotFoundModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.infoLabel}>No product found for barcode: {missingBarcode}</Text>
            <Text style={styles.infoLabel}>Would you like to add a new product?</Text>
            <View style={styles.row}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setIsNotFoundModalVisible(false)}
              >
                <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>No</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  setBarcodeInput(missingBarcode);
                  setIsNotFoundModalVisible(false);
                  openCreateProductModal(missingBarcode);
                }}
              >
                <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Yes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCreateProductModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateProductModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.createModalHeader}>
              <Text style={[styles.sectionTitle, styles.createModalTitleFlex]}>New product</Text>
              <Pressable
                style={styles.modalCloseX}
                onPress={() => setIsCreateProductModalVisible(false)}
                accessibilityLabel="Close"
              >
                <Text style={styles.modalCloseXText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Same structure as retail frontend product modal.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tabRow}>
                {PRODUCT_TABS.map((tab) => {
                  const active = newProductTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      style={[styles.tabButton, active ? styles.tabButtonActive : null]}
                      onPress={() => setNewProductTab(tab.id)}
                    >
                      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <ScrollView style={styles.createModalBody} contentContainerStyle={{ gap: 10 }}>
              {newProductTab === 'general' ? (
                <>
                  <Text style={styles.infoLabel}>Name</Text>
                  <TextInput
                    value={newProductForm.name}
                    onChangeText={(v) =>
                      setNewProductForm((p) => ({
                        ...p,
                        name: v,
                        keyName: v,
                        productionName: v
                      }))
                    }
                    placeholder="Product name"
                    style={styles.input}
                  />
                  <Text style={styles.infoLabel}>Price</Text>
                  <TextInput
                    value={newProductForm.price}
                    editable={Math.abs(toNumberOrZero(newProductForm.profitPct)) < 0.000001}
                    onChangeText={(v) => setNewProductForm((p) => ({ ...p, price: v }))}
                    placeholder="0.00"
                    style={[
                      styles.input,
                      Math.abs(toNumberOrZero(newProductForm.profitPct)) >= 0.000001 ? styles.inputDisabled : null
                    ]}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.infoLabel}>VAT take out</Text>
                  <View style={styles.categoryChipsWrap}>
                    {VAT_OPTIONS.map((v) => (
                      <Pressable key={`vatto-${v}`} style={[styles.categoryChip, newProductForm.vatTakeOut === v ? styles.categoryChipActive : null]} onPress={() => setNewProductForm((p) => ({ ...p, vatTakeOut: v }))}>
                        <Text style={[styles.categoryChipText, newProductForm.vatTakeOut === v ? styles.categoryChipTextActive : null]}>{v}%</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.infoLabel}>Category</Text>
                  <Pressable style={styles.dropdownField} onPress={() => setIsCategorySelectVisible(true)}>
                    <Text style={styles.dropdownFieldText}>
                      {categories.find((c) => String(c.id) === String(newProductForm.categoryId))?.name || 'Select category'}
                    </Text>
                    <Text style={styles.dropdownFieldArrow}>▼</Text>
                  </Pressable>
                  <Text style={styles.infoLabel}>Addition</Text>
                  <Pressable style={styles.dropdownField} onPress={() => setIsAdditionSelectVisible(true)}>
                    <Text style={styles.dropdownFieldText}>{newProductForm.addition || 'Select addition'}</Text>
                    <Text style={styles.dropdownFieldArrow}>▼</Text>
                  </Pressable>
                  <Text style={styles.infoLabel}>Barcode</Text>
                  <TextInput value={newProductForm.barcode} onChangeText={(v) => setNewProductForm((p) => ({ ...p, barcode: v }))} placeholder="Barcode" style={styles.input} autoCapitalize="none" autoCorrect={false} />
                </>
              ) : null}

              {newProductTab === 'advanced' ? (
                <>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <CheckboxRow label="Open price" value={newProductForm.openPrice} onValueChange={(v) => setNewProductForm((p) => ({ ...p, openPrice: v }))} />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <CheckboxRow label="Libra (scale)" value={newProductForm.weegschaal} onValueChange={(v) => setNewProductForm((p) => ({ ...p, weegschaal: v }))} />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <CheckboxRow label="Subproduct requires" value={newProductForm.subproductRequires} onValueChange={(v) => setNewProductForm((p) => ({ ...p, subproductRequires: v }))} />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <CheckboxRow label="Pager required" value={newProductForm.pagerVerplicht} onValueChange={(v) => setNewProductForm((p) => ({ ...p, pagerVerplicht: v }))} />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <CheckboxRow label="Bold print" value={newProductForm.boldPrint} onValueChange={(v) => setNewProductForm((p) => ({ ...p, boldPrint: v }))} />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <CheckboxRow label="Grouping receipt" value={newProductForm.groupingReceipt} onValueChange={(v) => setNewProductForm((p) => ({ ...p, groupingReceipt: v }))} />
                    </View>
                  </View>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Empty price</Text>
                      <TextInput value={newProductForm.leeggoedPrijs} onChangeText={(v) => setNewProductForm((p) => ({ ...p, leeggoedPrijs: v }))} style={styles.input} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Label extra info</Text>
                      <TextInput value={newProductForm.labelExtraInfo} onChangeText={(v) => setNewProductForm((p) => ({ ...p, labelExtraInfo: v }))} style={styles.input} />
                    </View>
                  </View>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Pre-pack expiry type</Text>
                      <Pressable style={styles.dropdownField} onPress={() => setIsPrepackExpiryTypeSelectVisible(true)}>
                        <Text style={styles.dropdownFieldText}>{newProductForm.voorverpakVervaltype || 'Select expiry type'}</Text>
                        <Text style={styles.dropdownFieldArrow}>▼</Text>
                      </Pressable>
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Shelf life</Text>
                      <TextInput value={newProductForm.houdbareDagen} onChangeText={(v) => setNewProductForm((p) => ({ ...p, houdbareDagen: v }))} style={styles.input} keyboardType="numeric" />
                    </View>
                  </View>
                  <Text style={styles.infoLabel}>Storage, use</Text><TextInput value={newProductForm.bewarenGebruik} onChangeText={(v) => setNewProductForm((p) => ({ ...p, bewarenGebruik: v }))} style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]} multiline />
                </>
              ) : null}

              {newProductTab === 'extra_prices' ? (
                <>
                  <Text style={styles.infoLabel}>Price groups</Text>
                  {newProductForm.extraPricesRows.map((row, idx) => (
                    <View key={`${row.priceGroupId}-${idx}`} style={styles.extraRow}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.extraRowLine}>
                          <Text style={styles.extraGroupName} numberOfLines={1}>
                            {row.priceGroupLabel}
                          </Text>
                          <TextInput value={row.otherName} onChangeText={(v) => setNewProductForm((p) => ({ ...p, extraPricesRows: p.extraPricesRows.map((r, i) => (i === idx ? { ...r, otherName: v } : r)) }))} placeholder="Other name" style={[styles.input1, styles.extraInlineInputName]} />
                          <Pressable
                            style={[styles.dropdownField, styles.extraInlineInputPrinter]}
                            onPress={() => {
                              setPrinterSelectField(`extra:${idx}`);
                              setIsPrinterSelectVisible(true);
                            }}
                          >
                            <Text style={styles.dropdownFieldText1}>
                              {printers.find((p) => String(p.id) === String(row.otherPrinter || ''))?.name || 'Other printer'}
                            </Text>
                            <Text style={styles.dropdownFieldArrow}>▼</Text>
                          </Pressable>
                          <TextInput value={row.otherPrice} onChangeText={(v) => setNewProductForm((p) => ({ ...p, extraPricesRows: p.extraPricesRows.map((r, i) => (i === idx ? { ...r, otherPrice: v } : r)) }))} placeholder="Other price" style={[styles.input1, styles.extraInlineInputPrice]} keyboardType="decimal-pad" />
                        </View>
                      </ScrollView>
                    </View>
                  ))}
                </>
              ) : null}

              {newProductTab === 'purchase_stock' ? (
                <>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Purchase VAT</Text>
                      <Pressable style={styles.dropdownField} onPress={() => setIsPurchaseVatSelectVisible(true)}>
                        <Text style={styles.dropdownFieldText}>{`${newProductForm.purchaseVat || '6'}%`}</Text>
                        <Text style={styles.dropdownFieldArrow}>▼</Text>
                      </Pressable>
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Purchase price excl</Text>
                      <TextInput value={newProductForm.purchasePriceExcl} onChangeText={(v) => setNewProductForm((p) => ({ ...p, purchasePriceExcl: v }))} style={styles.input} keyboardType="decimal-pad" />
                    </View>
                  </View>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Purchase price incl</Text>
                      <TextInput value={newProductForm.purchasePriceIncl} onChangeText={(v) => setNewProductForm((p) => ({ ...p, purchasePriceIncl: v }))} style={styles.input} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Profit percentage</Text>
                      <TextInput value={newProductForm.profitPct} onChangeText={(v) => setNewProductForm((p) => ({ ...p, profitPct: v }))} style={styles.input} keyboardType="decimal-pad" />
                    </View>
                  </View>
                  <Text style={styles.infoLabel}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.categoryChipsWrap}>{PURCHASE_UNITS.map((u) => <Pressable key={u} style={[styles.categoryChip, newProductForm.unit === u ? styles.categoryChipActive : null]} onPress={() => setNewProductForm((p) => ({ ...p, unit: u }))}><Text style={[styles.categoryChipText, newProductForm.unit === u ? styles.categoryChipTextActive : null]}>{u}</Text></Pressable>)}</View></ScrollView>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Unit content</Text>
                      <TextInput value={newProductForm.unitContent} onChangeText={(v) => setNewProductForm((p) => ({ ...p, unitContent: v }))} style={styles.input} />
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Stock</Text>
                      <TextInput value={newProductForm.stock} onChangeText={(v) => setNewProductForm((p) => ({ ...p, stock: v }))} style={styles.input} />
                    </View>
                  </View>
                  <View style={styles.advancedCheckboxGrid}>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Supplier</Text>
                      <Pressable style={styles.dropdownField} onPress={() => setIsSupplierSelectVisible(true)}>
                        <Text style={styles.dropdownFieldText}>{newProductForm.supplier || 'Select supplier'}</Text>
                        <Text style={styles.dropdownFieldArrow}>▼</Text>
                      </Pressable>
                    </View>
                    <View style={styles.advancedCheckboxCell}>
                      <Text style={styles.infoLabel}>Supplier code</Text>
                      <TextInput value={newProductForm.supplierCode} onChangeText={(v) => setNewProductForm((p) => ({ ...p, supplierCode: v }))} style={styles.input} />
                    </View>
                  </View>
                  <CheckboxRow label="Stock notification" value={newProductForm.stockNotification} onValueChange={(v) => setNewProductForm((p) => ({ ...p, stockNotification: v }))} />
                  <Text style={styles.infoLabel}>Expiration date</Text><TextInput value={newProductForm.expirationDate} onChangeText={(v) => setNewProductForm((p) => ({ ...p, expirationDate: v }))} style={styles.input} />
                  <Text style={styles.infoLabel}>Declaration of expiry (days)</Text><TextInput value={newProductForm.declarationExpiryDays} onChangeText={(v) => setNewProductForm((p) => ({ ...p, declarationExpiryDays: v }))} style={styles.input} keyboardType="numeric" />
                  <Text style={styles.infoLabel}>Notification sold out (pieces)</Text><TextInput value={newProductForm.notificationSoldOutPieces} onChangeText={(v) => setNewProductForm((p) => ({ ...p, notificationSoldOutPieces: v }))} style={styles.input} keyboardType="numeric" />
                </>
              ) : null}
            </ScrollView>

            <View style={styles.row}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setIsCreateProductModalVisible(false)}
                disabled={creatingProduct}
              >
                <Text style={[styles.secondaryButtonText, { fontSize: 18 }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={onCreateProduct} disabled={creatingProduct}>
                {creatingProduct ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isProductPurchaseVatSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProductPurchaseVatSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select purchase VAT</Text>
            {VAT_OPTIONS.map((opt) => {
              const active = String(form.purchaseVat) === String(opt);
              return (
                <Pressable
                  key={`product-purchase-vat-${opt}`}
                  style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                  onPress={() => {
                    setForm((p) => ({ ...p, purchaseVat: String(opt) }));
                    setIsProductPurchaseVatSelectVisible(false);
                  }}
                >
                  <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{opt}%</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.selectCloseButton} onPress={() => setIsProductPurchaseVatSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCategorySelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategorySelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select category</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {categories.map((c) => {
                const active = String(c.id) === String(newProductForm.categoryId);
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                    onPress={() => {
                      setNewProductForm((p) => ({ ...p, categoryId: String(c.id), categoryIdsJson: [String(c.id)] }));
                      setIsCategorySelectVisible(false);
                    }}
                  >
                    <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.selectCloseButton} onPress={() => setIsCategorySelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAdditionSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAdditionSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select addition</Text>
            {ADDITION_OPTIONS.map((opt) => {
              const active = newProductForm.addition === opt;
              return (
                <Pressable
                  key={opt}
                  style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                  onPress={() => {
                    setNewProductForm((p) => ({ ...p, addition: opt }));
                    setIsAdditionSelectVisible(false);
                  }}
                >
                  <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{opt}</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.selectCloseButton} onPress={() => setIsAdditionSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isSupplierSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSupplierSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select supplier</Text>
            {SUPPLIER_OPTIONS.map((opt) => {
              const active = newProductForm.supplier === opt;
              return (
                <Pressable
                  key={opt}
                  style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                  onPress={() => {
                    setNewProductForm((p) => ({ ...p, supplier: opt === 'Disabled' ? '' : opt }));
                    setIsSupplierSelectVisible(false);
                  }}
                >
                  <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{opt}</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.selectCloseButton} onPress={() => setIsSupplierSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPrepackExpiryTypeSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPrepackExpiryTypeSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select pre-pack expiry type</Text>
            {PREPACK_EXPIRY_TYPE_OPTIONS.map((opt) => {
              const active = String(newProductForm.voorverpakVervaltype || '') === String(opt);
              return (
                <Pressable
                  key={`prepack-expiry-${opt}`}
                  style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                  onPress={() => {
                    setNewProductForm((p) => ({ ...p, voorverpakVervaltype: String(opt) }));
                    setIsPrepackExpiryTypeSelectVisible(false);
                  }}
                >
                  <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{opt}</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.selectCloseButton} onPress={() => setIsPrepackExpiryTypeSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPurchaseVatSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPurchaseVatSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select purchase VAT</Text>
            {VAT_OPTIONS.map((opt) => {
              const active = String(newProductForm.purchaseVat) === String(opt);
              return (
                <Pressable
                  key={`purchase-vat-${opt}`}
                  style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                  onPress={() => {
                    setNewProductForm((p) => ({ ...p, purchaseVat: String(opt) }));
                    setIsPurchaseVatSelectVisible(false);
                  }}
                >
                  <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>{opt}%</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.selectCloseButton} onPress={() => setIsPurchaseVatSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPrinterSelectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPrinterSelectVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.selectModalCard}>
            <Text style={styles.sectionTitle}>Select printer</Text>
            <Pressable
              style={styles.selectOption}
              onPress={() => {
                setSelectedPrinterValue('');
                setIsPrinterSelectVisible(false);
              }}
            >
              <Text style={styles.selectOptionText}>Disabled</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 300 }}>
              {printers.map((printer) => {
                const active = String(printer.id) === getSelectedPrinterValue();
                return (
                  <Pressable
                    key={printer.id}
                    style={[styles.selectOption, active ? styles.selectOptionActive : null]}
                    onPress={() => {
                      setSelectedPrinterValue(String(printer.id));
                      setIsPrinterSelectVisible(false);
                    }}
                  >
                    <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>
                      {printer.name || printer.id}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.selectCloseButton} onPress={() => setIsPrinterSelectVisible(false)}>
              <Text style={styles.selectCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    overflowY: 'hidden',

  },
  container: {
    padding: 16,
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    position: 'relative'
  },
  headerTextWrap: {
    paddingRight: 76
  },
  headerSettingsButton: {
    position: 'absolute',
    top: 25,
    right: 16,
    borderRadius: 14,
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerSettingsIcon: {
    width: 56,
    height: 56
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937'
  },
  subtitle: {
    fontSize: 20,
    color: '#4b5563',
    marginBottom: 6
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827'
  },
  infoLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827'
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 0
  },
  productNameGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  productPriceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 30,
    flexShrink: 0
  },
  infoValueShrink: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 17,
    color: '#111827'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    fontSize: 18
  },
  inputDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#6b7280'
  },
  input1: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    fontSize: 13
  },
  priceInput: {
    width: 110,
    minWidth: 80,
    flexShrink: 0
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  barcodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  barcodeInputFlex: {
    flex: 1
  },
  barcodeClearButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  barcodeClearIcon: {
    fontSize: 20
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca3af'
  },
  inlineFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  printCountInput: {
    width: 90,
    minWidth: 90
  },
  productFieldInlineControl: {
    width: '58%',
    minWidth: 160
  },
  productFieldInlineValue: {
    width: '58%',
    minWidth: 160,
    fontSize: 18,
    color: '#111827'
  },
  connectButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18
  },
  connectLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600'
  },
  hint: {
    color: '#6b7280',
    fontSize: 15
  },
  cameraWrap: {
    borderRadius: 10,
    overflow: 'hidden'
  },
  camera: {
    height: 140,
    width: '100%'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10
  },
  labelModalCard: {
    width: '100%',
    maxWidth: 980,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10
  },
  sortButton: {
    minWidth: 64,
    height: 46,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    alignSelf: 'flex-end'
  },
  sortButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  labelCategoryFieldWrap: {
    flex: 1.1
  },
  labelSearchFieldWrap: {
    flex: 1.4
  },
  labelProductsPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 6,
    minHeight: 220,
    maxHeight: 260
  },
  labelProductOption: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  labelProductOptionActive: {
    backgroundColor: '#16a34a'
  },
  labelProductOptionText: {
    color: '#111827',
    fontSize: 16
  },
  labelProductOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600'
  },
  createModalBody: {
    maxHeight: 620,
    minHeight: 620
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  createModalTitleFlex: {
    flex: 1,
    minWidth: 0
  },
  modalCloseX: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6'
  },
  modalCloseXText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827'
  },
  generalTopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  generalTopGridItem: {
    width: '48%',
    minWidth: 140
  },
  dropdownField: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownFieldText: {
    color: '#111827',
    fontSize: 16,
    flex: 1,
    marginRight: 8
  },
  dropdownFieldText1: {
    color: '#111827',
    fontSize: 13,
    flex: 1,
    marginRight: 8
  },
  dropdownFieldArrow: {
    color: '#6b7280',
    fontSize: 14
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2
  },
  tabButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  tabButtonActive: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d'
  },
  tabButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600'
  },
  tabButtonTextActive: {
    color: '#ffffff'
  },
  checkboxRow: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  checkboxFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 12
  },
  checkboxFieldLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 6
  },
  advancedCheckboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%'
  },
  advancedCheckboxCell: {
    width: '48%',
    minWidth: 0,
    flexShrink: 1
  },
  checkboxBox: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#6b7280',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxBoxChecked: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d'
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18
  },
  extraRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    gap: 8
  },
  extraRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  extraGroupName: {
    width: 90,
    fontSize: 15,
    color: '#4b5563',
    fontWeight: '600'
  },
  extraInlineInputName: {
    width: 140,
    minWidth: 140
  },
  extraInlineInputPrinter: {
    width: 140,
    minWidth: 140
  },
  extraInlineInputPrice: {
    width: 110,
    minWidth: 110
  },
  selectModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10
  },
  selectOption: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  selectOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff'
  },
  selectOptionText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600'
  },
  selectOptionTextActive: {
    color: '#1d4ed8'
  },
  selectCloseButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectCloseButtonText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16
  },
  modalErrorToastWrap: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    alignItems: 'center'
  },
  errorToastWrap: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    alignItems: 'center'
  },
  errorToast: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  errorToastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  errorToastBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorToastBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  errorToastText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'left'
  },
  categoryChipsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  categoryChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8'
  },
  categoryChipText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600'
  },
  categoryChipTextActive: {
    color: '#ffffff'
  }
});
