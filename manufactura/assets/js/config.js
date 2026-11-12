/* COPIA del dashboard publicado (ensamblaje-ccs/assets/js/config.js) para el prototipo local.
   Solo se conservan las hojas que usan Nodos Venezuela e Inventarios (lectura pública). */
/* ░░ CONFIGURACIÓN PÚBLICA ░░
   Aquí NO van credenciales. Las claves de Google y de sesión viven en variables de entorno de Vercel. */

export const NODOS = {
  // ID de la hoja de órdenes de fabricación (la parte larga de la URL entre /d/ y /edit).
  SHEET_ID: '1gUmMYnHK7pCtPe_8Bpgwe_0gExBIFV9LLYFzjJq5KTA',
  // Nombre de la pestaña ('' = la primera).
  SHEET_TAB: '',
  // Opcional: enlace «Publicar en la web → CSV»; si se rellena, tiene prioridad.
  CSV_URL_OVERRIDE: '',
  // Refresco automático en segundos (0 = desactivado).
  AUTO_REFRESH_SECONDS: 120,
  // Permite activar manualmente los datos de demostración cuando falla la conexión.
  ALLOW_DEMO: true
};

/* Neotropya › Nodos › Inventarios › Consumibles (solo lectura: Google Sheets → página). */
export const CONSUMIBLES = {
  SHEET_ID: '1Qq5_DlFSfhkTyhiV1x8vezPV1ZYFuQlK1ewiB_5zI9A',
  TAB: 'Inventario Ensamblaje',
  // gid de la pestaña: permite la exportación CSV que conserva el texto de cada celda (errores incluidos).
  // Si la pestaña se recrea y cambia su gid, la página usa la lectura por nombre de pestaña como respaldo.
  GID: '37652809',
  REFRESH_SECONDS: 120,
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1Qq5_DlFSfhkTyhiV1x8vezPV1ZYFuQlK1ewiB_5zI9A/edit#gid=37652809'
};

