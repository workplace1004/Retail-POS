import { Platform } from 'react-native';

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getDefaultBaseUrl() {
  // Android emulator cannot resolve localhost to host machine.
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://127.0.0.1:4000';
}

let apiBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_POS_API_URL || getDefaultBaseUrl());

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function setApiBaseUrl(url) {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) {
    throw new Error('Backend URL is required');
  }
  apiBaseUrl = normalized;
  return apiBaseUrl;
}

export async function fetchProducts() {
  const res = await fetch(`${apiBaseUrl}/api/categories`);
  if (!res.ok) throw new Error(`Load products failed: ${res.status}`);
  const categories = await res.json();

  const products = [];
  for (const category of Array.isArray(categories) ? categories : []) {
    for (const product of Array.isArray(category.products) ? category.products : []) {
      products.push(product);
    }
  }
  return products;
}

export async function fetchCategories() {
  const res = await fetch(`${apiBaseUrl}/api/categories`);
  if (!res.ok) throw new Error(`Load categories failed: ${res.status}`);
  const categories = await res.json();
  return Array.isArray(categories) ? categories : [];
}

export async function fetchPriceGroups() {
  const res = await fetch(`${apiBaseUrl}/api/price-groups`);
  if (!res.ok) throw new Error(`Load price groups failed: ${res.status}`);
  const rows = await res.json();
  if (Array.isArray(rows)) return rows;
  if (Array.isArray(rows?.data)) return rows.data;
  return [];
}

export async function fetchPrinters() {
  const res = await fetch(`${apiBaseUrl}/api/printers`);
  if (!res.ok) throw new Error(`Load printers failed: ${res.status}`);
  const rows = await res.json();
  if (Array.isArray(rows)) return rows;
  if (Array.isArray(rows?.data)) return rows.data;
  return [];
}

export async function updateProduct(productId, payload) {
  const res = await fetch(`${apiBaseUrl}/api/products/${productId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Save failed: ${res.status} ${errorText}`);
  }
  return res.json();
}

export async function createProduct(payload) {
  const res = await fetch(`${apiBaseUrl}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Create failed: ${res.status} ${errorText}`);
  }
  return res.json();
}
