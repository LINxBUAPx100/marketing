// Service worker de la imprenta: permite instalar el sistema como app y cobrar sin internet.
// - Archivos de /_next/static: se guardan la primera vez (no cambian nunca).
// - Punto de venta (/ventas/nueva): red primero; sin conexión se usa la última copia guardada.
// - Cualquier otra página sin conexión: aviso de /sin-conexion.html.
// Solo el punto de venta se guarda: el resto de las páginas tiene datos de clientes y no debe quedarse en el equipo.

const VERSION = "v1";
const ESTATICOS = `estaticos-${VERSION}`;
const PAGINAS = `paginas-${VERSION}`;
const PAGINAS_SIN_CONEXION = ["/ventas/nueva"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.addAll(["/sin-conexion.html", "/icon/192"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== ESTATICOS && c !== PAGINAS).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

const mismoOrigen = (url) => url.origin === self.location.origin;
const esEstatico = (url) => mismoOrigen(url) && url.pathname.startsWith("/_next/static/");
const guardable = (url) => mismoOrigen(url) && PAGINAS_SIN_CONEXION.includes(url.pathname);

async function primeroCache(request) {
  const guardado = await caches.match(request);
  if (guardado) return guardado;
  const respuesta = await fetch(request);
  if (respuesta.ok) (await caches.open(ESTATICOS)).put(request, respuesta.clone());
  return respuesta;
}

async function primeroRed(request) {
  const url = new URL(request.url);
  try {
    const respuesta = await fetch(request);
    // Solo se guarda la página real, no la redirección al inicio de sesión.
    if (respuesta.ok && !respuesta.redirected && guardable(url)) (await caches.open(PAGINAS)).put(url.pathname, respuesta.clone());
    return respuesta;
  } catch {
    if (guardable(url)) {
      const guardada = await caches.match(url.pathname);
      if (guardada) return guardada;
    }
    return (await caches.match("/sin-conexion.html")) ?? Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (esEstatico(url)) e.respondWith(primeroCache(request));
  else if (request.mode === "navigate") e.respondWith(primeroRed(request));
});

// La página avisa qué archivos usó para que también queden guardados (los que cargó antes de que existiera este worker).
self.addEventListener("message", (e) => {
  // Al cerrar sesión se borra la copia del punto de venta.
  if (e.data?.tipo === "olvidar") return e.waitUntil(caches.delete(PAGINAS));
  if (e.data?.tipo !== "guardar") return;
  const urls = (e.data.urls ?? []).map((u) => new URL(u, self.location.origin)).filter(esEstatico);
  e.waitUntil(
    caches.open(ESTATICOS).then(async (c) => {
      for (const u of urls) if (!(await c.match(u.href))) await c.add(u.href).catch(() => {});
      if (e.data.pagina && guardable(new URL(e.data.pagina, self.location.origin))) {
        const r = await fetch(e.data.pagina, { credentials: "same-origin" }).catch(() => null);
        if (r?.ok && !r.redirected) await (await caches.open(PAGINAS)).put(new URL(e.data.pagina, self.location.origin).pathname, r);
      }
    }),
  );
});
