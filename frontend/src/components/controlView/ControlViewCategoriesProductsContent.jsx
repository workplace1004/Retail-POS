import React from 'react';
import { ControlViewPriceGroups } from './ControlViewPriceGroups';
import { ControlViewCategories } from './ControlViewCategories';
import { ControlViewProducts } from './ControlViewProducts';
import { ControlViewSubproducts } from './ControlViewSubproducts';
import { ControlViewKitchen } from './ControlViewKitchen';
import { ControlViewDiscounts } from './ControlViewDiscounts';

export function ControlViewCategoriesProductsContent(props) {
  const {
    tr,
    subNavId
  } = props;

  if (subNavId === 'Price Groups') {
    return (
      <ControlViewPriceGroups
        tr={tr}
        priceGroupsLoading={props.priceGroupsLoading}
        openPriceGroupModal={props.openPriceGroupModal}
        priceGroups={props.priceGroups}
        priceGroupsListRef={props.priceGroupsListRef}
        updatePriceGroupsScrollState={props.updatePriceGroupsScrollState}
        openEditPriceGroupModal={props.openEditPriceGroupModal}
        setDeleteConfirmId={props.setDeleteConfirmId}
        canPriceGroupsScrollUp={props.canPriceGroupsScrollUp}
        canPriceGroupsScrollDown={props.canPriceGroupsScrollDown}
        scrollPriceGroupsByPage={props.scrollPriceGroupsByPage}
      />
    );
  }

  if (subNavId === 'Categories') {
    return (
      <ControlViewCategories
        tr={tr}
        categories={props.categories}
        categoriesLoading={props.categoriesLoading}
        openCategoryModal={props.openCategoryModal}
        categoriesListRef={props.categoriesListRef}
        updateCategoriesScrollState={props.updateCategoriesScrollState}
        handleMoveCategory={props.handleMoveCategory}
        openEditCategoryModal={props.openEditCategoryModal}
        setDeleteConfirmCategoryId={props.setDeleteConfirmCategoryId}
        canCategoriesScrollUp={props.canCategoriesScrollUp}
        canCategoriesScrollDown={props.canCategoriesScrollDown}
        scrollCategoriesByPage={props.scrollCategoriesByPage}
      />
    );
  }

  if (subNavId === 'Products') {
    return (
      <ControlViewProducts
        tr={tr}
        selectedCategoryId={props.selectedCategoryId}
        selectedProductId={props.selectedProductId}
        setSelectedProductId={props.setSelectedProductId}
        productsLoading={props.productsLoading}
        openProductModal={props.openProductModal}
        openProductPositioningModal={props.openProductPositioningModal}
        productSearch={props.productSearch}
        setProductSearch={props.setProductSearch}
        setShowProductSearchKeyboard={props.setShowProductSearchKeyboard}
        categories={props.categories}
        setSelectedCategoryId={props.setSelectedCategoryId}
        productsCategoryTabsRef={props.productsCategoryTabsRef}
        productsListRef={props.productsListRef}
        updateProductsScrollState={props.updateProductsScrollState}
        filteredProducts={props.filteredProducts}
        productHasSubproductsById={props.productHasSubproductsById}
        openProductSubproductsModal={props.openProductSubproductsModal}
        openEditProductModal={props.openEditProductModal}
        setDeleteConfirmProductId={props.setDeleteConfirmProductId}
        canProductsScrollUp={props.canProductsScrollUp}
        canProductsScrollDown={props.canProductsScrollDown}
        scrollProductsByPage={props.scrollProductsByPage}
      />
    );
  }

  if (subNavId === 'Subproducts') {
    return (
      <ControlViewSubproducts
        tr={tr}
        subproductsLoading={props.subproductsLoading}
        openSubproductModal={props.openSubproductModal}
        setShowManageGroupsModal={props.setShowManageGroupsModal}
        subproductGroups={props.subproductGroups}
        selectedSubproductGroupId={props.selectedSubproductGroupId}
        setSelectedSubproductGroupId={props.setSelectedSubproductGroupId}
        setSelectedSubproductId={props.setSelectedSubproductId}
        subproductsGroupTabsRef={props.subproductsGroupTabsRef}
        subproductsListRef={props.subproductsListRef}
        updateSubproductsScrollState={props.updateSubproductsScrollState}
        subproductGroupsLoading={props.subproductGroupsLoading}
        subproducts={props.subproducts}
        selectedSubproductId={props.selectedSubproductId}
        openEditSubproductModal={props.openEditSubproductModal}
        setDeleteConfirmSubproductId={props.setDeleteConfirmSubproductId}
        canSubproductsScrollUp={props.canSubproductsScrollUp}
        canSubproductsScrollDown={props.canSubproductsScrollDown}
        scrollSubproductsByPage={props.scrollSubproductsByPage}
      />
    );
  }

  if (subNavId === 'Kitchen') {
    return (
      <ControlViewKitchen
        tr={tr}
        openNewKitchenModal={props.openNewKitchenModal}
        kitchens={props.kitchens}
        kitchenListRef={props.kitchenListRef}
        updateKitchenScrollState={props.updateKitchenScrollState}
        openKitchenProductsModal={props.openKitchenProductsModal}
        openEditKitchenModal={props.openEditKitchenModal}
        setDeleteConfirmKitchenId={props.setDeleteConfirmKitchenId}
        canKitchenScrollUp={props.canKitchenScrollUp}
        canKitchenScrollDown={props.canKitchenScrollDown}
        scrollKitchenByPage={props.scrollKitchenByPage}
      />
    );
  }

  if (subNavId === 'Discounts') {
    return (
      <ControlViewDiscounts
        tr={tr}
        openNewDiscountModal={props.openNewDiscountModal}
        discounts={props.discounts}
        discountsListRef={props.discountsListRef}
        updateDiscountsScrollState={props.updateDiscountsScrollState}
        openEditDiscountModal={props.openEditDiscountModal}
        setDeleteConfirmDiscountId={props.setDeleteConfirmDiscountId}
        canDiscountsScrollUp={props.canDiscountsScrollUp}
        canDiscountsScrollDown={props.canDiscountsScrollDown}
        scrollDiscountsByPage={props.scrollDiscountsByPage}
      />
    );
  }

  return (
    <div className="rounded-xl border border-pos-border bg-pos-panel/30 p-8 min-h-[300px] flex items-center justify-center">
      <p className="text-pos-muted text-xl">
        Select a section above to manage {String(subNavId || '').toLowerCase()}.
      </p>
    </div>
  );
}
