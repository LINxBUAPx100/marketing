"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Elige el cliente y abre su editor de convenio. */
export function NuevoConvenio({ clientes }: { clientes: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState("");
  return (
    <div className="flex gap-2">
      <select
        id="cliente-convenio"
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
        aria-label="Cliente para el convenio"
        className="border-input bg-background h-8 max-w-56 rounded-lg border px-2.5 text-sm"
      >
        <option value="">Elige cliente…</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <Button disabled={!clienteId} onClick={() => router.push(`/convenios/${clienteId}`)}>
        <Plus /> Nuevo convenio
      </Button>
    </div>
  );
}
