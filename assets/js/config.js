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

export const MAQUINAS = {
  // Hoja «Codificación de Máquinas de Simulación». Compartida como lector público, la app la lee
  // directamente (como Nodos). Agregar y editar requiere además la conexión de servidor (/api).
  SPREADSHEET_ID: '1PuXWlmC_ZQOBHYAk-OT1Z73gAqF8FtGctp-CYoqPsDk',
  SOURCE_TAB: 'Hoja 1',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1PuXWlmC_ZQOBHYAk-OT1Z73gAqF8FtGctp-CYoqPsDk/edit'
};
