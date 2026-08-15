# Inventario de lógica reutilizable

Fecha de revisión: 15 de agosto de 2026.

Este documento describe las piezas que ya son compartidas y los siguientes candidatos de extracción. La revisión no modifica tablas, RLS, triggers, eventos de auditoría ni contratos de InsForge: las operaciones de negocio siguen pasando por los mismos servicios.

## Reutilización disponible

### Sesión y autenticación

- `src/hooks/useProtectedUser.ts`: guarda de páginas privadas y redirección única a inicio de sesión. Se usa en listas, catálogo, detalle y perfil.
- `src/services/authInput.ts`: lectura y validación de email, contraseña, nombre, OTP, código OAuth y verifier.
- `src/services/authRequest.ts`: validación compartida de solicitudes JSON web y nativas, límites de cuerpo y origen confiable.
- `src/services/authResponse.ts`: respuestas JSON de autenticación con cabeceras `no-store`.
- `src/services/authProviderFlows.ts`: llamadas comunes a InsForge para login, registro y verificación.
- `src/utils/authErrors.ts`: normalización de estado, mensaje y detección de sesión inválida.
- `src/features/auth/components/AuthFeedback.tsx`: avisos y botón de envío comunes para login, registro y verificación.
- `src/features/auth/components/AuthIcons.tsx`: iconos de campos y Google compartidos.

### Datos, caché y tiempo real

- `src/hooks/useCachedCollection.ts`: hidratación desde `localStorage`, TTL, separación por usuario, reconciliación, limitación de recargas y un reintento tras renovar la sesión. Lo comparten dashboard y catálogo.
- `src/utils/localCache.ts`: formato común de lectura y escritura de caché local.
- `src/hooks/useInsforgeRealtimeChannel.ts`: ciclo de vida único de suscripciones, deduplicación, timeout y limpieza.
- `src/features/dashboard/services/realtimeService.ts`: nombres de canal, validación del canal recibido y publicación de eventos de lista/usuario.
- `src/features/dashboard/hooks/useDashboardListsRealtime.ts` y `useListRealtime.ts`: adaptadores de eventos para cada pantalla.
- `src/features/dashboard/hooks/useListResources.ts`: carga autorizada de lista, ítems, catálogo visible, miembros e invitaciones.
- `src/features/dashboard/hooks/useListItemMutations.ts`: altas, cantidades, marcado y borrado con actualización optimista, rollback y publicación realtime.

### Dominio y servicios

- `src/types/product.ts`: contratos canónicos de producto, resumen y borrador.
- `src/types/realtime.ts`: payload base de eventos realtime.
- `src/types/collection.ts`: contratos genéricos de carga y actualización de colecciones.
- `src/features/dashboard/services/listsService.ts`: consultas y reconciliación de listas.
- `src/features/dashboard/services/listDetailService.ts`: operaciones de detalle, invitaciones, miembros, ítems y productos.
- `src/features/dashboard/services/invitationsService.ts`: aceptación de invitaciones.
- `src/features/products/services/productsService.ts`: catálogo e historial de precios.
- `src/utils/productValues.ts`: parseo coherente de precios e identificadores optimistas.
- `src/utils/rpc.ts`: extracción segura de la primera fila de un RPC.
- `src/features/dashboard/hooks/useDashboardListsDerivedState.ts`, `useListDerivedState.ts` y `src/features/products/hooks/useProductsDerivedState.ts`: búsqueda, totales y estados derivados fuera de las vistas.

### Interfaz

- `src/components/atoms/FormControls.tsx`: inputs y botones primarios.
- `src/components/atoms/AsyncPageState.tsx`: loader de página protegida, alerta inline y estado vacío.
- `src/components/atoms/FloatingActionButton.tsx`, `Toast.tsx` y `UserAvatar.tsx`: elementos compartidos de navegación y feedback.
- `src/components/organisms/AppModal.tsx`: estructura y cabecera de modales.
- `src/components/organisms/CollectionPageHeader.tsx`: título, búsqueda y alta para colecciones.
- `src/features/products/components/ProductFields.tsx`: campos de producto compartidos por catálogo, editor y alta rápida en una lista.
- `src/features/auth/components/ShoppingListPreview.tsx`: preview compartido por portada y registro.
- `src/hooks/useTimedValue.ts`: feedback temporal con cancelación del timeout al reemplazarlo o desmontar el componente.
- `src/hooks/useAvatar.ts` y `src/utils/generateCestaAvatar.ts`: resolución y generación de avatares.
- `src/utils/classNames.ts`: composición de clases condicionales.

## Candidatos que aún merece la pena extraer

Prioridad media:

- `useListSharingActions`: mover desde `ListDetailPageContainer.tsx` compartir por email, crear/revocar/copiar invitaciones y retirar miembros. Es un bloque cohesivo, pero debe conservar la publicación a canales personales y las comprobaciones de propietario.
- `useProductPriceHistory`: agrupar carga, alta, edición y borrado del historial que aún vive en `ProductsPageContainer.tsx`.
- `withAuthRetry`: encapsular el patrón renovar sesión + repetir una escritura que aparece en las actualizaciones de precio. Solo debe reintentar errores de autenticación y una única vez.
- `StatusAlert`: generalizar `InlineAlert` para tonos error/éxito/información y sustituir los avisos todavía locales de perfil y detalle.
- `PageHeader`: crear una base sin buscador para que `CollectionPageHeader`, perfil y detalle compartan tipografía y espaciado.

Prioridad baja o condicionada a que aparezca otro consumidor:

- Formateadores de moneda y fecha para reemplazar llamadas dispersas a `toFixed(2)` y `toLocaleDateString`.
- Hook de operación asíncrona para pares repetidos `loading/error`; conviene esperar a tener una API que no oculte rollbacks optimistas.
- Acciones de renombrar/eliminar lista. De momento están demasiado ligadas a navegación, confirmación y notificaciones de miembros para convertirlas en una abstracción general.
- Estado común de formularios de autenticación. Login, registro, verificación y OAuth tienen transiciones suficientemente distintas; compartir solo controles y feedback mantiene el flujo más explícito.

## Límites de seguridad y auditoría

- Reutilizar una consulta no autoriza a saltarse RLS: todos los hooks continúan usando los servicios de InsForge existentes.
- Los eventos de auditoría siguen naciendo en triggers de PostgreSQL; mover lógica React no cambia su contenido ni su frecuencia.
- Los eventos realtime son avisos de sincronización, no una fuente de autorización ni sustituyen una recarga validada por RLS.
- La caché se separa por identificador de usuario y se vacía al cambiar de sesión para evitar mostrar datos de otra cuenta.
- Los flujos web y Android comparten validación, pero mantienen transportes de sesión distintos: cookies `HttpOnly` en web y almacenamiento seguro nativo en Android.
