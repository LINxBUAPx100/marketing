"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cerrarSesion, elegirSucursal } from "@/lib/auth";

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}

export async function cambiarSucursal(sucursalId: string) {
  await elegirSucursal(sucursalId);
  revalidatePath("/", "layout");
}
