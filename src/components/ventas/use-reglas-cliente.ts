"use client";

import { useState, useTransition } from "react";
import { reglasCliente } from "@/app/(app)/ventas/acciones";
import type { ReglasPrecio } from "@/lib/ventas/precios";

export type InfoCliente = {
  reglas: ReglasPrecio;
  limiteCredito: number | null;
  diasCredito: number;
  saldo: number;
};

const PUBLICO: InfoCliente = { reglas: { tipoPrecio: "publico", convenio: null }, limiteCredito: null, diasCredito: 0, saldo: 0 };

/** Precios y crédito del cliente elegido. Se piden al servidor cada vez que cambia el cliente. */
export function useReglasCliente<C extends { id: string }>(clienteInicial: C | null, infoInicial: InfoCliente | null) {
  const [cliente, setClienteEstado] = useState<C | null>(clienteInicial);
  const [info, setInfo] = useState<InfoCliente>(infoInicial ?? PUBLICO);
  const [cargando, iniciar] = useTransition();

  const setCliente = (c: C | null) => {
    setClienteEstado(c);
    if (!c) return setInfo(PUBLICO);
    iniciar(async () => {
      const r = await reglasCliente(c.id);
      setInfo(r ?? PUBLICO);
    });
  };

  return { cliente, setCliente, info, cargando };
}
