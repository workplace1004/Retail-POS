import { useState } from "react";
import { Box, Plus, Package, Settings, Smartphone, MonitorSmartphone } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { TabsBar } from "@/components/TabsBar";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProductsTab } from "@/components/products/ProductsTab";
import { PriceGroupTab } from "@/components/products/PriceGroupTab";
import { CategoriesTab } from "@/components/products/CategoriesTab";
import { SubproductsTab } from "@/components/products/SubproductsTab";
import { DiscountsTab } from "@/components/products/DiscountsTab";
import { ImportTab } from "@/components/products/ImportTab";
import { StockManagementTab } from "@/components/products/StockManagementTab";
import { PosSettingsTab } from "@/components/products/PosSettingsTab";

const Index = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState("categories");
  const [subtab, setSubtab] = useState("products");
  const [newProductOpen, setNewProductOpen] = useState(false);

  const tabs = [
    { id: "categories", label: t("categoriesProducts"), icon: <Box className="h-4 w-4" /> },
    { id: "stock", label: t("stockManagement"), icon: <Package className="h-4 w-4" /> },
    { id: "settings", label: t("posSettings"), icon: <Settings className="h-4 w-4" /> },
    // { id: "tablet", label: t("tabletSettings"), icon: <Smartphone className="h-4 w-4" /> },
    // { id: "kiosks", label: t("kiosks"), icon: <MonitorSmartphone className="h-4 w-4" /> },
  ];

  const subtabs = [
    { id: "pricegroup", label: t("priceGroup") },
    { id: "categories", label: t("categories") },
    { id: "products", label: t("products") },
    { id: "subproducts", label: t("subproducts") },
    { id: "discounts", label: t("discounts") },
    { id: "import", label: t("import") },
  ];

  const headerLabelMap: Record<string, string> = {
    pricegroup: t("newPriceGroup"),
    categories: t("newCategory"),
    products: t("newProduct"),
    subproducts: t("newSubproduct"),
    discounts: t("newDiscount"),
    import: t("uploadFile"),
  };

  return (
    <AppLayout>

      <TabsBar tabs={tabs} active={tab} onChange={setTab} />
      {tab === "categories" && (
        <div className="w-full justify-center flex">
          <TabsBar tabs={subtabs} active={subtab} onChange={setSubtab} variant="secondary" />
        </div>
      )}

      {tab === "categories" && (
        <>
          {subtab === "pricegroup" && <PriceGroupTab />}
          {subtab === "categories" && <CategoriesTab />}
          {subtab === "products" && <ProductsTab newOpen={newProductOpen} setNewOpen={setNewProductOpen} />}
          {subtab === "subproducts" && <SubproductsTab />}
          {subtab === "discounts" && <DiscountsTab />}
          {subtab === "import" && <ImportTab />}
        </>
      )}
      {tab === "stock" && <StockManagementTab />}
      {tab === "settings" && <PosSettingsTab />}
    </AppLayout>
  );
};

export default Index;
