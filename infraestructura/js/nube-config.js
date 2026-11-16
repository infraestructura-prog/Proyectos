/* Conexión con la base compartida (Supabase, proyecto «Proyectos»).
   · La dirección y la clave PUBLICABLE no son secretas: viajan en la página y cualquiera puede verlas. Lo que protege
     los datos son las reglas de la base: leer es público (sin teléfonos) y guardar exige el PIN.
   · Usa SOLO la clave «publishable» (empieza por sb_publishable_…) o la «anon». NUNCA la «secret» ni la «service_role».
   · Pega la clave entre las comillas y guarda. Vacía = la página funciona como antes, solo en este navegador. */
export const SUPABASE_URL = 'https://vkjsooquqbyqhifsyjmm.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fC_x8tq_3I8zUyW1OhPW0w_bLxkiK1M';
