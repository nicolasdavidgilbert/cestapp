# Cesta++ (Next.js + InsForge)

Aplicacion para gestionar listas de compra colaborativas con:
- autenticacion por email/OAuth
- catalogo de productos con historial de precios
- comparticion de listas en tiempo real
- auditoria de actividad preparada para analitica futura

## Para que sirve
Cesta++ resuelve 3 cosas:
1. Organizar compras por listas y productos.
2. Colaborar entre varios usuarios en una misma lista.
3. Guardar trazabilidad de cambios (auditoria) para explotar datos despues.

## Como funciona (alto nivel)
1. El usuario se registra/inicia sesion.
2. Crea listas en `/dashboard`.
3. Entra en una lista (`/dashboard/[id]`) y agrega productos/cantidades.
4. Los cambios se sincronizan por Realtime (`list:*`, `user:*:lists`).
5. Los cambios de negocio disparan eventos de auditoria en DB.

## Rutas principales
- `/` landing
- `/sign-in` login
- `/sign-up` registro + verificacion por codigo
- `/dashboard` listas propias/compartidas
- `/dashboard/[id]` detalle de lista colaborativa
- `/products` catalogo de productos + historial de precios
- `/invite/[token]` aceptacion de invitaciones
- `/dashboard/profile` perfil de usuario

## Stack tecnico
- Next.js `16.3.0` (App Router)
- React `19.2.4`
- `@insforge/sdk` `1.5.2` para auth, database y realtime
- Tailwind CSS `4`

## Datos y modelos (DB)
### Dominio principal
- `shopping_lists`
- `shopping_list_items`
- `products`
- `price_history`
- `list_shares`
- `list_invite_links`

### Auth
- usuarios en `auth.users` (no en `public`)

### Auditoria
- `public.user_activity_events` (particionada por mes)
- `public.user_activity_events_enriched` (vista para analitica)

Detalle tecnico completo:
- [auditoria-tecnica.md](docs/auditoria-tecnica.md)

## Variables de entorno
Crea `.env.local`:

```bash
NEXT_PUBLIC_INSFORGE_URL=https://<tu-app>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<tu-anon-key>
NEXT_PUBLIC_APP_URL=https://<origen-publico-de-cesta>
AUTH_RATE_LIMIT_SECRET=<secreto-aleatorio-de-al-menos-32-caracteres>
```

`AUTH_RATE_LIMIT_SECRET` es una variable exclusiva del servidor y debe ser distinta en cada entorno. La migración `sql/add-auth-rate-limiting.sql` guarda en PostgreSQL únicamente su resumen SHA-256; nunca publiques el secreto ni lo prefijes con `NEXT_PUBLIC_`. Este limitador protege las rutas propias `/api/auth/*`, pero no sustituye los controles que InsForge debe aplicar a su endpoint de autenticación directo.

`NEXT_PUBLIC_APP_URL` fija el origen utilizado en redirects y comprobaciones de autenticación. Debe ser un origen HTTPS sin ruta, consulta ni fragmento; por ejemplo, `https://cestapp.insforge.site` en producción o `https://saturno.taile4db48.ts.net:8443` en el backend de pruebas. La aplicación ignora `Host` y `X-Forwarded-*` para estas decisiones. `NEXT_PUBLIC_SITE_URL` se conserva únicamente como alias de compatibilidad.

En `pnpm dev` se permite también un origen HTTP de loopback (`localhost`, `127.0.0.1` o `[::1]`); los builds de producción exigen HTTPS.

## Modelo de sesion

- Web y PWA usan la integración SSR oficial de InsForge. El SDK escribe un access token de corta duración y un refresh token `HttpOnly` en cookies del origen de Cesta++.
- La comprobación y renovación web pasa por `/api/auth/refresh`; el refresh token no se devuelve al JavaScript de la página.
- Google OAuth usa PKCE y completa el canje en el servidor mediante `/api/auth/oauth/callback`, sin tokens en la URL.
- Android mantiene el refresh token cifrado con Android Keystore y no depende de las cookies del WebView.

Con `@insforge/sdk` `1.5.2`, no uses directamente `auth.getCurrentUser()` para hidratar la sesión del `createBrowserClient`: esa función heredada intenta renovar contra el dominio de InsForge. En esta aplicación la hidratación utiliza la ruta SSR local; el cliente de navegador queda para Database y Realtime.

## Puesta en marcha (local)
1. Instalar dependencias:
```bash
pnpm install
```

2. Levantar en desarrollo:
```bash
pnpm dev
```

3. Abrir:
`http://localhost:3000`

## Scripts (pnpm)
- `pnpm dev` desarrollo
- `pnpm build` build produccion
- `pnpm start` ejecutar build
- `pnpm lint` lint del proyecto
- `pnpm cap:add:android` crea proyecto nativo Android (Capacitor)
- `pnpm cap:sync:android` sincroniza cambios de config/assets a Android
- `pnpm cap:open:android` abre el proyecto en Android Studio
- `pnpm apk:debug` genera APK debug (`android/app/build/outputs/apk/debug`)
- `pnpm apk:release` genera APK release (requiere firma)
- `pnpm aab:release` genera AAB release para Play Store (requiere firma)

## Android (Capacitor)
La app Next.js se empaqueta como app Android usando un contenedor nativo con WebView.

Configuracion actual:
- `capacitor.config.ts` apunta a `https://cestapp.insforge.site`
- La app movil carga la version publicada (no `output: 'export'`)

Requisitos locales para compilar:
- Android Studio + Android SDK
- Java 21 (Capacitor 8 genera Android con `sourceCompatibility`/`targetCompatibility` en 21)

Flujo rapido:
1. `pnpm cap:sync:android`
2. `pnpm apk:debug` (o abrir Android Studio con `pnpm cap:open:android`)
3. Para Play Store: `pnpm aab:release` y firmar release en Android Studio/Gradle

## Bootstrap y migraciones SQL
Scripts disponibles en `sql/`:
- `list-sharing-realtime.sql` setup principal de comparticion + realtime + auditoria base
- `fix-products-rls.sql` hardening de RLS en productos/precios
- `improve-activity-audit.sql` mejora de auditoria (particiones, indices, mantenimiento)
- `add-auth-rate-limiting.sql` limita de forma distribuida los intentos de autenticacion

Ejemplo de ejecucion:

```bash
pnpm dlx @insforge/cli db query -- "$(cat sql/list-sharing-realtime.sql)"
pnpm dlx @insforge/cli db query -- "$(cat sql/fix-products-rls.sql)"
pnpm dlx @insforge/cli db query -- "$(cat sql/improve-activity-audit.sql)"
```

## Realtime y colaboracion
La app publica y escucha eventos para refrescar vistas de listas:
- canal de lista: `list:<listId>`
- canal de panel: `user:<userId>:lists`

Esto permite que cambios de un usuario se reflejen en otros clientes conectados.

## Notas operativas
- `redirectTo` en auth debe ser URL absoluta.
- El callback web exacto debe estar en `allowedRedirectUrls` de InsForge. En pruebas es `https://saturno.taile4db48.ts.net:8443/api/auth/oauth/callback`.
- La auditoria actualmente no borra historico automaticamente (retencion desactivada).
- Si falta una particion mensual de auditoria, existe particion `default` como fallback.
