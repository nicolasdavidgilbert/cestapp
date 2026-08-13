# Auditoría de seguridad de Cesta++

**Fecha:** 9 de agosto de 2026  
**Rama revisada:** `android`  
**Componentes:** Next.js, InsForge/PostgreSQL, Realtime, PWA y Android/Capacitor

## Resumen ejecutivo

La auditoría encontró vulnerabilidades reales en los controles de acceso de la base de datos, los canales de tiempo real y las particiones del historial de actividad. También se detectaron riesgos importantes en el almacenamiento de la sesión de Android y dependencias de producción desactualizadas.

Los tres problemas que requieren atención prioritaria son:

1. Un usuario autenticado puede añadirse a una lista ajena si conoce su UUID.
2. Algunas particiones futuras del historial permiten lectura y escritura anónima.
3. Los canales Realtime no tienen RLS y permiten escuchar o publicar en canales ajenos conocidos.

La revisión se realizó sin intentar acceder a datos de otros usuarios, sin explotar las vulnerabilidades y sin ejecutar operaciones destructivas.

## Hallazgos críticos

### SEC-01: incorporación no autorizada a listas

**Severidad:** crítica  
**Estado:** ✅ resuelto y verificado en `security-hardening`; pendiente de integrar en producción

La política `list_shares_insert` permite que un usuario cree una participación cuando el campo `user_id` coincide con su propia identidad:

```sql
WITH CHECK (
  user_id = requesting_user_id()
  OR public.user_owns_list(list_id)
);
```

Esta condición no exige una invitación válida ni la autorización del propietario. Si un atacante conoce el UUID de una lista, puede insertar directamente una fila en `list_shares` con su usuario.

El UUID podría conocerse por haber pertenecido anteriormente a la lista, mediante una URL compartida, registros, eventos Realtime o una filtración. Un usuario expulsado también podría volver a añadirse.

**Impacto:** acceso a los datos compartidos y capacidad para modificar los elementos de la lista como editor.

**Evidencia:** `sql/list-sharing-realtime.sql`, política `list_shares_insert`.

**Resolución aplicada (9 de agosto de 2026):**

- `list_shares_insert` ahora se concede únicamente a `authenticated` y exige `user_owns_list(list_id)`; conocer el UUID ya no permite incorporarse.
- Las altas mediante invitación continúan exclusivamente a través de `accept_list_invite`, que valida token, revocación y caducidad como `SECURITY DEFINER`.
- Se corrigió la ambigüedad de `ON CONFLICT (list_id, user_id)` usando la restricción `list_shares_list_id_user_id_key`, para que el flujo autorizado funcione sin relajar RLS.

**Verificación en la rama de pruebas:**

- Antes del cambio, una sesión autenticada ajena consiguió crear la participación sin invitación.
- Después del cambio, el mismo intento fue rechazado por PostgreSQL con código `42501`.
- Una invitación válida creó la participación correctamente.
- El miembro pudo eliminar su propia participación para abandonar la lista.
- Las cuentas y filas sintéticas se eliminaron; las tablas funcionales y el historial volvieron a quedar vacíos.

**Pendiente de producción:** integrar o desplegar esta corrección y repetir las pruebas de aceptación contra el entorno final.

**Corrección recomendada:**

- Eliminar la posibilidad de que un usuario inserte directamente su propia participación.
- Permitir inserciones únicamente al propietario o mediante `accept_list_invite`, después de validar un token activo.
- Mantener la posibilidad de que un usuario elimine su propia participación para abandonar una lista.
- Añadir una prueba RLS que intente incorporarse a una lista conocida sin invitación y deba ser rechazada.

### SEC-02: particiones futuras del historial sin protección

**Severidad:** crítica  
**Estado:** ✅ resuelto y verificado en `security-hardening`; pendiente de integrar en producción

Las particiones siguientes tienen RLS desactivado y cero políticas propias:

```text
user_activity_events_2027_01
user_activity_events_2027_02
```

Los roles `anon` y `authenticated` conservan permisos de `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre ambas tablas.

La función `ensure_user_activity_partition` crea nuevas particiones, pero no activa RLS ni replica la política del padre. Las particiones actuales fueron protegidas posteriormente, mientras que las futuras quedaron abiertas.

**Impacto inmediato:** un atacante anónimo puede insertar eventos falsos con fechas futuras, modificar esos eventos o provocar crecimiento innecesario del historial.

**Impacto futuro:** cuando esas particiones reciban actividad real, un atacante podrá leerla, alterarla o eliminarla directamente.

**Evidencia:** `sql/improve-activity-audit.sql`, función `ensure_user_activity_partition`.

**Resolución aplicada (9 de agosto de 2026):**

- Las 13 particiones existentes tienen ahora RLS y FORCE RLS activos.
- Se revocaron todos los privilegios directos de `anon` y `authenticated` sobre cada partición; los clientes no pueden consultarlas ni modificarlas por su nombre.
- `authenticated` conserva únicamente `SELECT` sobre la tabla padre, donde se aplica `user_activity_events_select`; `anon` no tiene acceso al historial.
- La vista `user_activity_events_enriched` queda limitada a lectura autenticada.
- `ensure_user_activity_partition` usa `search_path = ''` y protege cada partición al crearla: activa y fuerza RLS, revoca permisos cliente y crea `project_admin_policy`.
- Los SQL `improve-activity-audit.sql` y `fix-insforge-security-advisor.sql` recorren todas las particiones mediante catálogo, evitando listas de meses que vuelvan a quedar obsoletas.

**Verificación en la rama de pruebas:**

- La comprobación automática devolvió 13 particiones, 0 sin RLS/FORCE RLS, 0 expuestas a roles cliente y 0 sin política administrativa.
- Se creó `user_activity_events_2099_01` mediante la función: nació con RLS y FORCE RLS, política administrativa y sin `SELECT` ni `INSERT` para `anon` o `authenticated`.
- La partición sintética se eliminó después de la prueba.
- Una llamada legítima a `record_user_activity` siguió insertando correctamente; su evento sintético se eliminó.
- Por HTTP, la lectura e inserción anónimas sobre la tabla padre devolvieron `401` y el acceso directo a la partición no quedó expuesto.
- Antes de la corrección, la base sí mantenía permisos `SELECT`, `INSERT`, `UPDATE` y `DELETE` para ambos roles cliente, aunque la ruta REST directa comprobada respondió `404`.

**Pendiente de producción:** integrar o desplegar la corrección y repetir la consulta automática y las pruebas HTTP en el entorno final.

**Corrección recomendada:**

- Activar y forzar RLS en todas las particiones existentes.
- Revocar los permisos directos de escritura de `anon` y `authenticated`.
- Crear en cada partición una política equivalente a la del padre o impedir que PostgREST exponga las particiones directamente.
- Modificar `ensure_user_activity_partition` para proteger automáticamente cada tabla nueva.
- Añadir una comprobación automática que detecte cualquier partición sin RLS.

## Hallazgos altos

### SEC-03: canales Realtime sin autorización

**Severidad:** alta  
**Estado:** ✅ resuelto y verificado en `security-hardening`; pendiente de integrar en producción

Las tablas `realtime.channels` y `realtime.messages` tienen RLS desactivado. Los patrones activos son:

```text
list:%
user:%:lists
```

Conociendo el UUID de una lista o el identificador de un usuario, otra persona puede intentar suscribirse a su canal o publicar eventos falsos.

**Impacto:** observación de metadatos de actividad, notificaciones falsas, recargas repetidas de la interfaz y denegación de servicio parcial. Los eventos actuales no sustituyen las comprobaciones RLS de la base de datos, pero sí pueden engañar o degradar a los clientes.

**Resolución aplicada (9 de agosto de 2026):**

- `realtime.channels` y `realtime.messages` tienen RLS y FORCE RLS activos.
- `anon` no conserva privilegios sobre ninguna de las dos tablas.
- `authenticated` solo puede seleccionar el patrón necesario para una suscripción autorizada e insertar una publicación que supere su política.
- `list:<uuid>` exige que el usuario sea propietario o miembro de la lista.
- `user:<uuid>:lists` exige que el UUID del canal sea el del usuario autenticado.
- Las publicaciones cliente se limitan a nombres exactos, eventos conocidos, `sender_type = 'user'` y `sender_id` igual a la identidad del JWT.
- Se añadieron triggers `SECURITY DEFINER` con `search_path = ''` para notificar de forma segura a otros usuarios después de compartir, expulsar, renombrar o borrar una lista. Así no es necesario permitir que un cliente publique directamente en el canal personal de otra cuenta.

**Verificación end-to-end en la rama de pruebas:**

- Se usaron tres cuentas sintéticas: propietario, miembro y tercero ajeno, además de una conexión anónima.
- Propietario y miembro pudieron suscribirse a `list:<uuid>`; el tercero y `anon` fueron rechazados.
- El propietario pudo suscribirse a su canal `user:<uuid>:lists`; el tercero fue rechazado.
- Una publicación del propietario en la lista se almacenó; la misma publicación del tercero no se almacenó.
- Los triggers crearon las notificaciones de sistema necesarias para los canales personales.
- Las cuentas, lista, mensajes y eventos sintéticos se eliminaron; también se eliminó la función administrativa temporal usada únicamente para limpiar el esquema gestionado.

**Pendiente de producción:** integrar o desplegar la corrección y repetir las pruebas con dos cuentas reales controladas antes de publicar.

**Corrección recomendada:**

- Activar RLS en `realtime.channels` y `realtime.messages`.
- Autorizar `list:<uuid>` solamente a propietarios y miembros de esa lista.
- Autorizar `user:<id>:lists` solamente al propio usuario.
- Restringir la publicación desde el cliente a los casos estrictamente necesarios.
- Rechazar nombres de canal que no coincidan exactamente con los patrones previstos.

### SEC-04: refresh token de Android accesible desde JavaScript

**Severidad:** alta  
**Estado:** ✅ resuelto y verificado en una variante Android de prueba; pendiente de desplegar las rutas nativas y publicar el APK actualizado

La aplicación nativa guarda los tokens de acceso y renovación mediante `document.cookie`. Estas cookies no pueden ser `HttpOnly` porque las escribe y lee JavaScript.

Una vulnerabilidad XSS, una dependencia comprometida o una modificación maliciosa del sitio remoto cargado por Capacitor podría leer el refresh token y reutilizar la sesión desde otro dispositivo.

El manifiesto también contiene `android:allowBackup="true"`, lo que aumenta el riesgo de que datos de sesión terminen en una copia de seguridad, según el dispositivo y la versión de Android.

**Evidencias:**

- `android/app/src/main/java/site/insforge/cestapp/NativeSessionPlugin.java`, almacenamiento cifrado y operaciones de sesión fuera de JavaScript.
- `src/features/auth/services/nativeSessionService.ts` y `src/store/UserContext.tsx`, selección del flujo nativo seguro.
- `app/api/auth/native/*` y `src/services/nativeAuth.ts`, intercambio y renovación de sesión desde el código nativo.
- `android/app/src/main/AndroidManifest.xml` y las reglas XML de backup.

**Corrección recomendada:**

- Guardar el refresh token mediante Android Keystore o un plugin de almacenamiento seguro para Capacitor.
- Mantener el access token solo en memoria cuando sea posible.
- Desactivar backups o definir reglas que excluyan expresamente todo almacenamiento de autenticación.
- Borrar el almacenamiento seguro al cerrar sesión o invalidarse la sesión.

**Resolución aplicada (13 de agosto de 2026):**

- Se añadió el plugin Capacitor `NativeSession`. El refresh token se cifra con AES-256-GCM y una clave no exportable almacenada en Android Keystore; el texto en claro solo existe temporalmente dentro del proceso nativo cuando se usa.
- El plugin realiza el login, registro, verificación, canje OAuth, renovación y cierre de sesión contra rutas Next.js exclusivas para el cliente nativo. El puente hacia JavaScript devuelve únicamente el usuario y el access token, nunca el refresh token.
- El access token se mantiene en memoria en el WebView. La web y la PWA conservan su flujo independiente mediante cookies `HttpOnly`, por lo que el cambio no sustituye ni debilita su sesión.
- Las rutas `/api/auth/native/*` limitan el cuerpo a 16 KiB, desactivan el almacenamiento en caché y rechazan solicitudes que presenten contexto de navegador. InsForge sigue validando credenciales y emitiendo los tokens; estas rutas actúan como intermediario de confianza para que el refresh token llegue directamente al plugin nativo.
- Al actualizar desde una versión anterior, el plugin migra la cookie antigua directamente desde `CookieManager` al almacén cifrado y elimina las cookies de autenticación heredadas sin exponerlas a JavaScript.
- El cierre de sesión y los errores de clave o datos cifrados eliminan el estado local seguro. El manifiesto usa `android:allowBackup="false"` y reglas de extracción que excluyen expresamente el almacén de sesión.
- Se mantiene temporalmente un flujo de compatibilidad para APK antiguos que todavía no incluyen el plugin. Las versiones antiguas continúan teniendo el riesgo original hasta que los usuarios actualicen; este fallback deberá retirarse después de una adopción razonable del nuevo APK.

**Verificación realizada:**

- TypeScript, ESLint dirigido, build de Next.js, sincronización de Capacitor, lint de Android y compilación del APK finalizaron correctamente.
- Se instaló una variante con identificador separado en un móvil Android real, sin reemplazar la aplicación normal. La variante cargó el frontend local por HTTPS mediante `https://saturno.taile4db48.ts.net:8443`, apuntando al puerto 3100, y usó el backend de pruebas `security-hardening`.
- Tras iniciar sesión, el almacén privado contenía únicamente el ciphertext y el IV; no aparecieron cookies de autenticación ni la clave antigua en `localStorage` o `sessionStorage`.
- Después de forzar la detención y arrancar en frío, la aplicación recuperó la sesión y abrió `/dashboard`.
- Después de cerrar sesión, abrió `/sign-in`, desaparecieron ciphertext e IV y un nuevo arranque continuó desconectado.
- La migración se probó con un valor sintético: se creó el almacenamiento cifrado, se retiró la cookie antigua y después se eliminó por completo el dato de prueba.
- Las rutas nativas devolvieron `403` sin la identificación nativa o al simular un origen de navegador, y `400` ante un cuerpo nativo inválido.

**Pendiente para producción:** desplegar primero las rutas Next.js, comprobarlas en `https://cestapp.insforge.site`, publicar el APK actualizado y vigilar la adopción antes de eliminar el fallback para versiones antiguas.

### SEC-05: versión vulnerable de Next.js

**Severidad:** alta  
**Estado:** ✅ resuelto y verificado localmente; pendiente de desplegar en producción

El proyecto utilizaba Next.js `16.2.3`. El registro de vulnerabilidades informaba de varias incidencias corregidas en versiones posteriores, incluidas denegaciones de servicio relacionadas con React Server Components.

Algunos avisos de bypass de Middleware no son alcanzables actualmente porque el proyecto no tiene `middleware.ts` ni `proxy.ts`. Sin embargo, las vulnerabilidades generales del App Router y de RSC justifican la actualización.

**Corrección recomendada:**

- Actualizar como mínimo a Next.js `16.2.11` o a una versión posterior compatible.
- Leer primero la guía de actualización incluida en `node_modules/next/dist/docs/`.
- Actualizar `next` y `eslint-config-next` juntos.
- Ejecutar lint, build y pruebas de las rutas API después de actualizar.

**Resolución aplicada (13 de agosto de 2026):**

- Se actualizaron `next` y `eslint-config-next` conjuntamente a la versión estable exacta `16.3.0`, manteniendo React `19.2.4` y el resto de APIs de la aplicación sin cambios.
- Se fijó transitivamente `@babel/core` en `7.29.6`. `styled-jsx` lo detecta como peer opcional y la resolución anterior `7.29.0` conservaba un aviso bajo; el parche no modifica ninguna interfaz de la aplicación.
- Next instala ahora PostCSS `8.5.23` y Nanoid `3.3.18`. `pnpm audit --prod` ya no devuelve avisos cuya cadena de dependencia empiece en Next.
- No se ejecutaron codemods: el proyecto ya usaba `cookies()` y parámetros asíncronos, ESLint Flat Config y Turbopack, y no contiene Middleware, Proxy, configuración Webpack ni opciones experimentales que requieran migración.

**Verificación realizada:**

- `pnpm install --frozen-lockfile`, TypeScript, ESLint y `git diff --check` finalizaron correctamente. ESLint mantiene un aviso previo no relacionado en `ProfileForm.tsx`, sin errores.
- El build de producción con Turbopack compiló las 23 rutas, incluidas todas las rutas `/api/auth/*` y `/api/auth/native/*`.
- Google Fonts no es accesible desde esta máquina. Para verificar la compilación sin cambiar la aplicación se utilizó `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` con la copia de Geist incluida en Next, servida temporalmente desde la IP Tailscale de `saturno`. El despliegue deberá repetir el build normal con acceso a Google Fonts o, en un cambio separado, autoalojar la fuente.
- El build se ejecutó en el puerto 3100 y se probó mediante `https://saturno.taile4db48.ts.net:8443`. Inicio, registro, dashboard, perfil, productos, manifiesto PWA e icono dinámico respondieron `200` con el tipo de contenido correcto.
- Las rutas web continuaron rechazando solicitudes sin origen (`403`) y cuerpos inválidos (`400`). Las rutas nativas rechazaron clientes sin identificación (`403`), contextos de navegador (`403`) y cuerpos inválidos (`400`), manteniendo `no-store` y `nosniff`.
- En un móvil real, la variante Android separada completó login, renovación nativa, recarga sin errores de consola, recuperación tras arranque en frío, logout y un segundo arranque desconectado. El refresh token permaneció fuera de cookies y almacenamiento JavaScript.
- El APK debug volvió a compilar correctamente.

**Pendiente para producción:** desplegar el frontend, repetir el build sin el fixture de fuente y ejecutar una prueba breve de autenticación antes de publicar el APK actualizado.

### SEC-06: autenticación expuesta a fuerza bruta y abuso

**Severidad:** alta  
**Estado:** ⚠️ mitigado y verificado en las rutas propias web/Android de `security-hardening`; el endpoint directo administrado por InsForge mantiene una vía de bypass pendiente; política de contraseña aplazada por decisión del proyecto

La configuración de InsForge exige una contraseña mínima de seis caracteres y no requiere números, mayúsculas, minúsculas ni caracteres especiales.

Antes de la corrección, las rutas locales de login, registro, verificación y OAuth no implementaban un límite de intentos, retrasos progresivos ni cuotas por IP/cuenta. InsForge puede disponer de protecciones internas, pero no se encontró documentación de sus valores y la aplicación no debe depender únicamente de límites desconocidos.

**Impacto:** credential stuffing, intentos repetidos contra contraseñas débiles, abuso de códigos de verificación y consumo de recursos.

**Resolución aplicada (13 de agosto de 2026):**

- Todas las rutas web y Android bajo `/api/auth/*` leen ahora JSON de forma incremental, exigen `Content-Type: application/json` y rechazan cuerpos superiores a 16 KiB antes de deserializarlos.
- Se añadió un limitador distribuido en PostgreSQL mediante `sql/add-auth-rate-limiting.sql`, compartido por todas las instancias de Next.js. La protección falla de forma cerrada con `503` si el limitador no está disponible.
- El login permite 20 solicitudes por IP cada 10 minutos y bloquea progresivamente un identificador después de cinco fallos en 30 minutos. Registro, códigos de verificación, inicio/intercambio OAuth y renovación de sesión tienen cuotas independientes acordes a su uso.
- Los fallos de credenciales `4xx` aumentan el contador; los errores internos `5xx` de InsForge no penalizan al usuario. Un login o una verificación correctos eliminan los fallos del identificador.
- Los mensajes de login son uniformes para correo inexistente, contraseña incorrecta y correo sin verificar, reduciendo la enumeración de cuentas.
- La base solo conserva el ámbito, contadores y claves seudonimizadas con HMAC-SHA-256. No almacena correos, IP, contraseñas, tokens ni códigos. Las tablas tienen RLS, carecen de permisos para `anon` y `authenticated`, y eliminan de forma muestreada registros inactivos de más de siete días.
- El secreto del limitador permanece únicamente en la variable de servidor `AUTH_RATE_LIMIT_SECRET`; PostgreSQL guarda solo su resumen SHA-256. El secreto del entorno de pruebas se rotó durante la verificación y producción deberá generar uno distinto.

**Decisión sobre contraseñas:** a petición del proyecto no se añadió ninguna longitud mínima en la aplicación ni se modificó la configuración administrada de InsForge. Se conserva por ahora el mínimo existente de seis caracteres. Este riesgo residual queda aceptado temporalmente y debe revisarse por separado; no afecta al funcionamiento del nuevo control de intentos.

**Limitación residual confirmada:** InsForge publica `POST /api/auth/sessions` en el host del backend y su documentación permite llamarlo directamente, sin pasar por `/api/auth/sign-in`. Se enviaron seis credenciales inválidas consecutivas para una cuenta sintética inexistente contra `security-hardening`: los seis intentos devolvieron `401`, mientras que el gateway propio bloquea desde el quinto con `429`. Esto no demuestra que InsForge carezca de cualquier límite a umbrales superiores, pero sí demuestra que el control de la aplicación puede omitirse y que no existe un límite equivalente al configurado aquí. Como el endpoint pertenece al servicio gestionado, cerrar esta vía requiere una función soportada por InsForge, una regla de gateway/WAF delante de ese endpoint o cambiar de arquitectura/proveedor; no puede solucionarse únicamente desde estas rutas Next.js.

**Verificación realizada:**

- Por HTTPS en `saturno`, tanto web como Android devolvieron `401` uniforme en los cuatro primeros intentos inválidos y `429` en el quinto y posteriores. El bloqueo incluyó `Retry-After`, `Cache-Control: no-store`, `Pragma: no-cache` y `X-Content-Type-Options: nosniff`.
- Las rutas web rechazaron solicitudes sin un origen permitido (`403`), contenido no JSON (`415`), JSON inválido (`400`) y un cuerpo de 17.000 bytes (`413`). Las rutas Android rechazaron clientes sin su marcador nativo (`403`), contextos con `Origin` de navegador (`403`) y JSON inválido (`400`).
- Inicio, pantalla de acceso y manifiesto PWA siguieron respondiendo `200` mediante `https://saturno.taile4db48.ts.net:8443`, sin cambiar ninguna otra ruta de Tailscale.
- TypeScript, `git diff --check`, ESLint sin errores, build de producción de las 23 rutas de Next.js y build del APK debug finalizaron correctamente. Persiste únicamente el aviso de lint previo y no relacionado de `ProfileForm.tsx`.
- Los contadores sintéticos del limitador propio se eliminaron del backend de pruebas al terminar. Los intentos directos solo usaron un correo inexistente y no crearon usuarios ni datos funcionales.

**Pendiente de producción:** solicitar a InsForge el límite efectivo y una forma soportada de configurarlo o restringir el endpoint directo. Además, desplegar las rutas Next.js, aplicar `sql/add-auth-rate-limiting.sql`, configurar un `AUTH_RATE_LIMIT_SECRET` nuevo y exclusivo del entorno y guardar únicamente su SHA-256 en `app_security.auth_rate_limit_config`. Después deben repetirse las pruebas de login correcto, bloqueo, recuperación y bypass directo antes de publicar el frontend o un APK que dependa de estas rutas.

## Hallazgos medios

### SEC-07: Clerk vulnerable instalado pero sin utilizar

**Severidad:** media como riesgo actual; el aviso del paquete es crítico  
**Estado:** ✅ resuelto y verificado localmente; pendiente de desplegar en producción

`@clerk/nextjs` estaba instalado en la versión `7.1.0`, afectada por un bypass de protección basado en Middleware. No se encontraron importaciones ni uso de Clerk en el proyecto, por lo que el bypass concreto no parecía alcanzable.

Aunque no participaba en la autenticación, la dependencia aumentaba la superficie de suministro y arrastraba otros paquetes vulnerables.

**Resolución aplicada el 13 de agosto de 2026:**

- Se eliminó `@clerk/nextjs` de `package.json` y se regeneró `pnpm-lock.yaml`.
- La eliminación retiró 13 paquetes en total: Clerk y sus 12 dependencias transitivas, incluidas `@clerk/backend`, `@clerk/react`, `@clerk/shared` y `js-cookie`.
- Se confirmó que no existen importaciones, proveedores, middleware ni configuración de Clerk. La autenticación continúa utilizando exclusivamente InsForge y las rutas locales `/api/auth/*`.
- `pnpm audit --prod` bajó de 24 a 17 avisos: desaparecieron 2 críticos y 5 altos, sin avisos restantes asociados a Clerk o `js-cookie`.

**Verificación realizada:** instalación con lockfile congelado, TypeScript, lint sin errores, build de las 23 rutas de Next.js, smoke test web y de las protecciones de autenticación mediante HTTPS en `saturno`, y build del APK de depuración. El único aviso de lint es uno preexistente y no relacionado en `ProfileForm.tsx`.

### SEC-08: cabeceras HTTP de seguridad incompletas

**Severidad:** media  
**Estado:** ✅ resuelto y verificado localmente; pendiente de desplegar y confirmar en producción

El despliegue envía HSTS, pero no se observaron las siguientes protecciones:

- Content Security Policy.
- `frame-ancestors` o `X-Frame-Options`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy`.
- `Permissions-Policy`.

**Impacto:** una futura vulnerabilidad XSS tendría mayor alcance; la aplicación puede cargarse dentro de un iframe y el navegador dispone de menos límites defensivos.

**Resolución aplicada (13 de agosto de 2026):**

- `next.config.ts` aplica las cabeceras a todas las rutas, incluidos documentos, recursos y API.
- La CSP limita por defecto los recursos al mismo origen. `connect-src` autoriza únicamente la propia aplicación y los orígenes HTTPS/WebSocket derivados de `NEXT_PUBLIC_INSFORGE_URL`, conservando consultas y Realtime sin permitir conexiones arbitrarias.
- `img-src` admite recursos propios, `data:`, `blob:`, el backend configurado y los hosts de avatar de Google y GitHub. Fuentes, manifiesto y workers quedan restringidos al mínimo utilizado por la aplicación.
- Se bloquean plugins y contenido multimedia, iframes, inclusión de la aplicación dentro de marcos, cambios de URL base y envío de formularios a otros orígenes. En producción también se actualizan solicitudes inseguras a HTTPS.
- `script-src` no permite `eval` en producción ni scripts de terceros. Se conserva temporalmente `'unsafe-inline'` para los bloques de hidratación que Next.js genera en las páginas estáticas, mientras `script-src-attr 'none'` impide manejadores inline como `onclick`. Una CSP con nonce exigiría renderizar todas las páginas dinámicamente y eliminaría la optimización estática actual; endurecer esta excepción queda como mejora futura separada.
- Se añadieron `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-Permitted-Cross-Domain-Policies: none` y HSTS de un año en producción.
- La URL de InsForge se analiza como URL y debe ser HTTPS en builds de producción. Valores ausentes, con credenciales embebidas o con protocolos inseguros hacen fallar la configuración en vez de generar una CSP manipulable.

**Verificación realizada:**

- `pnpm build` normal, sin fixture de Google Fonts, compiló correctamente las 23 rutas y mantuvo estáticas las páginas que ya lo eran.
- Por `https://saturno.taile4db48.ts.net:8443`, inicio, acceso, registro, dashboard, productos, manifiesto e icono PWA respondieron `200`. Las cabeceras completas aparecieron tanto en documentos como en respuestas de la API.
- Chromium cargó e hidrató la pantalla de acceso, mantuvo sus estilos, alcanzó el login local (`401` esperado con credenciales sintéticas inexistentes) y abrió el WebSocket de InsForge.
- La misma prueba confirmó que la CSP bloquea una conexión a un origen no autorizado, `eval` y un manejador `onclick` inyectado.
- TypeScript, `git diff --check`, ESLint sin errores y el APK debug finalizaron correctamente. No se utilizó el teléfono; el único aviso de lint sigue siendo el previo y no relacionado de `ProfileForm.tsx`.
- El contador sintético de autenticación se eliminó del backend de pruebas después de la prueba.

**Pendiente de producción:** desplegar el frontend, comprobar las cabeceras en `https://cestapp.insforge.site` y repetir login, OAuth, carga de avatares, Realtime y funcionamiento como PWA instalada antes de dar por cerrado el despliegue.

### SEC-09: validación e integridad insuficientes

**Severidad:** media  
**Estado:** confirmado

La base de datos no contiene restricciones `CHECK` para:

- Longitud o contenido de nombres y descripciones.
- Cantidades positivas y con un máximo razonable.
- Precios no negativos y con un máximo razonable.

Tampoco se observaron cuotas por usuario para listas, productos, enlaces de invitación o entradas de historial. Un cliente modificado puede saltarse las validaciones de la interfaz.

**Corrección recomendada:** añadir validación de servidor, restricciones SQL y cuotas razonables. Las políticas deben aplicarse en la base de datos, no solamente en React.

### SEC-10: esquema OAuth de Android no verificado

**Severidad:** media  
**Estado:** ⚠️ superficie reducida y verificada en el APK debug; el esquema personalizado sigue sin poder verificarse criptográficamente y falta una prueba OAuth en dispositivo

Android utiliza el esquema personalizado `site.insforge.cestapp://`. Otra aplicación puede registrar el mismo esquema. Además, existe un segundo filtro que acepta cualquier ruta del esquema y amplía innecesariamente la superficie de deep links.

PKCE dificulta que otra aplicación canjee el código sin el verificador, pero no evita la interceptación, interferencia o bloqueo del flujo.

**Resolución aplicada (13 de agosto de 2026):**

- Se eliminó del manifiesto el segundo filtro que aceptaba cualquier URI `site.insforge.cestapp://`. El APK generado conserva un único filtro `VIEW` con esquema `site.insforge.cestapp` y host `oauth-callback`.
- La aplicación exige además que el callback tenga protocolo y host exactos, ruta vacía o `/`, y que no incluya usuario, contraseña, puerto ni fragmento. Ya no acepta variantes como un host ajeno con ruta `/oauth-callback`.
- Los códigos OAuth superiores a 4.096 caracteres se rechazan antes del intercambio y los mensajes de error procedentes del callback se limitan a 300 caracteres.
- Se consultó el desafío OAuth de Google del backend de pruebas sin completar ningún login. InsForge devolvió `https://accounts.google.com/o/oauth2/v2/auth`.
- Antes de abrir el navegador, TypeScript valida ese protocolo, host y ruta exactos. `NativeBrowserPlugin` repite la misma validación en Java, por lo que una llamada directa al bridge nativo tampoco puede abrir esquemas, hosts o rutas arbitrarios. Solo se admite el puerto HTTPS estándar y se rechazan credenciales o fragmentos embebidos.
- PKCE se mantiene y el código continúa canjeándose mediante la ruta nativa protegida, sin exponer el refresh token al WebView.

**Verificación realizada:** TypeScript, ESLint sin errores, `git diff --check`, `pnpm build` normal con las 23 rutas y el APK debug finalizaron correctamente. El manifiesto empaquetado se inspeccionó y contiene solo el filtro con host `oauth-callback`. No se utilizó el teléfono, por petición del usuario.

**Riesgo residual:** cualquier aplicación Android puede intentar registrar el mismo esquema personalizado. PKCE evita que canjee el código sin el verificador, pero no impide interceptar o bloquear la redirección. La solución completa sigue siendo migrar a un Android App Link HTTPS con `assetlinks.json` y certificado de firma verificado cuando InsForge permita registrar ese callback.

**Pendiente de publicación:** desplegar el frontend que valida las URLs, generar el APK actualizado y completar una prueba real de OAuth antes de publicarlo. Hasta entonces, la versión instalada conserva su manifiesto anterior.

### SEC-11: origen de OAuth basado en cabeceras del proxy

**Severidad:** media condicionada al comportamiento del proxy  
**Estado:** ✅ resuelto y verificado en `security-hardening`; pendiente de configurar la variable y desplegar en producción

`getRequestOrigin` confía en `x-forwarded-host` y `x-forwarded-proto` para construir URLs de redirección. Si un proxy no sobrescribe estas cabeceras de forma segura, un cliente podría influir en el origen calculado.

Las URLs permitidas actualmente en InsForge limitan el impacto, pero el código queda expuesto a una futura mala configuración.

**Resolución aplicada (13 de agosto de 2026):**

- Las rutas de autenticación obtienen ahora su origen exclusivamente de `NEXT_PUBLIC_APP_URL`, conservando `NEXT_PUBLIC_SITE_URL` solo como alias de compatibilidad. `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` y la URL interna de la solicitud ya no intervienen en redirects ni en la comprobación CSRF.
- El origen configurado se analiza como URL al cargar el servidor. Los builds de producción exigen HTTPS y rechazan credenciales embebidas, rutas, consultas y fragmentos. `pnpm dev` permite HTTP únicamente para direcciones loopback explícitas.
- La misma constante validada construye los `redirectTo` de registro y OAuth y se compara con `Origin` en todas las rutas web de autenticación.
- `.env.local` utiliza `https://saturno.taile4db48.ts.net:8443` para las pruebas. Se añadió únicamente `https://saturno.taile4db48.ts.net:8443/sign-in` a `allowedRedirectUrls` de `security-hardening`, preservando las cuatro entradas existentes y sin modificar producción.
- README documenta `NEXT_PUBLIC_APP_URL` como obligatoria y especifica el valor esperado de producción: `https://cestapp.insforge.site`.

**Verificación realizada:** el OAuth de pruebas respondió `200` con el origen correcto tanto sin cabeceras especiales como con `Host`, `X-Forwarded-Host` y `X-Forwarded-Proto` falsificados. Un origen atacante acompañado de cabeceras falsificadas coincidentes recibió `403`, igual que una petición sin `Origin`. TypeScript, ESLint sin errores, `git diff --check` y el build normal de las 23 rutas finalizaron correctamente.

**Pendiente de producción:** configurar `NEXT_PUBLIC_APP_URL=https://cestapp.insforge.site` en el despliegue, confirmar que `/sign-in` continúa en `allowedRedirectUrls` y repetir login, registro y OAuth. Cada preview o dominio alternativo necesita su propio build/origen explícito; no se aceptan hosts dinámicos por diseño.

## Observaciones adicionales de Android

- `FileProvider` no está exportado, lo cual es positivo, pero `external-path path="."` concede un ámbito excesivamente amplio si alguna función entrega permisos URI en el futuro.
- ✅ `NativeBrowserPlugin` está restringido en TypeScript y Java a la URL HTTPS autorizada de Google OAuth. Cualquier ampliación futura de proveedores deberá añadir explícitamente su host y ruta.
- La build release tiene `minifyEnabled false`; esto no constituye por sí solo una vulnerabilidad, pero facilita el análisis del APK y debe asumirse que ningún secreto puede protegerse mediante ofuscación.
- El `anon key` de InsForge es público por diseño. La protección real debe depender siempre de RLS y de la autorización de las funciones RPC.

## Dependencias

El análisis ejecutado fue:

```bash
pnpm audit --prod
```

Resultado inicial observado:

```text
54 vulnerabilidades
3 bajas · 17 moderadas · 31 altas · 3 críticas
```

Después de resolver SEC-05:

```text
24 vulnerabilidades
0 bajas · 6 moderadas · 15 altas · 3 críticas
```

Después de resolver SEC-07:

```text
17 vulnerabilidades
0 bajas · 6 moderadas · 10 altas · 1 crítica
```

Este total necesita interpretación:

- Los avisos asociados a Next, PostCSS, Nanoid y Babel se corrigieron en SEC-05.
- Clerk y sus dependencias transitivas no utilizadas se eliminaron en SEC-07.
- Varias incidencias de `tar`, `xmldom` y `brace-expansion` proceden de `@capacitor/cli`; afectan principalmente al proceso de compilación, no al APK ejecutándose. `@capacitor/cli` debería actualizarse y residir en `devDependencies`.
- `ws` y `socket.io-parser` llegan mediante `@insforge/sdk`; conviene actualizar el SDK cuando publique una cadena corregida.

## Estado del despliegue

Durante la auditoría, las nuevas rutas locales `/api/auth/*` aún no estaban disponibles en producción:

```text
GET https://cestapp.insforge.site/api/auth/refresh → 404
```

La corrección de persistencia de sesión de iPhone existe como cambio local sin confirmar en la rama `android`, pero todavía no está activa en `cestapp.insforge.site`.

Las rutas `/api/auth/native/*` de SEC-04 también son cambios locales. Deben desplegarse antes de distribuir el APK que depende de ellas.

La actualización de Next.js `16.3.0` de SEC-05 también permanece únicamente en la rama `android` y aún no protege el despliegue público.

La eliminación de Clerk de SEC-07 también permanece únicamente en la rama `android`; producción no ha sido modificada.

El rate limiting de SEC-06 y las cabeceras/CSP de SEC-08 también son cambios locales. Deben desplegarse y verificarse en el dominio público antes de considerarlos activos.

El endurecimiento OAuth de SEC-10 requiere tanto desplegar el frontend como publicar un APK nuevo para que el manifiesto y la validación Java lleguen a los dispositivos.

El origen fijo de SEC-11 está configurado únicamente para `saturno` en `.env.local`. Producción necesita definir su propio `NEXT_PUBLIC_APP_URL` antes del build.

Este estado debe comprobarse nuevamente antes de corregir o desplegar, porque puede haber cambiado después de la fecha de este documento.

## Aspectos positivos observados

- Las cookies web nuevas usan `HttpOnly`, `Secure` en producción, `SameSite=Lax` y prefijo `__Host-`.
- El refresh token web no se expone directamente a JavaScript.
- Las rutas web comprueban el encabezado `Origin` antes de modificar la sesión.
- El redireccionamiento posterior al login está limitado a rutas internas conocidas.
- OAuth web utiliza PKCE y guarda el verificador en una cookie `HttpOnly`.
- Las tablas principales de listas, productos e invitaciones tienen RLS activa.
- Las funciones `SECURITY DEFINER` revisadas fijan `search_path` de forma segura.
- Los tokens de invitación se generan como UUID aleatorios y se validan por caducidad y revocación.
- No se encontraron usos de `dangerouslySetInnerHTML`, `eval` ni `document.write`.
- La aplicación no incluye claves administrativas de InsForge en el frontend.

## Orden recomendado de actuación

### Inmediato

- [x] Corregir `list_shares_insert` para impedir incorporaciones sin invitación. Resuelto y verificado en `security-hardening`.
- [x] Activar RLS y revocar escritura anónima en todas las particiones de auditoría. Resuelto y verificado en `security-hardening`.
- [x] Hacer que las particiones nuevas nazcan protegidas automáticamente. Resuelto y verificado en `security-hardening`.
- [x] Activar RLS y políticas por propietario/miembro en Realtime. Resuelto y verificado en `security-hardening`.

### Antes del próximo despliegue

- [x] Actualizar Next.js y `eslint-config-next` a una versión corregida compatible. Resuelto con `16.3.0` y verificado en web y Android.
- [x] Eliminar `@clerk/nextjs`. Resuelto y verificado en web y Android; pendiente de desplegar.
- [ ] Actualizar InsForge SDK y Capacitor.
- [x] Ejecutar nuevamente `pnpm audit --prod` y revisar los avisos restantes. Quedan 17 asociados a `@capacitor/cli` y `@insforge/sdk`.
- [x] Añadir rate limiting y validación de cuerpos a `/api/auth/*`. Resuelto y verificado en web y Android contra `security-hardening`; pendiente de desplegar.
- [ ] Confirmar y configurar rate limiting en `POST /api/auth/sessions` de InsForge, o protegerlo mediante un control soportado por el proveedor. Se confirmó que la vía directa omite el límite local de cinco intentos.
- [ ] Revisar la política de longitud de contraseña. Aplazado expresamente; no se añadió un mínimo en la aplicación y se conserva la configuración actual de InsForge.
- [x] Configurar cabeceras HTTP y una CSP compatible con la aplicación. Resuelto y verificado localmente con navegador real; pendiente de desplegar y comprobar en producción.
- [x] Fijar y validar el origen público de autenticación. Resuelto en código y probado frente a cabeceras proxy falsificadas; pendiente de configurar `NEXT_PUBLIC_APP_URL` en producción.

### Android

- [x] Migrar el refresh token a almacenamiento seguro respaldado por Android Keystore. Resuelto y verificado en un móvil real; pendiente de publicar el APK.
- [x] Excluir datos de autenticación de backups o desactivar `allowBackup`. Resuelto con ambas defensas y verificado en el manifiesto generado.
- [x] Restringir el deep link al callback OAuth exacto. Eliminado el filtro genérico y verificado el manifiesto del APK debug; queda migrar a App Links para eliminar el riesgo del esquema compartido.
- [x] Restringir `NativeBrowserPlugin` a URLs HTTPS autorizadas. Google OAuth se valida tanto en TypeScript como en Java.
- [ ] Reducir el ámbito de `FileProvider`.

### Integridad y mantenimiento

- [ ] Añadir restricciones SQL para cantidades, precios y longitudes.
- [ ] Definir cuotas para recursos creados por usuario.
- [ ] Añadir pruebas automatizadas de RLS con dos usuarios y un usuario anónimo.
- [ ] Comprobar periódicamente tablas sin RLS, funciones `SECURITY DEFINER` y permisos concedidos a `PUBLIC`.
- [ ] Definir retención y acceso administrativo del historial de actividad.

## Pruebas de aceptación para las correcciones

Una corrección de seguridad no debe considerarse terminada hasta demostrar como mínimo lo siguiente:

1. Un usuario no puede insertarse en `list_shares` sin una invitación válida.
2. Un usuario expulsado no puede volver a entrar reutilizando solamente el UUID de la lista.
3. Un miembro puede abandonar voluntariamente una lista.
4. Un usuario no puede leer ni publicar en canales Realtime de otra lista o cuenta.
5. `anon` no puede leer, insertar, actualizar ni borrar ninguna partición de auditoría.
6. Cada partición recién creada tiene RLS y sus políticas correctas.
7. ✅ El refresh token de Android no aparece en `document.cookie`, `localStorage` ni `sessionStorage` en el nuevo APK (verificado en móvil real).
8. ⚠️ Los endpoints propios web y Android limitan intentos repetidos, devuelven `Retry-After` y rechazan cuerpos superiores a 16 KiB; queda pendiente cerrar o confirmar el límite del endpoint directo de InsForge.
9. ⚠️ El build local devuelve las cabeceras, mantiene PWA y Realtime y bloquea fuentes no autorizadas; queda pendiente verificar OAuth y avatares después del despliegue en producción.
10. ✅ Lint, build de Next.js y build del APK siguen completándose correctamente tras SEC-05, SEC-06, SEC-07, SEC-08 y SEC-10.
11. ⚠️ El APK solo declara el callback OAuth esperado y el navegador nativo rechaza URLs ajenas; falta probar el flujo completo en dispositivo y migrar a un App Link verificado.
12. ✅ Las cabeceras `Host` y `X-Forwarded-*` falsificadas no alteran el origen de auth; un `Origin` atacante continúa recibiendo `403`.

## Limitaciones de esta auditoría

- No se intentó explotar ninguna cuenta ni acceder a información de otros usuarios.
- No se realizaron pruebas de penetración destructivas o de carga contra producción.
- No se auditó el código interno del servicio gestionado de InsForge.
- El asesor automático de seguridad de InsForge no pudo consultarse porque el CLI solicitó renovar su sesión; las consultas SQL de metadatos y políticas sí funcionaron.
- No se realizó análisis dinámico del APK en un dispositivo rooteado ni interceptación TLS.
- Una auditoría adicional debe repetir las comprobaciones después de aplicar las correcciones y antes de publicar.
