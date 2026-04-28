import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/lib/api";

let socketSingleton: Socket | null = null;

export function getRealtimeSocket(): Socket {
  if (socketSingleton) return socketSingleton;
  const base = getApiBaseUrl();
  let origin = "http://127.0.0.1:4000";
  try {
    origin = new URL(base).origin;
  } catch {
    /* keep fallback */
  }
  socketSingleton = io(origin, { path: "/socket.io" });
  return socketSingleton;
}
