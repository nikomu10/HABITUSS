// =====================================================================
// sw.js · "Service worker" mínimo
// =====================================================================
// Es un pequeño archivo que el navegador exige para permitir "Instalar app".
// A propósito NO guarda copias (caché): así, cada vez que publicamos un cambio
// en Vercel, todos los usuarios reciben la versión nueva automáticamente,
// y la app nunca se queda "pegada" en una versión vieja.
// =====================================================================

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Deja pasar todas las peticiones tal cual (sin interferir)
self.addEventListener("fetch", () => {});
