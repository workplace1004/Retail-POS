import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FUNCTION_BUTTON_SLOT_COUNT,
  normalizeFunctionButtonsLayout,
  OPTION_LAYOUT_POLL_MS,
  POS_FUNCTION_BUTTONS_LAYOUT_CHANGED_EVENT,
} from '../lib/functionButtonLayout.ts';
import { posTerminalAuthHeaders } from '../lib/posTerminalSession.js';

function posJsonHeaders() {
  return { 'Content-Type': 'application/json', ...posTerminalAuthHeaders() };
}

export function usePos(API, socket, focusedOrderId = null) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [webordersCount, setWebordersCount] = useState(0);
  const [weborders, setWeborders] = useState([]);
  const [inPlanningCount, setInPlanningCount] = useState(0);
  const [inWaitingCount, setInWaitingCount] = useState(0);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [savedPositioningLayoutByCategory, setSavedPositioningLayoutByCategory] = useState({});
  const [savedPositioningColorByCategory, setSavedPositioningColorByCategory] = useState({});
  const [savedFunctionButtonsLayout, setSavedFunctionButtonsLayout] = useState(() =>
    Array(FUNCTION_BUTTON_SLOT_COUNT).fill('')
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loading, setLoading] = useState(false);

  const productsByCategoryIdRef = useRef({});
  const subproductsByProductIdRef = useRef(new Map());
  const selectedCategoryIdRef = useRef(null);

  const safeJson = (res) => res.json().catch(() => null);
  const roundCurrency = (n) => Math.round((Number(n) || 0) * 100) / 100;

  useEffect(() => {
    selectedCategoryIdRef.current = selectedCategoryId;
  }, [selectedCategoryId]);

  const fetchCategories = useCallback(async () => {
    const res = await fetch(`${API}/categories`);
    const data = await safeJson(res);
    if (Array.isArray(data)) {
      for (const cat of data) {
        const cid = cat?.id;
        if (cid && Array.isArray(cat.products)) {
          productsByCategoryIdRef.current[cid] = cat.products;
        }
      }
      setCategories(data.map(({ products: _p, ...c }) => c));
      if (data.length) {
        setSelectedCategoryId((prev) => (prev != null && prev !== '' ? prev : data[0].id));
      }
    }
  }, [API]);

  const fetchProducts = useCallback(async (categoryId, options) => {
    if (!categoryId) return;
    const force = Boolean(options && options.force);
    if (!force) {
      const cached = productsByCategoryIdRef.current[categoryId];
      if (cached) {
        setProducts(cached);
        return;
      }
    }
    const res = await fetch(`${API}/categories/${categoryId}/products`, {
      cache: force ? 'no-store' : 'default',
    });
    const data = await safeJson(res);
    const list = Array.isArray(data) ? data : [];
    productsByCategoryIdRef.current[categoryId] = list;
    setProducts(list);
  }, [API]);

  /**
   * Refetch product lists from API into the category cache and refresh the visible grid if needed.
   * Pass category id(s) after Control saves a product; omit ids to refresh every cached category (e.g. subproduct / kiosk image extras).
   */
  const refetchCategoriesProducts = useCallback(async (categoryIds) => {
    const allKeys = Object.keys(productsByCategoryIdRef.current);
    const ids =
      Array.isArray(categoryIds) && categoryIds.length > 0
        ? [...new Set(categoryIds.map(String).filter(Boolean))]
        : allKeys;
    if (ids.length === 0) return;
    for (const cid of ids) {
      const res = await fetch(`${API}/categories/${cid}/products`, { cache: 'no-store' });
      const data = await safeJson(res);
      const list = Array.isArray(data) ? data : [];
      for (const p of list) {
        if (p?.id != null) subproductsByProductIdRef.current.delete(p.id);
      }
      productsByCategoryIdRef.current[cid] = list;
    }
    const sel = selectedCategoryIdRef.current;
    if (sel != null && String(sel) !== '') {
      setProducts(productsByCategoryIdRef.current[sel] || []);
    }
  }, [API]);

  /**
   * POS bootstrap: all categories, all products per category (API returns nested products on /categories),
   * then all subproducts per product (batched) cached for instant category switches and subproduct modal.
   */
  const loadPosFullCatalog = useCallback(async () => {
    productsByCategoryIdRef.current = {};
    subproductsByProductIdRef.current = new Map();

    const res = await fetch(`${API}/categories`);
    const data = await safeJson(res);
    if (!Array.isArray(data) || !data.length) {
      setCategories([]);
      setProducts([]);
      setSelectedCategoryId(null);
      return;
    }

    const stripProducts = (cat) => {
      if (!cat || typeof cat !== 'object') return cat;
      const { products: _nested, ...rest } = cat;
      return rest;
    };

    for (const cat of data) {
      const cid = cat?.id;
      if (!cid) continue;
      if (Array.isArray(cat.products) && cat.products.length > 0) {
        productsByCategoryIdRef.current[cid] = cat.products;
      }
    }

    const firstId = data[0].id;
    setSelectedCategoryId(firstId);

    for (const cat of data) {
      const cid = cat?.id;
      if (!cid) continue;
      if (productsByCategoryIdRef.current[cid] == null) {
        const pres = await fetch(`${API}/categories/${cid}/products`);
        const pdata = await safeJson(pres);
        productsByCategoryIdRef.current[cid] = Array.isArray(pdata) ? pdata : [];
      }
    }

    setCategories(data.map(stripProducts));
    setProducts(productsByCategoryIdRef.current[firstId] || []);

    const allProductIds = [];
    const seen = new Set();
    for (const cid of Object.keys(productsByCategoryIdRef.current)) {
      for (const p of productsByCategoryIdRef.current[cid]) {
        const pid = p?.id;
        if (pid != null && !seen.has(pid)) {
          seen.add(pid);
          allProductIds.push(pid);
        }
      }
    }

    const SUB_CHUNK = 25;
    for (let i = 0; i < allProductIds.length; i += SUB_CHUNK) {
      const chunk = allProductIds.slice(i, i + SUB_CHUNK);
      await Promise.all(
        chunk.map(async (productId) => {
          try {
            const sres = await fetch(`${API}/products/${productId}/subproducts`);
            const sdata = await safeJson(sres);
            subproductsByProductIdRef.current.set(productId, Array.isArray(sdata) ? sdata : []);
          } catch {
            subproductsByProductIdRef.current.set(productId, []);
          }
        })
      );
    }
  }, [API]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`${API}/orders`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setOrders(data);
  }, [API]);

  const fetchWebordersCount = useCallback(async () => {
    const res = await fetch(`${API}/weborders/count`);
    const data = await safeJson(res);
    if (data && typeof data.count === 'number') setWebordersCount(data.count);
  }, [API]);

  const fetchWeborders = useCallback(async () => {
    const res = await fetch(`${API}/weborders`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setWeborders(data);
  }, [API]);

  const fetchInPlanningCount = useCallback(async () => {
    const res = await fetch(`${API}/orders/in-planning/count`);
    const data = await safeJson(res);
    if (data && typeof data.count === 'number') setInPlanningCount(data.count);
  }, [API]);

  const fetchInWaitingCount = useCallback(async () => {
    const res = await fetch(`${API}/orders/in-waiting/count`);
    const data = await safeJson(res);
    if (data && typeof data.count === 'number') setInWaitingCount(data.count);
  }, [API]);

  const fetchOrderHistory = useCallback(async () => {
    const res = await fetch(`${API}/orders/history`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setHistoryOrders(data);
  }, [API]);

  const fetchSubproductsForProduct = useCallback(
    async (productId) => {
      if (!productId) return [];
      // Always hit the API — permanent in-memory cache caused stale subproduct prices after Control edits.
      const res = await fetch(`${API}/products/${productId}/subproducts`, { cache: 'no-store' });
      const data = await safeJson(res);
      const list = Array.isArray(data) ? data : [];
      subproductsByProductIdRef.current.set(productId, list);
      return list;
    },
    [API]
  );

  const fetchSavedPositioningLayout = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings/product-positioning-layout`);
      const data = await safeJson(res);
      const value = data?.value;
      setSavedPositioningLayoutByCategory(value && typeof value === 'object' ? value : {});
    } catch {
      setSavedPositioningLayoutByCategory({});
    }
  }, [API]);

  const fetchSavedPositioningColors = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings/product-positioning-colors`);
      const data = await safeJson(res);
      const value = data?.value;
      setSavedPositioningColorByCategory(value && typeof value === 'object' ? value : {});
    } catch {
      setSavedPositioningColorByCategory({});
    }
  }, [API]);

  const fetchSavedFunctionButtonsLayout = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings/function-buttons-layout`);
      const data = await safeJson(res);
      setSavedFunctionButtonsLayout(normalizeFunctionButtonsLayout(data?.value));
    } catch {
      setSavedFunctionButtonsLayout(Array(FUNCTION_BUTTON_SLOT_COUNT).fill(''));
    }
  }, [API]);

  useEffect(() => {
    const onPush = () => {
      void fetchSavedFunctionButtonsLayout();
    };
    window.addEventListener(POS_FUNCTION_BUTTONS_LAYOUT_CHANGED_EVENT, onPush);
    const id = window.setInterval(() => {
      void fetchSavedFunctionButtonsLayout();
    }, OPTION_LAYOUT_POLL_MS);
    return () => {
      window.removeEventListener(POS_FUNCTION_BUTTONS_LAYOUT_CHANGED_EVENT, onPush);
      window.clearInterval(id);
    };
  }, [fetchSavedFunctionButtonsLayout]);

  useEffect(() => {
    if (!socket?.on) return;
    const handler = (order) => {
      if (order && order.id != null && String(order.id).trim() !== '') {
        setOrders((prev) => {
          const id = String(order.id);
          const without = prev.filter((o) => String(o?.id) !== id);
          return [order, ...without];
        });
      }
      fetchOrders();
    };
    const clearHandler = () => {
      fetchOrders();
    };
    const deletedHandler = () => {
      fetchOrders();
    };
    socket.on('order:updated', handler);
    socket.on('orders:cleared', clearHandler);
    socket.on('order:deleted', deletedHandler);
    return () => {
      socket.off('order:updated', handler);
      socket.off('orders:cleared', clearHandler);
      socket.off('order:deleted', deletedHandler);
    };
  }, [socket, fetchOrders]);

  // Keep ticket lines/totals synced with external edits (e.g. mobile product price updates).
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 2000);
    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  const currentOrderCandidates = orders.filter((o) => o?.status === 'open');
  // When viewing an in_waiting or in_planning order, show it without changing status
  const fid = focusedOrderId != null ? String(focusedOrderId) : '';
  const focusedOrderFromWaiting = fid
    ? orders.find((o) => String(o?.id) === fid && o?.status === 'in_waiting')
    : null;
  const focusedOrderFromPlanning = fid
    ? orders.find((o) => String(o?.id) === fid && o?.status === 'in_planning')
    : null;
  const focusedOrder = fid
    ? focusedOrderFromWaiting || focusedOrderFromPlanning || currentOrderCandidates.find((o) => String(o?.id) === fid)
    : null;

  const currentOrder =
    focusedOrder ||
    currentOrderCandidates.reduce((latest, candidate) => {
      if (!latest) return candidate;
      const li = Array.isArray(latest?.items) ? latest.items.length : 0;
      const ci = Array.isArray(candidate?.items) ? candidate.items.length : 0;
      if (ci !== li) return ci > li ? candidate : latest;
      const lt = Math.round((Number(latest?.total) || 0) * 100) / 100;
      const ct = Math.round((Number(candidate?.total) || 0) * 100) / 100;
      if (ct !== lt) return ct > lt ? candidate : latest;
      const latestTime = new Date(latest?.createdAt || 0).getTime();
      const candidateTime = new Date(candidate?.createdAt || 0).getTime();
      return candidateTime >= latestTime ? candidate : latest;
    }, null);

  const addItemToOrder = useCallback(
    async (product, quantity = 1, options = {}) => {
      const { linePrice, lineNotes } = options;
      const unitPrice = linePrice != null ? roundCurrency(linePrice) : product.price;
      const notes =
        lineNotes != null
          ? lineNotes
          : product?.subproductName || undefined;
      let orderId = currentOrder?.id;
      if (!orderId) {
        const createRes = await fetch(`${API}/orders`, {
          method: 'POST',
          headers: posJsonHeaders(),
          body: JSON.stringify({
            items: [{ productId: product.id, quantity, price: unitPrice, notes }]
          })
        });
        const created = await safeJson(createRes);
        if (created?.id) {
          orderId = created.id;
          setOrders((prev) => [created, ...prev]);
          return created?.items?.[0]?.id || null;
        }
        return null;
      }

      const prevIds = new Set((currentOrder?.items || []).map((i) => i.id));
      await fetch(`${API}/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity, price: unitPrice, notes })
      });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) {
        setOrders(list);
        const updatedOrder = list.find((o) => o.id === orderId);
        if (updatedOrder?.items?.length) {
          const createdItem = updatedOrder.items.find((i) => !prevIds.has(i.id));
          return createdItem?.id || null;
        }
      }
      return null;
    },
    [API, currentOrder]
  );

  const appendSubproductNoteToItem = useCallback(
    async (orderItemId, noteText, notePrice = 0) => {
      const orderId = currentOrder?.id;
      const note = String(noteText || '').trim();
      if (!orderId || !orderItemId || !note) return false;
      const target = (currentOrder?.items || []).find((it) => it.id === orderItemId);
      if (!target) return false;
      const extraPrice = Math.max(0, roundCurrency(notePrice));
      const noteToken = extraPrice > 0 ? `${note}::${extraPrice.toFixed(2)}` : note;
      const existingTokens = String(target.notes || '')
        .split(/[;,]/)
        .map((n) => n.trim())
        .filter(Boolean);
      const matchedIndex = existingTokens.findIndex((token) => token.split('::')[0].trim() === note);
      let nextTokens = existingTokens;
      let nextPrice;
      let wasAdded = true;

      if (matchedIndex >= 0) {
        // Toggle off: remove existing subproduct note and subtract its stored extra price.
        const matchedToken = existingTokens[matchedIndex];
        const matchedPriceRaw = String(matchedToken).split('::')[1];
        const matchedPrice = Math.max(0, roundCurrency(Number(matchedPriceRaw) || 0));
        nextTokens = existingTokens.filter((_, idx) => idx !== matchedIndex);
        nextPrice = matchedPrice > 0
          ? Math.max(0, roundCurrency((Number(target.price) || 0) - matchedPrice))
          : undefined;
        wasAdded = false;
      } else {
        // Toggle on: append note and add extra price when configured.
        nextTokens = [...existingTokens, noteToken];
        nextPrice = extraPrice > 0 ? roundCurrency((Number(target.price) || 0) + extraPrice) : undefined;
      }
      await fetch(`${API}/orders/${orderId}/items/${orderItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: nextTokens.length > 0 ? nextTokens.join(', ') : null,
          ...(nextPrice !== undefined ? { price: nextPrice } : {})
        })
      });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
      return wasAdded;
    },
    [API, currentOrder]
  );

  const removeOrderItem = useCallback(
    async (orderId, itemId) => {
      await fetch(`${API}/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
    },
    [API]
  );

  const updateOrderItemQuantity = useCallback(
    async (orderId, itemId, quantity) => {
      const patchRes = await fetch(`${API}/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({ error: patchRes.statusText }));
        console.error('updateOrderItemQuantity', err);
        return;
      }
      const res = await fetch(`${API}/orders`);
      if (!res.ok) return;
      const list = await res.json().catch(() => []);
      setOrders(list);
    },
    [API]
  );

  const setOrderStatus = useCallback(
    async (orderId, status, options = {}) => {
      const body = { status };
      if (status === 'paid' && options?.paymentBreakdown && typeof options.paymentBreakdown === 'object') {
        body.paymentBreakdown = options.paymentBreakdown;
      }
      if (options?.customerName !== undefined) {
        body.customerName = options.customerName;
      }
      if (options?.userId !== undefined) {
        body.userId = options.userId;
      }
      if (options?.itemBatchBoundaries !== undefined) {
        body.itemBatchBoundaries = options.itemBatchBoundaries;
      }
      if (options?.itemBatchMeta !== undefined) {
        body.itemBatchMeta = options.itemBatchMeta;
      }
      await fetch(`${API}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (status === 'in_planning' || status === 'paid') {
        fetchInPlanningCount();
      }
      if (status === 'in_waiting') {
        fetchInWaitingCount();
      }
      if (status === 'paid') {
        fetchWebordersCount();
      }
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
    },
    [API, fetchInPlanningCount, fetchInWaitingCount, fetchWebordersCount]
  );

  const createOrder = useCallback(async () => {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: posJsonHeaders(),
      body: JSON.stringify({})
    });
    const created = await safeJson(res);
    if (created?.id) setOrders((prev) => [created, ...prev]);
    return created || null;
  }, [API]);

  /** Link the active (or focused open) order to an existing customer, or clear. Refetches orders list. */
  const setOrderCustomer = useCallback(
    async (customerId) => {
      let orderId = currentOrder?.id;
      if (!orderId) {
        const created = await createOrder();
        orderId = created?.id;
      }
      if (!orderId) return false;
      const body =
        customerId == null || customerId === ''
          ? { customerId: null }
          : { customerId: String(customerId).trim() };
      const patchRes = await fetch(`${API}/orders/${orderId}`, {
        method: 'PATCH',
        headers: posJsonHeaders(),
        body: JSON.stringify(body)
      });
      if (!patchRes.ok) return false;
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
      return true;
    },
    [API, currentOrder, createOrder]
  );

  const removeAllOrders = useCallback(async () => {
    await fetch(`${API}/orders`, { method: 'DELETE' });
    await fetch(`${API}/orders`, {
      method: 'POST',
      headers: posJsonHeaders(),
      body: JSON.stringify({})
    });
    const res = await fetch(`${API}/orders`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setOrders(data);
  }, [API]);

  /** Match POS catalog cache (all categories) for USB barcode wedge on sales screen. */
  const findProductByBarcode = useCallback((raw) => {
    const needle = String(raw ?? '').trim();
    if (!needle) return null;
    const cache = productsByCategoryIdRef.current;
    for (const cid of Object.keys(cache)) {
      const list = cache[cid];
      if (!Array.isArray(list)) continue;
      for (const p of list) {
        if (!p || p.id == null) continue;
        const bc = p.barcode != null && p.barcode !== '' ? String(p.barcode).trim() : '';
        if (bc && bc === needle) return p;
      }
    }
    return null;
  }, []);

  const markOrderPrinted = useCallback(
    async (orderId) => {
      const order = await safeJson(
        await fetch(`${API}/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printed: true })
        })
      );
      if (order?.id) {
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === orderId);
          if (idx >= 0) return [...prev.slice(0, idx), order, ...prev.slice(idx + 1)];
          return prev;
        });
      }
    },
    [API]
  );

  const removeOrder = useCallback(
    async (orderId) => {
      await fetch(`${API}/orders/${orderId}`, { method: 'DELETE' });
      const res = await fetch(`${API}/orders`);
      const data = await safeJson(res);
      if (Array.isArray(data)) setOrders(data);
      const countRes = await fetch(`${API}/weborders/count`);
      const countData = await safeJson(countRes);
      if (countData && typeof countData.count === 'number') setWebordersCount(countData.count);
      const planRes = await fetch(`${API}/orders/in-planning/count`);
      const planData = await safeJson(planRes);
      if (planData && typeof planData.count === 'number') setInPlanningCount(planData.count);
      const waitRes = await fetch(`${API}/orders/in-waiting/count`);
      const waitData = await safeJson(waitRes);
      if (waitData && typeof waitData.count === 'number') setInWaitingCount(waitData.count);
    },
    [API]
  );

  return {
    categories,
    products,
    selectedCategoryId,
    setSelectedCategoryId,
    currentOrder,
    orders,
    webordersCount,
    weborders,
    inPlanningCount,
    inWaitingCount,
    fetchInWaitingCount,
    loading,
    fetchWeborders,
    addItemToOrder,
    removeOrderItem,
    updateOrderItemQuantity,
    setOrderStatus,
    setOrderCustomer,
    markOrderPrinted,
    createOrder,
    removeOrder,
    removeAllOrders,
    fetchCategories,
    fetchProducts,
    refetchCategoriesProducts,
    loadPosFullCatalog,
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    historyOrders,
    fetchOrderHistory,
    fetchSubproductsForProduct,
    savedPositioningLayoutByCategory,
    fetchSavedPositioningLayout,
    savedPositioningColorByCategory,
    fetchSavedPositioningColors,
    savedFunctionButtonsLayout,
    fetchSavedFunctionButtonsLayout,
    appendSubproductNoteToItem,
    findProductByBarcode
  };
}
