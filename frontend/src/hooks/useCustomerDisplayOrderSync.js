import { useCallback, useEffect, useRef, useState } from 'react';
import { openCustomerDisplayWindow, closeCustomerDisplayWindow } from '../lib/customerDisplayWindow.js';
import { POS_PRICE_DISPLAY_STORAGE_KEY, POS_PRICE_DISPLAY_SETTINGS_CHANGED_EVENT } from '../lib/posPriceDisplaySettings.js';

const CHANNEL_NAME = 'pos-customer-display-order-v1';
const LS_SNAPSHOT_KEY = 'pos_customer_display_order_v1';
const LS_CMD_KEY = 'pos_customer_display_cmd_v1';

const MSG_TICKET = 'ORDER_TICKET_SYNC';
const MSG_CLOSE = 'CMD_CLOSE';

function canUseBroadcastChannel() {
  return typeof BroadcastChannel !== 'undefined';
}

function writeLocalStorageSnapshot(payload) {
  try {
    const envelope = { v: 1, type: MSG_TICKET, ts: Date.now(), payload };
    localStorage.setItem(LS_SNAPSHOT_KEY, JSON.stringify(envelope));
  } catch {
    /* quota / private mode */
  }
}

function writeLocalStorageCloseCmd() {
  try {
    localStorage.setItem(LS_CMD_KEY, JSON.stringify({ v: 1, type: MSG_CLOSE, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

function readSnapshotFromStorage() {
  try {
    const raw = localStorage.getItem(LS_SNAPSHOT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.type === MSG_TICKET && o.payload) return o.payload;
  } catch {
    /* ignore */
  }
  return null;
}

function parseStorageEnvelope(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Publishes order ticket snapshots to other tabs/windows (BroadcastChannel + localStorage fallback).
 * @param {{ enabled: boolean, payload: object | null }} params
 */
export function useCustomerDisplayOrderPublisher({ enabled, payload }) {
  const bcRef = useRef(null);
  const lastSerializedRef = useRef('');

  useEffect(() => {
    if (!enabled || !canUseBroadcastChannel()) return undefined;
    try {
      bcRef.current = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      bcRef.current = null;
    }
    return () => {
      try {
        bcRef.current?.close();
      } catch {
        /* ignore */
      }
      bcRef.current = null;
    };
  }, [enabled]);

  const publish = useCallback((body) => {
    const envelope = { v: 1, type: MSG_TICKET, ts: Date.now(), payload: body };
    if (bcRef.current) {
      try {
        bcRef.current.postMessage(envelope);
      } catch {
        /* ignore */
      }
    }
    writeLocalStorageSnapshot(body);
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastSerializedRef.current = '';
      return;
    }
    const serialized = JSON.stringify(payload ?? null);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    publish(payload ?? { orderId: null, customerName: null, lines: [], total: 0, currency: 'EUR' });
  }, [enabled, payload, publish]);

}

/** Notify customer windows to close (BroadcastChannel + localStorage). */
export function broadcastCustomerDisplayClose() {
  if (canUseBroadcastChannel()) {
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ v: 1, type: MSG_CLOSE, ts: Date.now() });
      ch.close();
    } catch {
      /* ignore */
    }
  }
  writeLocalStorageCloseCmd();
}

/**
 * Subscribes to ticket snapshots (customer display window).
 * @returns {{ ticket: object | null }}
 */
export function useCustomerDisplayOrderSubscriber() {
  const [ticket, setTicket] = useState(() => readSnapshotFromStorage());

  const applyTicket = useCallback((body) => {
    if (body && typeof body === 'object') setTicket(body);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_SNAPSHOT_KEY && e.newValue) {
        const o = parseStorageEnvelope(e.newValue);
        if (o?.type === MSG_TICKET && o.payload) applyTicket(o.payload);
      }
      if (e.key === LS_CMD_KEY && e.newValue) {
        const o = parseStorageEnvelope(e.newValue);
        if (o?.type === MSG_CLOSE) {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyTicket]);

  useEffect(() => {
    if (!canUseBroadcastChannel()) return undefined;
    let ch;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return undefined;
    }
    const onMessage = (ev) => {
      const data = ev?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === MSG_TICKET && data.payload) applyTicket(data.payload);
      if (data.type === MSG_CLOSE) {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }
    };
    ch.onmessage = onMessage;
    return () => {
      try {
        ch.onmessage = null;
        ch.close();
      } catch {
        /* ignore */
      }
    };
  }, [applyTicket]);

  return { ticket };
}

/**
 * Reactive “two-line display” / extend price display flag from localStorage.
 */
export function useExtendPriceDisplayEnabled() {
  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(POS_PRICE_DISPLAY_STORAGE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      return String(s?.type || '') === 'two-line-display';
    } catch {
      return false;
    }
  }, []);

  const [on, setOn] = useState(() => read());

  useEffect(() => {
    const sync = () => setOn(read());
    const onStorage = (e) => {
      if (e.key === POS_PRICE_DISPLAY_STORAGE_KEY || e.key == null) sync();
    };
    window.addEventListener(POS_PRICE_DISPLAY_SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(POS_PRICE_DISPLAY_SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [read]);

  return on;
}

/**
 * Opens the secondary window when extend mode is on (logged-in POS); closes and signals when off.
 */
export function useCustomerDisplayWindowLifecycle({ userPresent, extendEnabled }) {
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    const active = Boolean(userPresent && extendEnabled);
    const prev = prevEnabledRef.current;
    prevEnabledRef.current = active;

    if (!userPresent) {
      broadcastCustomerDisplayClose();
      closeCustomerDisplayWindow();
      return;
    }

    if (active) {
      openCustomerDisplayWindow();
      return;
    }

    if (prev && !active) {
      broadcastCustomerDisplayClose();
      closeCustomerDisplayWindow();
    }
  }, [userPresent, extendEnabled]);
}

export { useCustomerDisplayOrderPublisher as useBroadcastOrderChannel };
