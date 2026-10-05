// Cola de ventas capturadas sin conexión (solo navegador). Se guardan en IndexedDB y se mandan
// al servidor al volver el internet. El servidor recalcula precios y existencias al recibirlas.

import type { VentaNueva } from "@/app/(app)/ventas/acciones";

export type VentaPendiente = {
  clave: string;
  capturadaEn: string;
  sucursal: string;
  cliente: string | null;
  total: number;
  datos: VentaNueva;
  /** Motivo por el que el servidor la rechazó; se queda hasta que alguien la descarte. */
  error?: string;
};

const BASE = "imprenta-offline";
const ALMACEN = "ventas";
export const EVENTO_COLA = "imprenta:cola-ventas";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: "clave" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function operacion<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(ALMACEN, modo);
      const r = fn(tx.objectStore(ALMACEN));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const avisar = () => window.dispatchEvent(new Event(EVENTO_COLA));

export async function ventasPendientes(): Promise<VentaPendiente[]> {
  if (typeof indexedDB === "undefined") return [];
  const todas = await operacion("readonly", (s) => s.getAll() as IDBRequest<VentaPendiente[]>);
  return todas.sort((a, b) => a.capturadaEn.localeCompare(b.capturadaEn));
}

export async function guardarPendiente(v: VentaPendiente) {
  await operacion("readwrite", (s) => s.put(v));
  avisar();
}

export async function quitarPendiente(clave: string) {
  await operacion("readwrite", (s) => s.delete(clave));
  avisar();
}

/** Un error de red al llamar al servidor (sin internet o servidor caído), no un rechazo. */
export const esErrorDeRed = (e: unknown) => !navigator.onLine || e instanceof TypeError || (e instanceof Error && /fetch|network|conex/i.test(e.message));
