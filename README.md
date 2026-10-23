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
| Máquinas: lectura de la hoja «Máquinas de Simulación · Ensamblaje CCS» (pública), tarjetas por parejas | ✅ Probado con una copia; falta compartir la hoja nueva como lector público |
| Máquinas: editar y agregar desde la página (Apps Script) | ⚠️ Probado con una copia simulada de la hoja. Falta instalar el script en la hoja y poner su URL en `EDIT_URL` |
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

## Máquinas de simulación: Google Sheets

**Modo en uso.** La página lee la primera pestaña de la hoja [«Máquinas de Simulación · Ensamblaje CCS»](https://docs.google.com/spreadsheets/d/1oxlXnTYC5uGsPfzo2-rDTG-YrFskh9KE1Z2KxZQ8Elo/edit), en el Drive de infraestructura@suspensionesccs.com y compartida como «Cualquier persona con el enlace · Lector». Las columnas se reconocen por su nombre, en cualquier orden y con o sin tildes: **Codificación · Categoría · Serial · Escalera · Condición · Imagen**. Un serial «-» se muestra como «Sin serial». La hoja se configura en `assets/js/config.js` (`SPREADSHEET_ID`, `MACHINES_TABS`). La hoja original «Codificación de Máquinas de Simulación» solo se usa para la pestaña «Referencia del archivo».

**Parejas.** Las máquinas se venden en parejas: una con chapa y otra sin chapa, unidas por la letra inicial del código (A - CC - DER + A - SC - IZQ). Cada tarjeta muestra una pareja. La página avisa si falta una de las dos, si hay más de dos máquinas con la misma letra o si la pareja tiene condiciones distintas. El botón «Marcar pareja como vendida» cambia las dos filas en una sola operación.

**Editar desde la página (Apps Script).** Google solo deja escribir en la hoja con permiso de su dueño. Para eso se usa [`apps-script/Code.gs`](apps-script/Code.gs), que se instala una vez en tu cuenta de Google y abre la hoja por su ID (`HOJA_ID`):

1. Abre la hoja de máquinas con la cuenta dueña (infraestructura@) y entra en **Extensiones → Apps Script**. Tiene que ser la cuenta dueña: si la hoja pertenece a otra cuenta, Google no deja implementar («No tienes permiso para realizar esta acción»).
2. Borra lo que haya y pega el contenido de `apps-script/Code.gs`. También puedes copiarlo con el botón «Copiar código del script» de la ficha de cualquier máquina.
3. En la primera línea, cambia `ESCRIBE-AQUI-TU-CLAVE` por tu **clave de edición** (la eliges tú). Guarda.
4. Ve a **Implementar → Nueva implementación → Aplicación web**, con **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier usuario** (si tu Google Workspace no la ofrece, «Cualquier usuario con una cuenta de Google»: entonces quien guarda debe tener una sesión de Google abierta en ese navegador, fuera del modo incógnito; Safari y navegadores que bloquean cookies de terceros no sirven). Autoriza los permisos: el aviso «Google no ha verificado esta aplicación» se acepta con *Configuración avanzada → Ir a…*.
5. Copia la URL que termina en `/exec` y ponla en `EDIT_URL` de `assets/js/config.js`. Esa URL no es secreta, porque sin la clave el script no modifica nada.

Al guardar, la página pide la clave una vez y la recuerda solo mientras la pestaña del navegador está abierta. El script:
- solo modifica las columnas de máquinas de la primera pestaña y solo las celdas que cambian; si no existe la columna «Imagen», la agrega al final;
- valida los campos y rechaza codificaciones o seriales repetidos;
- usa `LockService` para que dos guardados no se pisen;
- si la fila cambió en la hoja después de abrir el formulario, avisa y deja elegir entre ver lo actual o sobrescribir.

Las ediciones hechas directamente en Google Sheets se ven en la página al pulsar «Actualizar». Si cambias `Code.gs`, entra en *Implementar → Gestionar implementaciones → lápiz → Nueva versión*; así la URL no cambia.

> Las funciones de servidor de `api/` (cuenta de servicio, usuarios y sesiones) son una alternativa anterior que la página ya no usa para Máquinas.

## Alternativa con servidor (no se usa)
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

1. Instalar `apps-script/Code.gs` en la hoja de máquinas con tu clave de edición e implementarlo como aplicación web.
2. Poner la URL `/exec` en `EDIT_URL` (`assets/js/config.js`) y probar una edición real.
3. Mantener las columnas en la fila 1 de la primera pestaña de la hoja de máquinas (se pueden reordenar, no renombrar).

## Interpretación confirmada

- Las máquinas se venden en parejas (con chapa + sin chapa); la letra inicial del código define la pareja.
- La condición (vendida / en stock) se registra en la columna Condición de la hoja de máquinas.

## Identidad visual de Infraestructura

Infraestructura usa una identidad propia de «taller todoterreno»: carbón, grafito y acero, con naranja de seguridad y verde oliva. Los estilos están en `assets/css/infra.css` y solo se aplican cuando la ruta está dentro de Infraestructura (`body[data-area="infraestructura"]`, que fija `app.js`). La única excepción es la tarjeta de Infraestructura en el inicio. Neotropya conserva su estética.

- **Variables de diseño:** al inicio de `infra.css` (`--in-*`: colores, tipografía, bordes, sombras).
- **Tipografía:** Barlow Condensed para títulos, Inter para textos y formularios, JetBrains Mono para códigos y seriales.
- **Cabecera:** `assets/js/infra-theme.js` (`infraHero`). Lleva un plano técnico en SVG (todoterreno, amortiguador y cotas) y no depende de imágenes externas.
- **Foto de cabecera (opcional):** guarda una foto panorámica del taller en `assets/img/infraestructura-hero.jpg` y descomenta la línea `--in-hero-image` al inicio de `infra.css`. Se le aplica una capa oscura para que el título se lea.

## Temas por área

`app.js` escribe el área activa en `body[data-area]` (`inicio`, `neotropya` o `infraestructura`) cada vez que cambia la ruta, también al abrirla o recargarla directamente. Cada tema vive en su propia hoja y solo actúa con su atributo:

- `assets/css/inicio.css`: inicio neutral (piedra, blanco cálido, grafito) con dos tarjetas de acceso equivalentes.
- `assets/css/neotropya.css` y `assets/js/neo-theme.js`: laboratorio creativo (blanco cálido, verde bosque, salvia, durazno y azul suave; Nunito Sans), con la cabecera ilustrada de impresión 3D, nodos, energía solar y prótesis (marcada «próximamente», sin enlaces).
- `assets/css/infra.css` y `assets/js/infra-theme.js`: taller industrial.

Cada hoja define sus variables (`--neo-*`, `--home-*`, `--in-*`) y las asigna a los tokens comunes de `app.css`, así un tema no afecta a los demás.

## Nodos

Mantiene la lógica original: lee por CSV con respaldo JSONP de gviz, detecta los bloques MALETAS y BOLSOS, interpreta las columnas según su posición respecto al ID y en BOLSOS une «Responsable / Observaciones». Se configura en `assets/js/config.js`. La hoja debe estar compartida como «Cualquier persona con el enlace · Lector».
