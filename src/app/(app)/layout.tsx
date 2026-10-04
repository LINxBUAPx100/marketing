import { Marco } from "@/components/marco/marco";
import { requerirSesion } from "@/lib/auth";
import { NAVEGACION } from "@/lib/navegacion";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await requerirSesion();

  // Solo se mandan al cliente los permisos que usa el menú.
  const permisosMenu = NAVEGACION.flatMap((g) => g.items)
    .map((i) => i.permiso)
    .filter((p): p is string => !!p && sesion.puede(p));

  return (
    <Marco
      usuario={{ id: sesion.usuario.id, nombre: sesion.usuario.nombre, correo: sesion.usuario.correo, rol: sesion.rol.nombre, conComision: sesion.usuario.comisionBp > 0 }}
      negocio={sesion.negocio.nombre}
      sucursales={sesion.sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
      sucursalId={sesion.sucursal?.id ?? null}
      permisos={permisosMenu}
    >
      {children}
    </Marco>
  );
}
