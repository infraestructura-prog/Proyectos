# Departamento de Ensamblaje · Suspensiones CCS

Espacio de trabajo interno del departamento. Es una aplicación web en español que funciona en computadoras, tablets y teléfonos. Está hecha con HTML, CSS y JavaScript sin compilación, más funciones de servidor para Vercel.

```
Inicio
├── Neotropya
│   └── Nodos
│       └── Control de órdenes de fabricación   (solo lectura, Google Sheets público)
└── Infraestructura
    └── Máquinas de simulación
        ├── Máquinas vendidas                    (lectura y escritura vía servidor)
        ├── Máquinas en stock                    (lectura y escritura vía servidor)
        └── Referencia del archivo               (Hoja 1 original, solo lectura)
```

## Estado actual: qué funciona y qué falta configurar

| Función | Estado |
|---|---|
| Bienvenida, navegación, migas de pan, cambio de área | ✅ Funciona |
| Nodos: lectura en vivo, indicadores, filtros, tabla/tarjetas, fichas, actualización manual y automática | ✅ Funciona (probado con la hoja real) |
| Nodos: error con «Reintentar» y datos de demostración solo bajo demanda | ✅ Funciona |
| Máquinas: interfaz completa (tarjetas, tabla, filtros, ficha, formularios, validación, advertencias, conflictos) | ✅ Probada en el navegador con un servidor simulado |
| Máquinas: lectura directa de la hoja pública (igual que Nodos, sin servidor). Lee «Hoja 1» y, si existe, la pestaña `App_Maquinas` | ✅ Funciona (solo lectura) |
| Máquinas: escritura en Google Sheets (`/api/machines` → Apps Script) | ⚠️ Código escrito, **no probado contra Google**. Falta instalar `apps-script/Code.gs` y cargar las variables |
| Inicio de sesión (`/api/auth`) | ⚠️ Código escrito, **no probado en Vercel**. Faltan `SESSION_SECRET` y `APP_USERS` |
| Subida de imágenes | ❌ No implementada. Por ahora se guarda un enlace duradero (ver «Imágenes») |

## Estructura de archivos

```
index.html                    Armazón (barra superior, migas de pan, contenedor)
assets/css/app.css            Estilos (paleta del panel de Nodos)
assets/js/app.js              Rutas #/…, cambio de área, sesión
assets/js/registry.js         Árbol de áreas y actividades (agregar actividades aquí)
assets/js/config.js           Configuración pública (ID de la hoja de Nodos, refresco)
assets/js/ui.js               Diálogos con gestión de foco, avisos, iconos
assets/js/api.js              Cliente de /api/*
assets/js/modules/nodos.js    Control de órdenes de fabricación (integración del HTML original)
assets/js/modules/maquinas.js Máquinas de simulación
shared/machines-core.js       Validación, normalización y duplicados (navegador y servidor)
shared/reference-snapshot.js  Copia de Hoja 1 para cuando no hay conexión
api/machines.js               Leer, crear, editar e inicializar la tabla App_Maquinas
api/reference.js              Leer Hoja 1 (solo lectura)
api/auth.js                   Iniciar y cerrar sesión
api/_lib/store.js             Conexión con la hoja: Apps Script o cuenta de servicio
api/_lib/                     Cliente de Google Sheets, sesiones, HTTP
apps-script/Code.gs           Script que se pega en la hoja (Extensiones → Apps Script)
assets/js/sheets-public.js    Lectura de la hoja pública (como Nodos)
scripts/hash-password.ps1     Genera el hash de una contraseña (Windows, sin Node)
scripts/hash-password.mjs     Igual, con Node
.env.example                  Variables de entorno (sin secretos)
```

Para agregar una actividad nueva, crea su módulo en `assets/js/modules/` con `export function mount(el, ctx)`, que devuelve una función de limpieza. Después agrega el nodo en `registry.js`. Cada módulo recibe su propio contenedor, así que sus eventos y temporizadores no chocan con los de otros módulos.

## Ejecución local

- **Solo la interfaz y Nodos:** cualquier servidor estático sirve. Por ejemplo, `npx serve .`. Máquinas mostrará «Las funciones de servidor no están disponibles».
- **Todo, incluido el servidor:** instala Node 18 o superior y la CLI de Vercel. Copia `.env.example` como `.env.local`, rellena los valores y ejecuta:

```bash
npm i -g vercel
```
```bash
vercel dev
```

## GitHub y Vercel

1. Sube esta carpeta a un repositorio de GitHub. **No subas `.env.local`**: `.gitignore` ya lo excluye.
2. En [vercel.com](https://vercel.com), entra en *Add New → Project*, importa el repositorio y elige *Framework Preset: Other*. Si la app está en una subcarpeta, indícala en *Root Directory*. No necesita comando de compilación.
3. En *Settings → Environment Variables*, crea las variables de `.env.example`.
4. Vuelve a desplegar. Cada `git push` despliega automáticamente.

## Google Sheets: conexión de lectura y escritura

El Excel por sí solo **no** es una conexión en vivo. La aplicación trabaja con la hoja de Google **«Codificación de Máquinas de Simulación»** de tres maneras:

- **Solo lectura, sin configurar nada más:** si la hoja está compartida como «Cualquier persona con el enlace · Lector», el navegador la lee igual que Nodos. Agregar y editar quedan desactivados.
- **Lectura y escritura con Apps Script (recomendada):** la app (Vercel) llama a un script instalado en la propia hoja. No hace falta Google Cloud.
- **Lectura y escritura con cuenta de servicio:** la alternativa con Google Cloud que se describe más abajo.

En los dos casos de escritura, las claves están solo en Vercel. El navegador nunca las ve.

### Opción A: Apps Script

1. Abre la hoja y entra en **Extensiones → Apps Script**.
2. Borra lo que haya en `Code.gs`, pega el contenido completo de [`apps-script/Code.gs`](apps-script/Code.gs) y guarda.
3. Genera una clave aleatoria en PowerShell. Cópiala; no la compartas ni la subas a GitHub:

```bash
powershell -Command "[Convert]::ToBase64String((1..32|%{[byte](Get-Random -Max 256)}))"
```

4. En el editor de Apps Script ve a **Configuración del proyecto** (engranaje) → **Propiedades de la secuencia de comandos** → **Agregar propiedad**. Nombre: `APP_SECRET`. Valor: la clave del paso 3.
5. Pulsa **Implementar → Nueva implementación**. En el engranaje elige **Aplicación web**, con **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier usuario**. Pulsa **Implementar** y autoriza los permisos. Google mostrará «Google no ha verificado esta aplicación»: pulsa *Configuración avanzada → Ir a … (no seguro)*, porque el script es tuyo.
6. Copia la **URL de la aplicación web**, que termina en `/exec`.
7. En Vercel, crea las variables `APPS_SCRIPT_URL` (la URL) y `APPS_SCRIPT_SECRET` (la misma clave del paso 3). Crea también `SESSION_SECRET` y `APP_USERS` (ver «Autenticación»). Después vuelve a desplegar.
8. En la app, inicia sesión como editor y pulsa **Inicializar tabla App_Maquinas**.

Si después cambias `Code.gs`, entra en **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión**. Así la URL no cambia.

Si tu cuenta es de Google Workspace (por ejemplo `@suspensionesccs.com`) y la opción «Cualquier usuario» no aparece, la tiene bloqueada el administrador del dominio. Pídele que la permita, o crea el script con una cuenta que sí la tenga. Con «Solo usuarios de tu dominio», Vercel no puede llamar al script.

Seguridad: la URL del script es pública, pero sin `APP_SECRET` no devuelve datos ni escribe. El script solo lee «Hoja 1» y solo escribe en `App_Maquinas`. Las escrituras usan `LockService`, así que dos guardados simultáneos no pueden duplicar una codificación ni pisarse.

### Opción B: cuenta de servicio

1. En [console.cloud.google.com](https://console.cloud.google.com), crea un proyecto o usa uno existente y activa la **Google Sheets API**.
2. En *IAM y administración → Cuentas de servicio*, crea una cuenta. En *Claves → Agregar clave → JSON*, descarga el archivo. Guárdalo en un lugar seguro y no lo subas a GitHub.
3. Abre la hoja de Google, pulsa **Compartir** y agrega el correo de la cuenta de servicio (`…@….iam.gserviceaccount.com`) como **Editor**.
4. En Vercel, configura estas variables:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: el campo `client_email` del JSON.
   - `GOOGLE_PRIVATE_KEY`: el campo `private_key` del JSON, completo, con los `\n`.
   - `MAQUINAS_SPREADSHEET_ID`: `1PuXWlmC_ZQOBHYAk-OT1Z73gAqF8FtGctp-CYoqPsDk`.
   - `MAQUINAS_SOURCE_TAB`: `Hoja 1`.

### Tabla normalizada y migración propuesta

La aplicación **no escribe en «Hoja 1» ni reorganiza sus bloques**. Guarda los registros en una pestaña nueva, **`App_Maquinas`**, dentro de la misma hoja. Tiene una fila por máquina:

| Columna | Origen | Descripción |
|---|---|---|
| `id` | nueva | Identificador interno estable (`MQ-<uuid>`). Las ediciones se hacen por este id, no por número de fila. |
| `codificacion` | archivo | Ej. `A - CC - DER`. Debe ser única entre vendidas y en stock. |
| `categoria` | archivo | `Con chapa` / `Sin chapa`. |
| `serial` | archivo | Opcional (el bloque derecho no tiene seriales). Único si se informa. |
| `escalera` | archivo | `Derecha` / `Izquierda` (normalizado desde «Derecho»/«Izquierdo»). |
| `condicion` | nueva | `En stock` / `Vendida`. Se elige explícitamente al registrar. |
| `imagen_url` | nueva | Enlace duradero a la imagen verificada. |
| `origen` | nueva | Celdas de origen si vino de la referencia (ej. `Hoja 1!C3:F3`). |
| `valor_original` | nueva | Valores originales sin normalizar (JSON), para trazabilidad. |
| `creado`, `modificado` | nuevas | Fecha y hora ISO. |
| `version` | nueva | Aumenta con cada edición; detecta cambios simultáneos. |
| `creado_por`, `modificado_por` | nuevas | Usuario que creó o modificó el registro. |
| `request_id` | nueva | Evita duplicados por reintentos o doble clic. No se muestra. |

Pasos de la migración (manuales y revisados):

1. Un editor pulsa **«Inicializar tabla App_Maquinas»**. Antes de hacerlo, la aplicación muestra un diálogo de confirmación. Solo crea la pestaña con los encabezados y **no copia ningún dato**.
2. En **Referencia del archivo** se ven las 14 entradas de Hoja 1 con su celda de origen. Cada entrada se registra con **«Registrar»**, que precarga los valores normalizados. **Tú eliges la condición comercial**: la aplicación no la deduce.
3. Antes de registrar, confirma las dudas de la sección «Pendientes de confirmar».

## Autenticación y autorización

- Las lecturas son abiertas por defecto. Con `READ_REQUIRES_LOGIN=true`, también exigen sesión.
- **Toda escritura exige sesión con rol `editor`.** Las comprobaciones se hacen en el servidor y el rol `lector` solo puede consultar.
- La sesión se guarda en una cookie `HttpOnly`, `Secure` y `SameSite=Strict`, firmada con `SESSION_SECRET`, y dura 8 horas. Las escrituras exigen además una cabecera propia de la app, como protección CSRF.
- Usuarios en `APP_USERS` (JSON). Para generar el hash de una contraseña en Windows:

```bash
powershell -ExecutionPolicy Bypass -File scripts/hash-password.ps1
```

  Ejemplo: `[{"user":"erick","role":"editor","hash":"pbkdf2$sha256$210000$...$..."}]`.
- `SESSION_SECRET`: una cadena aleatoria de 32 caracteres o más. Si la cambias, se cierran todas las sesiones.

## Persistencia y reglas de guardado

- Los registros viven en Google Sheets, por eso persisten al recargar y se ven desde cualquier equipo. `localStorage` guarda **solo preferencias** (vista en tabla o tarjetas).
- Validación en el cliente y en el servidor con el mismo módulo (`shared/machines-core.js`).
- Duplicados: no se repite la codificación entre vendidas y en stock (sin importar espacios o mayúsculas). Tampoco el serial, cuando se informa.
- Doble clic y reintentos: el botón se bloquea mientras guarda. Cada formulario envía un `requestId`, y si el servidor ya lo guardó, devuelve el registro existente.
- Tras guardar aparece una confirmación. Si hay un error, **el formulario conserva los datos**.
- Cambios simultáneos: si otra persona modificó la máquina, el servidor responde con un conflicto. La app muestra la versión actual y te deja descartar tus cambios o sobrescribirlos de forma explícita.
- «Marcar como vendida» conserva el id, el serial y el historial.
- Las incoherencias entre codificación, categoría y escalera muestran una advertencia y **no modifican el dato**.
- Con Apps Script, la comprobación de duplicados y de versión se repite dentro de un bloqueo (`LockService`) justo antes de escribir. Con la cuenta de servicio no hay bloqueo: si dos personas crean la misma codificación en el mismo segundo podría pasar un duplicado (riesgo bajo con pocos usuarios).

## Imágenes

Las 7 imágenes del archivo están **incrustadas sobre las celdas**. No son enlaces, así que ni la API de Sheets ni una exportación CSV las devuelven. Por eso no se importan.

Una función de Vercel **no conserva** archivos guardados en su disco. Opciones duraderas:

1. **Implementada:** guardar cada imagen en Google Drive, compartirla como «Cualquier persona con el enlace» y pegar el enlace en «Imagen de referencia». Los enlaces `drive.google.com/file/d/…` se convierten automáticamente en miniatura.
2. **Ampliación posible:** subirlas desde la app a **Vercel Blob** (o a una carpeta de Drive en una unidad compartida), con una función `/api/upload` que guarde la URL resultante en `imagen_url`.

Asocia una imagen a una máquina solo cuando hayas verificado la correspondencia. Las imágenes del bloque izquierdo no deben copiarse al bloque derecho.

## Ampliaciones posibles (no implementadas, no son columnas existentes)

Cliente, fecha de venta, importe y observaciones. Se agregarían como columnas nuevas al final de `App_Maquinas`, actualizando `COLUMNS` en `shared/machines-core.js` y en `apps-script/Code.gs`.

## Pendientes de configurar

1. Instalar `apps-script/Code.gs` en la hoja y crear su propiedad `APP_SECRET` (Opción A).
2. Crear las variables de entorno en Vercel: `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `SESSION_SECRET` y `APP_USERS`.
3. Generar los usuarios con `scripts/hash-password.ps1` y cargarlos en `APP_USERS`.
4. Desplegar y probar `/api/auth` y `/api/machines` (el código no se ha ejecutado contra Google).
5. Inicializar `App_Maquinas` desde la app.
6. Responder las dudas de interpretación antes de registrar el inventario.

## Pendientes de confirmar (interpretación de Hoja 1)

- ¿Qué relación hay entre el bloque izquierdo (Con Chapa, C:F) y el derecho (Sin Chapa, H:J)? ¿Son 14 máquinas, 7 máquinas en dos configuraciones u otra cosa? En el archivo, cada letra tiene la escalera **opuesta** en un bloque y en el otro (A: DER / IZQ, C: IZQ / DER…).
- ¿La regla «Letra - CC/SC - DER/IZQ» es oficial?
- ¿Las 7 imágenes corresponden a las filas 3 a 9 del bloque izquierdo, en ese orden?
- ¿Cuáles están vendidas y cuáles en stock?

## Nodos

Mantiene la lógica original: lee por CSV con respaldo JSONP de gviz, detecta los bloques MALETAS y BOLSOS, interpreta las columnas según su posición respecto al ID y en BOLSOS une «Responsable / Observaciones». Se configura en `assets/js/config.js`. La hoja debe estar compartida como «Cualquier persona con el enlace · Lector».
