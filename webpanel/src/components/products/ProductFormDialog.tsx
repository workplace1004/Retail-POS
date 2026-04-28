import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";

export type CategoryOption = { id: string; name: string };

type PriceGroupRow = { id: string; name: string };
type SupplierRow = { id: string; companyName: string };
type ExtraPriceRow = {
  priceGroupId: string;
  priceGroupLabel: string;
  otherName: string;
  otherPrinter: string;
  otherPrice: string;
};

const VAT_OPTIONS = [
  { value: "", label: "—" },
  { value: "0", label: "0%" },
  { value: "6", label: "6%" },
  { value: "9", label: "9%" },
  { value: "12", label: "12%" },
  { value: "21", label: "21%" },
];

const VERVALTYPE_OPTIONS = [
  { value: "Shelf life", label: "Shelf life" },
  { value: "Expiration date", label: "Expiration date" },
];

const PURCHASE_UNIT_OPTIONS = [
  { value: "Piece", label: "Piece" },
  { value: "Kg", label: "Kg" },
  { value: "Liter", label: "Liter" },
  { value: "Meter", label: "Meter" },
];

function normalizeVatTakeOut(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .trim()
    .replace(/%/g, "");
  if (VAT_OPTIONS.some((o) => o.value === s)) return s;
  return "";
}

function retailStyleCategoryRows(
  categoryIds: string[],
  categories: CategoryOption[],
  tabsUnlocked: boolean,
): number {
  if (!tabsUnlocked || categories.length === 0) return 1;
  const ids = [...categoryIds];
  let numVisible = 1;
  for (let i = 0; i < categories.length; i++) {
    const prevId = i > 0 ? ids[i - 1] : "";
    if (i > 0 && !prevId) break;
    const selectedIds = ids.slice(0, i + 1);
    const optionsForNext = categories.filter((c) => !selectedIds.includes(c.id));
    if (!ids[i]) {
      numVisible = i + 1;
      break;
    }
    if (optionsForNext.length < 1) {
      numVisible = i + 1;
      break;
    }
    numVisible = i + 2;
  }
  while (ids.length < numVisible) ids.push("");
  return numVisible;
}

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create new product */
  productId: string | null;
  categories: CategoryOption[];
  defaultCategoryId: string;
  onSaved: () => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  productId,
  categories,
  defaultCategoryId,
  onSaved,
}: ProductFormDialogProps) {
  const { t, lang } = useLanguage();
  /** Parent often passes inline `onOpenChange`; must not retrigger the edit load effect on every parent render. */
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const [tab, setTab] = useState("general");

  useEffect(() => {
    if (!open) setTab("general");
  }, [open]);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priceGroups, setPriceGroups] = useState<PriceGroupRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  const [productName, setProductName] = useState("");
  const [productKeyName, setProductKeyName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productVatTakeOut, setProductVatTakeOut] = useState("");
  const [productDisplayNumber, setProductDisplayNumber] = useState<number | null>(null);
  const [productCategoryIds, setProductCategoryIds] = useState<string[]>([""]);
  const [productAddition, setProductAddition] = useState("Subproducts");
  const [productBarcode, setProductBarcode] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ name: false, keyName: false, vatTakeOut: false });
  /** Next `number` for new products (from API); existing product uses `productDisplayNumber`. */
  const [draftNextNumber, setDraftNextNumber] = useState<number | null>(null);
  const [barcodeSpin, setBarcodeSpin] = useState(false);

  const [advancedOpenPrice, setAdvancedOpenPrice] = useState(false);
  const [advancedWeegschaal, setAdvancedWeegschaal] = useState(false);
  const [advancedSubproductRequires, setAdvancedSubproductRequires] = useState(false);
  const [advancedLeeggoedPrijs, setAdvancedLeeggoedPrijs] = useState("0.00");
  const [advancedPagerVerplicht, setAdvancedPagerVerplicht] = useState(false);
  const [advancedBoldPrint, setAdvancedBoldPrint] = useState(false);
  const [advancedGroupingReceipt, setAdvancedGroupingReceipt] = useState(true);
  const [advancedLabelExtraInfo, setAdvancedLabelExtraInfo] = useState("");
  const [advancedKassaPhotoPreview, setAdvancedKassaPhotoPreview] = useState<string | null>(null);
  const [advancedVoorverpakVervaltype, setAdvancedVoorverpakVervaltype] = useState("Shelf life");
  const [advancedHoudbareDagen, setAdvancedHoudbareDagen] = useState("0");
  const [advancedBewarenGebruik, setAdvancedBewarenGebruik] = useState("");

  const [extraPricesRows, setExtraPricesRows] = useState<ExtraPriceRow[]>([]);

  const [purchaseVat, setPurchaseVat] = useState("");
  const [purchasePriceExcl, setPurchasePriceExcl] = useState("0.00");
  const [purchasePriceIncl, setPurchasePriceIncl] = useState("0.00");
  const [profitPct, setProfitPct] = useState("0.00");
  const [purchaseUnit, setPurchaseUnit] = useState("Piece");
  const [unitContent, setUnitContent] = useState("0");
  const [stock, setStock] = useState("0");
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [stockNotification, setStockNotification] = useState(true);
  const [expirationDate, setExpirationDate] = useState("");
  const [declarationExpiryDays, setDeclarationExpiryDays] = useState("0");
  const [notificationSoldOutPieces, setNotificationSoldOutPieces] = useState("");

  const [productInWebshop, setProductInWebshop] = useState(false);
  const [webshopOnlineOrderable, setWebshopOnlineOrderable] = useState(true);
  const [websiteRemark, setWebsiteRemark] = useState("");
  const [websiteOrder, setWebsiteOrder] = useState("0");
  const [shortWebText, setShortWebText] = useState("");
  const [websitePhotoFileName, setWebsitePhotoFileName] = useState("");

  const tabsUnlocked = true;

  /** Avoid re-running `resetForNew` while the dialog stays open (e.g. parent `categories` poll changes `resetForNew` identity). */
  const newFormInitializedRef = useRef(false);

  const resetForNew = useCallback(() => {
    const cat0 = defaultCategoryId || categories[0]?.id || "";
    setProductName("");
    setProductKeyName("");
    setProductPrice("");
    setProductVatTakeOut("");
    setProductDisplayNumber(null);
    setProductCategoryIds([cat0]);
    setProductAddition("Subproducts");
    setProductBarcode("");
    setFieldErrors({ name: false, keyName: false, vatTakeOut: false });
    setAdvancedOpenPrice(false);
    setAdvancedWeegschaal(false);
    setAdvancedSubproductRequires(false);
    setAdvancedLeeggoedPrijs("0.00");
    setAdvancedPagerVerplicht(false);
    setAdvancedBoldPrint(false);
    setAdvancedGroupingReceipt(true);
    setAdvancedLabelExtraInfo("");
    setAdvancedKassaPhotoPreview(null);
    setAdvancedVoorverpakVervaltype("Shelf life");
    setAdvancedHoudbareDagen("0");
    setAdvancedBewarenGebruik("");
    setPurchaseVat("");
    setPurchasePriceExcl("0.00");
    setPurchasePriceIncl("0.00");
    setProfitPct("0.00");
    setPurchaseUnit("Piece");
    setUnitContent("0");
    setStock("0");
    setPurchaseSupplier("");
    setSupplierCode("");
    setStockNotification(true);
    setExpirationDate("");
    setDeclarationExpiryDays("0");
    setNotificationSoldOutPieces("");
    setProductInWebshop(false);
    setWebshopOnlineOrderable(true);
    setWebsiteRemark("");
    setWebsiteOrder("0");
    setShortWebText("");
    setWebsitePhotoFileName("");
    setDraftNextNumber(null);
  }, [defaultCategoryId, categories]);

  const mergeExtraRowsFromGroups = useCallback(
    (existing: ExtraPriceRow[]) => {
      const byId = new Map(existing.map((r) => [r.priceGroupId, r]));
      return priceGroups.map((pg) => {
        const ex = byId.get(pg.id);
        return {
          priceGroupId: pg.id,
          priceGroupLabel: pg.name,
          otherName: ex?.otherName ?? "",
          otherPrinter: ex?.otherPrinter ?? "Disabled",
          otherPrice: ex?.otherPrice ?? "",
        };
      });
    },
    [priceGroups],
  );

  /** Same number parsing as retail `ControlView` (product purchase fields). */
  const parsePurchaseNumberInput = useCallback((raw: string) => {
    const normalized = String(raw ?? "")
      .trim()
      .replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const computePurchaseInclFromExcl = useCallback(
    (exclRaw: string, vatRaw: string) => {
      const excl = parsePurchaseNumberInput(exclRaw);
      if (excl == null) return "";
      const vat = parsePurchaseNumberInput(vatRaw) ?? 0;
      const incl = excl + (excl * vat) / 100;
      return incl.toFixed(2);
    },
    [parsePurchaseNumberInput],
  );

  const handlePurchaseVatChange = useCallback(
    (nextVat: string) => {
      setPurchaseVat(nextVat);
      setPurchasePriceIncl(computePurchaseInclFromExcl(purchasePriceExcl, nextVat));
    },
    [computePurchaseInclFromExcl, purchasePriceExcl],
  );

  const handlePurchasePriceExclChange = useCallback(
    (nextExcl: string) => {
      setPurchasePriceExcl(nextExcl);
      setPurchasePriceIncl(computePurchaseInclFromExcl(nextExcl, purchaseVat));
    },
    [computePurchaseInclFromExcl, purchaseVat],
  );

  const handlePurchasePriceInclChange = useCallback((nextIncl: string) => {
    setPurchasePriceIncl(nextIncl);
  }, []);

  const handleProfitPctChange = useCallback((nextProfitPct: string) => {
    setProfitPct(nextProfitPct);
  }, []);

  const isProductPriceLockedByProfit = useMemo(() => {
    const profit = parsePurchaseNumberInput(profitPct);
    return profit != null && Math.abs(profit) > 0.000001;
  }, [parsePurchaseNumberInput, profitPct]);

  /** Include current `supplierId` if the supplier row was removed from the directory. */
  const supplierSelectOptions = useMemo(() => {
    const list = [...suppliers];
    if (purchaseSupplier && !list.some((s) => s.id === purchaseSupplier)) {
      list.push({
        id: purchaseSupplier,
        companyName: lang === "nl" ? "(Onbekende leverancier)" : "(Unknown supplier)",
      });
    }
    return list;
  }, [suppliers, purchaseSupplier, lang]);

  /** Retail: when profit ≠ 0, selling price tracks purchase incl. × (1 + profit%). */
  useEffect(() => {
    if (!isProductPriceLockedByProfit) return;
    const purchaseInclValue = parsePurchaseNumberInput(purchasePriceIncl);
    const profitValue = parsePurchaseNumberInput(profitPct) ?? 0;
    if (purchaseInclValue == null) {
      setProductPrice("");
      return;
    }
    const computedPrice = (purchaseInclValue * (1 + profitValue / 100)).toFixed(2);
    setProductPrice(computedPrice);
  }, [isProductPriceLockedByProfit, parsePurchaseNumberInput, profitPct, purchasePriceIncl]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [pgRes, supRes] = await Promise.all([
          apiRequest<Array<{ id: string; name: string }>>("/api/price-groups"),
          apiRequest<Array<Record<string, unknown>>>("/api/suppliers"),
        ]);
        const pgs = (Array.isArray(pgRes) ? pgRes : []).map((r) => ({ id: r.id, name: r.name }));
        setPriceGroups(pgs);
        const sups = (Array.isArray(supRes) ? supRes : []).map((r) => ({
          id: String(r.id ?? ""),
          companyName: String(r.companyName ?? ""),
        })).filter((s) => s.id);
        setSuppliers(sups.sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" })));
      } catch {
        setPriceGroups([]);
        setSuppliers([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !productId) return;
    setLoadingProduct(true);
    void (async () => {
      try {
        const p = await apiRequest<Record<string, unknown>>(`/api/products/${productId}`);
        setProductName(String(p.name ?? ""));
        setProductKeyName(String(p.keyName ?? ""));
        setProductPrice(String(p.price ?? ""));
        setProductVatTakeOut(normalizeVatTakeOut(p.vatTakeOut as string | null | undefined));
        setProductDisplayNumber(typeof p.number === "number" ? p.number : null);
        let catIds = [String(p.categoryId ?? "")];
        if (p.categoryIdsJson) {
          try {
            const parsed = JSON.parse(String(p.categoryIdsJson));
            if (Array.isArray(parsed) && parsed.length) catIds = parsed.map(String);
          } catch {
            /* ignore */
          }
        }
        setProductCategoryIds(catIds.length ? catIds : [""]);
        setProductAddition(String(p.addition ?? "Subproducts"));
        setProductBarcode(String(p.barcode ?? ""));
        setAdvancedOpenPrice(!!p.openPrice);
        setAdvancedWeegschaal(!!p.weegschaal);
        setAdvancedSubproductRequires(!!p.subproductRequires);
        setAdvancedLeeggoedPrijs(String(p.leeggoedPrijs ?? "0.00"));
        setAdvancedPagerVerplicht(!!p.pagerVerplicht);
        setAdvancedBoldPrint(!!p.boldPrint);
        setAdvancedGroupingReceipt(p.groupingReceipt !== false);
        setAdvancedLabelExtraInfo(String(p.labelExtraInfo ?? ""));
        setAdvancedKassaPhotoPreview(p.kassaPhotoPath != null ? String(p.kassaPhotoPath) : null);
        setAdvancedVoorverpakVervaltype(String(p.voorverpakVervaltype ?? "Shelf life"));
        setAdvancedHoudbareDagen(String(p.houdbareDagen ?? "0"));
        setAdvancedBewarenGebruik(String(p.bewarenGebruik ?? ""));
        let rows: ExtraPriceRow[] = [];
        if (p.extraPricesJson) {
          try {
            const parsed = JSON.parse(String(p.extraPricesJson));
            if (Array.isArray(parsed)) {
              rows = parsed.map((r: Record<string, unknown>) => ({
                priceGroupId: String(r.priceGroupId ?? ""),
                priceGroupLabel: String(r.priceGroupLabel ?? ""),
                otherName: String(r.otherName ?? ""),
                otherPrinter: String(r.otherPrinter ?? "Disabled"),
                otherPrice: String(r.otherPrice ?? ""),
              }));
            }
          } catch {
            /* ignore */
          }
        }
        setExtraPricesRows(rows);
        setPurchaseVat(String(p.purchaseVat ?? ""));
        setPurchasePriceExcl(String(p.purchasePriceExcl ?? "0.00"));
        setPurchasePriceIncl(String(p.purchasePriceIncl ?? "0.00"));
        setProfitPct(String(p.profitPct ?? "0.00"));
        setPurchaseUnit(String(p.unit ?? "Piece"));
        setUnitContent(String(p.unitContent ?? "0"));
        setStock(String(p.stock ?? "0"));
        setPurchaseSupplier(String(p.supplierId ?? ""));
        setSupplierCode(String(p.supplierCode ?? ""));
        setStockNotification(p.stockNotification !== false);
        setExpirationDate(String(p.expirationDate ?? ""));
        setDeclarationExpiryDays(String(p.declarationExpiryDays ?? "0"));
        setNotificationSoldOutPieces(String(p.notificationSoldOutPieces ?? ""));
        setProductInWebshop(!!p.inWebshop);
        setWebshopOnlineOrderable(p.onlineOrderable !== false);
        setWebsiteRemark(String(p.websiteRemark ?? ""));
        setWebsiteOrder(String(p.websiteOrder ?? "0"));
        setShortWebText(String(p.shortWebText ?? ""));
        setWebsitePhotoFileName(String(p.websitePhotoPath ?? ""));
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "Failed to load product",
        });
        onOpenChangeRef.current(false);
      } finally {
        setLoadingProduct(false);
      }
    })();
  }, [open, productId]);

  useEffect(() => {
    if (!open) {
      newFormInitializedRef.current = false;
      return;
    }
    if (productId) return;
    if (newFormInitializedRef.current) return;
    newFormInitializedRef.current = true;
    resetForNew();
  }, [open, productId, resetForNew]);

  useEffect(() => {
    if (!open || productId) return;
    void (async () => {
      try {
        const data = await apiRequest<{ nextNumber?: number }>("/api/products/next-number");
        setDraftNextNumber(typeof data?.nextNumber === "number" ? data.nextNumber : null);
      } catch {
        setDraftNextNumber(null);
      }
    })();
  }, [open, productId]);

  useEffect(() => {
    if (!open || productId || priceGroups.length === 0) return;
    setExtraPricesRows((prev) => mergeExtraRowsFromGroups(prev.length ? prev : []));
  }, [open, productId, priceGroups, mergeExtraRowsFromGroups]);

  useEffect(() => {
    if (!open || !productId || loadingProduct || priceGroups.length === 0) return;
    setExtraPricesRows((prev) => mergeExtraRowsFromGroups(prev));
  }, [open, productId, loadingProduct, priceGroups, mergeExtraRowsFromGroups]);

  const onNameSynced = (v: string) => {
    setProductName(v);
    setProductKeyName(v);
    setFieldErrors((e) => ({ ...e, name: false, keyName: false }));
  };

  const validate = () => {
    const name = !productName.trim();
    const keyName = !productKeyName.trim();
    const vatTakeOut = !productVatTakeOut;
    setFieldErrors({ name, keyName, vatTakeOut });
    return !name && !keyName && !vatTakeOut;
  };

  const buildPayload = () => {
    const categoryId = (productCategoryIds[0] || "").trim() || defaultCategoryId || categories[0]?.id || "";
    return {
      name: productName.trim() || "New product",
      price: parseFloat(productPrice) || 0,
      categoryId: categoryId || undefined,
      keyName: productKeyName.trim() || null,
      productionName: productKeyName.trim() || productName.trim() || null,
      vatTakeOut: productVatTakeOut || null,
      barcode: productBarcode.trim() || null,
      addition: productAddition || null,
      categoryIdsJson: JSON.stringify(productCategoryIds.filter(Boolean)),
      openPrice: advancedOpenPrice,
      weegschaal: advancedWeegschaal,
      subproductRequires: advancedSubproductRequires,
      leeggoedPrijs: advancedLeeggoedPrijs || null,
      pagerVerplicht: advancedPagerVerplicht,
      boldPrint: advancedBoldPrint,
      groupingReceipt: advancedGroupingReceipt,
      labelExtraInfo: advancedLabelExtraInfo.trim() || null,
      kassaPhotoPath: advancedKassaPhotoPreview || null,
      voorverpakVervaltype: advancedVoorverpakVervaltype || null,
      houdbareDagen: advancedHoudbareDagen || null,
      bewarenGebruik: advancedBewarenGebruik.trim() || null,
      extraPricesJson: JSON.stringify(
        extraPricesRows.map((r) => ({
          priceGroupId: r.priceGroupId,
          priceGroupLabel: r.priceGroupLabel,
          otherName: r.otherName || "",
          otherPrinter: r.otherPrinter || "",
          otherPrice: r.otherPrice || "",
        })),
      ),
      purchaseVat: purchaseVat || null,
      purchasePriceExcl: purchasePriceExcl || null,
      purchasePriceIncl: purchasePriceIncl || null,
      profitPct: profitPct || null,
      unit: purchaseUnit || null,
      unitContent: unitContent || null,
      stock: stock || null,
      supplierId: purchaseSupplier.trim() || null,
      supplierCode: supplierCode.trim() || null,
      stockNotification,
      expirationDate: expirationDate || null,
      declarationExpiryDays: declarationExpiryDays || null,
      notificationSoldOutPieces: notificationSoldOutPieces || null,
      inWebshop: productInWebshop,
      onlineOrderable: webshopOnlineOrderable,
      websiteRemark: websiteRemark.trim() || null,
      websiteOrder: websiteOrder || null,
      shortWebText: shortWebText.trim() || null,
      websitePhotoPath: websitePhotoFileName || null,
    };
  };

  const handleSave = async () => {
    if (!validate()) {
      setTab("general");
      toast({
        variant: "destructive",
        description: lang === "nl" ? "Vul alle verplichte velden op het tabblad Algemeen in." : "Fill in all required fields on the General tab.",
      });
      return;
    }
    const categoryId = (productCategoryIds[0] || "").trim() || defaultCategoryId || categories[0]?.id || "";
    if (!categoryId) {
      toast({ variant: "destructive", description: t("categories") + " — required" });
      return;
    }
    const payload = buildPayload();
    setSaving(true);
    try {
      if (productId) {
        await apiRequest(`/api/products/${productId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/products", {
          method: "POST",
          body: JSON.stringify({ ...payload, categoryId }),
        });
      }
      onSaved();
      onOpenChange(false);
      toast({
        description: lang === "nl" ? "Product opgeslagen." : "Product saved.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to save product",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBarcode = () => {
    const digits = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join("");
    setProductBarcode(digits);
    setBarcodeSpin(true);
    window.setTimeout(() => setBarcodeSpin(false), 500);
  };

  const categorySlotCount = useMemo(
    () => retailStyleCategoryRows(productCategoryIds, categories, tabsUnlocked),
    [productCategoryIds, categories, tabsUnlocked],
  );

  const extraPrinterOptions = useMemo(() => [{ value: "Disabled", label: "Disabled" }], []);

  const title = productId ? `${t("edit")} ${t("product")}` : t("newProduct");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {lang === "nl"
              ? "Zelfde velden als in de kassa (Customize POS). Opslaan slaat alle tabbladen op."
              : "Same fields as the POS (Customize POS). Save persists all tabs."}
          </DialogDescription>
        </DialogHeader>

        {loadingProduct ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>…</span>
          </div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-col gap-2 px-6">
              <div className="flex w-full shrink-0 justify-center">
                <TabsList className="relative z-0 flex h-auto w-fit flex-wrap items-center justify-center gap-1">
                  <TabsTrigger value="general">{lang === "nl" ? "Algemeen" : "General"}</TabsTrigger>
                  <TabsTrigger value="advanced">{lang === "nl" ? "Geavanceerd" : "Advanced"}</TabsTrigger>
                  <TabsTrigger value="extra_prices">{lang === "nl" ? "Extra prijzen" : "Extra prices"}</TabsTrigger>
                  <TabsTrigger value="purchase_stock">{lang === "nl" ? "Aankoop & stock" : "Purchase & stock"}</TabsTrigger>
                  <TabsTrigger value="webshop">Webshop</TabsTrigger>
                </TabsList>
              </div>

              {/* pt/px: focus rings (ring + ring-offset) extend outside the input and are clipped by overflow-y-auto without inset padding */}
              <div className="min-h-[450px] max-h-[450px] flex-1 overflow-y-auto overflow-x-hidden px-2 pt-4 pb-2">
                <TabsContent value="general" className="mt-0 space-y-4 pb-4 focus-visible:outline-none">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{t("name")} *</Label>
                        <Input
                          value={productName}
                          onChange={(e) => onNameSynced(e.target.value)}
                          className={fieldErrors.name ? "border-destructive" : ""}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Testnaam" : "Test name"} *</Label>
                        <Input
                          value={productKeyName}
                          onChange={(e) => {
                            setProductKeyName(e.target.value);
                            setFieldErrors((x) => ({ ...x, keyName: false }));
                          }}
                          className={fieldErrors.keyName ? "border-destructive" : ""}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{t("price")} (€)</Label>
                        <Input
                          value={productPrice}
                          disabled={isProductPriceLockedByProfit}
                          onChange={(e) => {
                            if (!isProductPriceLockedByProfit) setProductPrice(e.target.value);
                          }}
                          inputMode="decimal"
                          className={isProductPriceLockedByProfit ? "opacity-60 cursor-not-allowed" : ""}
                        />
                        {isProductPriceLockedByProfit ? (
                          <p className="text-xs text-muted-foreground">
                            {lang === "nl"
                              ? "Prijs volgt aankoopprijs incl. en winst % (zoals in de kassa)."
                              : "Price follows purchase price incl. and profit % (same as POS)."}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "BTW take-out" : "VAT take out"} *</Label>
                        <Select
                          value={productVatTakeOut || "__vat_unset__"}
                          onValueChange={(v) => {
                            setProductVatTakeOut(v === "__vat_unset__" ? "" : v);
                            setFieldErrors((x) => ({ ...x, vatTakeOut: false }));
                          }}
                        >
                          <SelectTrigger className={fieldErrors.vatTakeOut ? "border-destructive" : ""}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__vat_unset__">—</SelectItem>
                            {VAT_OPTIONS.filter((o) => o.value !== "").map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lang === "nl" ? "Nr." : "Id"}:{" "}
                        <span className="font-mono text-foreground">
                          {productId ? (productDisplayNumber ?? "—") : draftNextNumber ?? "—"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>{t("categories")}</Label>
                      {Array.from({ length: categorySlotCount }, (_, i) => {
                        const ids = [...productCategoryIds];
                        while (ids.length <= i) ids.push("");
                        const prevIds = ids.slice(0, i);
                        const optionsForI = i === 0 ? categories : categories.filter((c) => !prevIds.includes(c.id));
                        return (
                          <Select
                            key={i}
                            value={ids[i] || undefined}
                            onValueChange={(v) => {
                              setProductCategoryIds((prev) => {
                                const next = [...prev];
                                while (next.length <= i) next.push("");
                                next[i] = v;
                                for (let j = i + 1; j < next.length; j++) next[j] = "";
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {optionsForI.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })}
                    </div>

                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Toevoeging" : "Addition"}</Label>
                        <Select value={productAddition} onValueChange={setProductAddition}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Subproducts">{t("subproducts")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Barcode" : "Barcode"}</Label>
                        <div className="flex gap-2">
                          <Input value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} className="font-mono text-sm" />
                          <Button type="button" variant="outline" size="icon" onClick={handleGenerateBarcode} aria-label="Generate barcode">
                            <RefreshCw className={`h-4 w-4 ${barcodeSpin ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="mt-0 space-y-4 pb-4 focus-visible:outline-none">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="openPrice" checked={advancedOpenPrice} onCheckedChange={(v) => setAdvancedOpenPrice(!!v)} />
                        <Label htmlFor="openPrice">{lang === "nl" ? "Open prijs" : "Open price"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="weeg" checked={advancedWeegschaal} onCheckedChange={(v) => setAdvancedWeegschaal(!!v)} />
                        <Label htmlFor="weeg">{lang === "nl" ? "Weegschaal" : "Scale"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="subreq" checked={advancedSubproductRequires} onCheckedChange={(v) => setAdvancedSubproductRequires(!!v)} />
                        <Label htmlFor="subreq">{lang === "nl" ? "Subproduct vereist" : "Subproduct requires"}</Label>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Leeggoedprijs" : "Empty price"}</Label>
                        <Input value={advancedLeeggoedPrijs} onChange={(e) => setAdvancedLeeggoedPrijs(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="pager" checked={advancedPagerVerplicht} onCheckedChange={(v) => setAdvancedPagerVerplicht(!!v)} />
                        <Label htmlFor="pager">{lang === "nl" ? "Pager verplicht" : "Pager required"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="bold" checked={advancedBoldPrint} onCheckedChange={(v) => setAdvancedBoldPrint(!!v)} />
                        <Label htmlFor="bold">{lang === "nl" ? "Vetgedrukt" : "Bold print"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="grp" checked={advancedGroupingReceipt} onCheckedChange={(v) => setAdvancedGroupingReceipt(!!v)} />
                        <Label htmlFor="grp">{lang === "nl" ? "Groepering bon" : "Grouping receipt"}</Label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Label extra info" : "Label extra info"}</Label>
                        <Input value={advancedLabelExtraInfo} onChange={(e) => setAdvancedLabelExtraInfo(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Kassa foto" : "Cash register photo"}</Label>
                        {!advancedKassaPhotoPreview ? (
                          <Input
                            type="file"
                            accept="image/*"
                            className="cursor-pointer"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file?.type.startsWith("image/")) {
                                const dataUrl = await new Promise<string>((resolve, reject) => {
                                  const r = new FileReader();
                                  r.onload = () => resolve(String(r.result || ""));
                                  r.onerror = () => reject(r.error);
                                  r.readAsDataURL(file);
                                }).catch(() => "");
                                if (dataUrl) setAdvancedKassaPhotoPreview(dataUrl);
                              }
                              e.target.value = "";
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <img src={advancedKassaPhotoPreview} alt="" className="h-16 w-16 rounded border object-cover" />
                            <Button type="button" variant="outline" size="sm" onClick={() => setAdvancedKassaPhotoPreview(null)}>
                              {t("delete")}
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Voorverpak verval" : "Pre-pack expiry type"}</Label>
                        <Select value={advancedVoorverpakVervaltype} onValueChange={setAdvancedVoorverpakVervaltype}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VERVALTYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Houdbaarheid (dagen)" : "Shelf life"}</Label>
                        <Input value={advancedHoudbareDagen} onChange={(e) => setAdvancedHoudbareDagen(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Bewaren, gebruik" : "Storage, use"}</Label>
                        <Textarea value={advancedBewarenGebruik} onChange={(e) => setAdvancedBewarenGebruik(e.target.value)} rows={3} />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="extra_prices" className="mt-0 pb-4 focus-visible:outline-none">
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-2 text-left font-medium">{lang === "nl" ? "Prijsgroep" : "Price group"}</th>
                          <th className="p-2 text-left font-medium">{lang === "nl" ? "Andere naam" : "Other name"}</th>
                          <th className="p-2 text-left font-medium">{lang === "nl" ? "Andere printer" : "Other printer"}</th>
                          <th className="p-2 text-left font-medium">{lang === "nl" ? "Andere prijs" : "Other price"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraPricesRows.map((row, idx) => (
                          <tr key={row.priceGroupId || idx} className="border-b last:border-0">
                            <td className="p-2 align-middle">{row.priceGroupLabel}</td>
                            <td className="p-2">
                              <Input
                                value={row.otherName}
                                onChange={(e) =>
                                  setExtraPricesRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, otherName: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                            <td className="p-2">
                              <Select
                                value={row.otherPrinter || "Disabled"}
                                onValueChange={(v) =>
                                  setExtraPricesRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, otherPrinter: v } : r)),
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {extraPrinterOptions.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.otherPrice}
                                onChange={(e) =>
                                  setExtraPricesRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, otherPrice: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="purchase_stock" className="mt-0 space-y-4 pb-4 focus-visible:outline-none">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Aankoop BTW" : "Purchase VAT"}</Label>
                        <Select
                          value={purchaseVat || "__none__"}
                          onValueChange={(v) => handlePurchaseVatChange(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {VAT_OPTIONS.filter((o) => o.value !== "").map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Aankoopprijs excl." : "Purchase price excl."}</Label>
                        <Input
                          value={purchasePriceExcl}
                          onChange={(e) => handlePurchasePriceExclChange(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Aankoopprijs incl." : "Purchase price incl."}</Label>
                        <Input
                          value={purchasePriceIncl}
                          onChange={(e) => handlePurchasePriceInclChange(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Winst %" : "Profit %"}</Label>
                        <Input value={profitPct} onChange={(e) => handleProfitPctChange(e.target.value)} inputMode="decimal" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Eenheid" : "Unit"}</Label>
                        <Select value={purchaseUnit} onValueChange={setPurchaseUnit}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PURCHASE_UNIT_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Inhoud eenheid" : "Unit content"}</Label>
                        <Input value={unitContent} onChange={(e) => setUnitContent(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{t("stock")}</Label>
                        <Input value={stock} onChange={(e) => setStock(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Leverancier" : "Supplier"}</Label>
                        <Select
                          value={purchaseSupplier || "__none__"}
                          onValueChange={(v) => setPurchaseSupplier(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="__none__">—</SelectItem>
                            {supplierSelectOptions.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.companyName || "—"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Leverancierscode" : "Supplier code"}</Label>
                        <Input value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="stockNotif" checked={stockNotification} onCheckedChange={(v) => setStockNotification(!!v)} />
                        <Label htmlFor="stockNotif">{lang === "nl" ? "Stock notificatie" : "Stock notification"}</Label>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Vervaldatum" : "Expiration date"}</Label>
                        <Input value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Melding uitverkocht (stuks)" : "Notification sold out (pcs)"}</Label>
                        <Input value={notificationSoldOutPieces} onChange={(e) => setNotificationSoldOutPieces(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Verklaring verval (dagen)" : "Declaration expiry (days)"}</Label>
                        <Input value={declarationExpiryDays} onChange={(e) => setDeclarationExpiryDays(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="webshop" className="mt-0 space-y-4 pb-4 focus-visible:outline-none">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="inws" checked={productInWebshop} onCheckedChange={(v) => setProductInWebshop(!!v)} />
                        <Label htmlFor="inws">{lang === "nl" ? "In webshop" : "In webshop"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="ord" checked={webshopOnlineOrderable} onCheckedChange={(v) => setWebshopOnlineOrderable(!!v)} />
                        <Label htmlFor="ord">{lang === "nl" ? "Online bestelbaar" : "Online orderable"}</Label>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Website opmerking" : "Website remark"}</Label>
                        <Input value={websiteRemark} onChange={(e) => setWebsiteRemark(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Website volgorde" : "Website order"}</Label>
                        <Input value={websiteOrder} onChange={(e) => setWebsiteOrder(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Korte webtekst" : "Short web text"}</Label>
                        <Input value={shortWebText} onChange={(e) => setShortWebText(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{lang === "nl" ? "Website foto (bestandsnaam)" : "Website photo (filename)"}</Label>
                        <Input type="file" accept="image/*" onChange={(e) => setWebsitePhotoFileName(e.target.files?.[0]?.name ?? "")} />
                        {websitePhotoFileName ? <p className="text-xs text-muted-foreground truncate">{websitePhotoFileName}</p> : null}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="px-6 py-4 w-full !justify-center shrink-0 gap-10">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving} className="bg-gradient-primary text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
