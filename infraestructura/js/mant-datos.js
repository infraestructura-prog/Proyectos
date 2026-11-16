/* Mantenimiento · datos.
   Fuente: captura fechada de Odoo (módulo Mantenimiento), consultada en solo lectura con la cuenta de Procesos.
   No es una conexión en vivo: la fecha de la captura se muestra siempre. Nada se escribe en Odoo.
   · Identidad: cada equipo se identifica por su ID de Odoo (EQ-ODOO-<id>); el código (EH01, MV01…) es su etiqueta.
   · Clasificación transparente, con motivo: máquinas / registros generales; solicitudes reales / pruebas / plantillas.
   · Condición operativa: Odoo no la registra. Queda «Pendiente de verificar» hasta que se registre una verificación
     (Etapa 3). No se deduce de las solicitudes, de su etapa ni de su antigüedad. */
export const CAPTURA = 'datos/odoo-mantenimiento-2026-11-16.json';
export const T = { estado: 'inicial', error: '', fuente: null, equipos: [], solicitudes: [], etapas: [] };

export const CONDICIONES = ['Operativa', 'Operativa con restricciones', 'Fuera de servicio', 'Pendiente de verificar'];
export const PRIORIDAD = { 0: 'Muy baja', 1: 'Baja', 2: 'Normal', 3: 'Alta' };
export const TIPO = { corrective: 'Correctivo', preventive: 'Preventivo' };
export const MARCA = { normal: '', blocked: 'Bloqueado', done: 'Lista para la siguiente etapa' };
const GENERICO = 'Procesos';

const rxCodigo = /^([A-Z]{2}\d{2})\s+(.+)$/;
const rxPlantilla = /AQUI SE INTRODUCE|AQUI AGREGAR|^\[MODO DE FALLA/i;
const rxPrueba = /^prueba\s*[:\-]/i;
const rxResuelta = /se solucion[oó]|se repar[oó]|volvi[oó] a su funcionamiento|se recuper[oó] el puente/i;

function normEquipo(e) {
  const m = String(e.nombre || '').match(rxCodigo);
  const general = !e.categoria;
  return {
    ...e, id: `EQ-ODOO-${e.odooId}`, codigo: m ? m[1] : '', nombreCorto: m ? m[2] : e.nombre,
    tipoRegistro: general ? 'general' : 'maquina',
    motivoRegistro: general ? 'Registro de Odoo sin categoría, usado como agrupador general. No se cuenta como máquina.' : '',
    responsable: e.tecnico && e.tecnico !== GENERICO ? e.tecnico : '',
    notaResponsable: e.tecnico === GENERICO ? 'En Odoo figura el usuario genérico «Procesos»: no identifica a una persona.' : '',
    conciliacion: /^MV\d/.test(m ? m[1] : '') ? 'Correspondencia con el inventario de Máquinas de simulación pendiente de conciliar: su serial no aparece en el inventario.' : ''
  };
}
function normSolicitud(s, etapas) {
  const et = etapas.find(x => x.id === s.etapaId) || { cerrada: false };
  const clase = rxPlantilla.test([s.asunto, s.falla, s.descripcion].join(' ')) ? 'plantilla' : rxPrueba.test(s.asunto || '') ? 'prueba' : 'real';
  const avisos = [];
  const abierta = !et.cerrada;
  if (clase === 'real' && abierta && rxResuelta.test(s.descripcion || '')) avisos.push('La descripción dice que la falla se resolvió, pero en Odoo sigue abierta: pendiente de confirmar.');
  if (s.fechaProgramada && s.fechaSolicitud && s.fechaProgramada.slice(0, 10) < s.fechaSolicitud) avisos.push('La fecha programada es anterior a la fecha de registro en Odoo: la solicitud se cargó después del trabajo.');
  return {
    ...s, id: `SOL-ODOO-${s.odooId}`, clase, abierta, avisos,
    motivoClase: clase === 'plantilla' ? 'Contiene los textos guía de la plantilla («AQUÍ SE INTRODUCE…»).' : clase === 'prueba' ? 'El asunto empieza por «Prueba:».' : '',
    prioridadTxt: PRIORIDAD[s.prioridad] || 'Sin prioridad', tipoTxt: TIPO[s.tipo] || 'Sin tipo', bloqueada: s.marcaKanban === 'blocked',
    responsable: s.tecnico && s.tecnico !== GENERICO ? s.tecnico : ''
  };
}

export async function cargar() {
  if (T.estado === 'cargando' || T.estado === 'listo') return;
  T.estado = 'cargando';
  try {
    const r = await fetch(CAPTURA, { cache: 'no-store' }); if (!r.ok) throw new Error('No se encontró la captura de Odoo.');
    const c = await r.json();
    T.etapas = c.etapas || [];
    T.fuente = { nombre: c.fuente, url: c.url, cuenta: c.cuenta, capturado: c.capturado, tipo: c.tipo };
    T.equipos = (c.equipos || []).map(normEquipo);
    T.solicitudes = (c.solicitudes || []).map(s => normSolicitud(s, T.etapas));
    T.estado = 'listo';
  } catch (e) { T.estado = 'error'; T.error = e.message; }
}

/* ── Datos complementarios del dashboard (no están en Odoo y no se escriben en Odoo) ──
   Se guardan en el navegador y se comparten solos con el equipo (guardado compartido, colección mant-complementos).
 */
const KC = 'ccs-infraestructura-v2:mant-complementos';
const leerC = () => { try { const v = JSON.parse(localStorage.getItem(KC) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const escribirC = v => { try { localStorage.setItem(KC, JSON.stringify(v)); return true; } catch { return false; } };
const hoyIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/* Ubicación indicada por Cristian el 16/11/2026: todas las máquinas están en el taller. Se muestra con su procedencia;
   el dato de Odoo se conserva aparte. */
export const UBICACION_INDICADA = { valor: 'Taller', fuente: 'Indicada por Cristian el 16/11/2026 (no figura en Odoo para la mayoría de los equipos)' };
export const ubicacion = e => (e.ubicacion ? { valor: e.ubicacion, fuente: 'Odoo' } : e.tipoRegistro === 'maquina' ? UBICACION_INDICADA : { valor: '', fuente: '' });

/* Verificaciones de condición: cada una con fecha, responsable y, si corresponde, restricciones. La condición actual es
   la de la verificación más reciente; sin verificaciones queda «Pendiente de verificar». Nunca se deduce de Odoo. */
export const verificaciones = e => { const c = leerC()[e.id]; return (c && Array.isArray(c.verificaciones) ? c.verificaciones : []).slice().sort((a, b) => (b.fecha + b.registrado).localeCompare(a.fecha + a.registrado)); };
export function condicionActual(e) {
  const v = verificaciones(e)[0];
  if (!v) return { condicion: 'Pendiente de verificar', verificada: false, motivo: 'Odoo no registra una condición operativa verificada y todavía no hay una verificación registrada en el dashboard.' };
  return { condicion: v.condicion, verificada: v.condicion !== 'Pendiente de verificar', verificacion: v, motivo: v.condicion === 'Pendiente de verificar' ? (v.observaciones || 'Marcada como pendiente en la última verificación.') : '' };
}
export function registrarVerificacion(e, d) {
  const condicion = CONDICIONES.includes(d.condicion) ? d.condicion : '';
  if (!condicion) return { error: 'Elige la condición observada.' };
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : '';
  if (!fecha) return { error: 'Indica la fecha de la verificación.' };
  if (fecha > hoyIso()) return { error: 'La fecha de la verificación no puede ser futura.' };
  const responsable = str(d.responsable, 120); if (!responsable) return { error: 'Indica quién verificó la máquina.' };
  const restricciones = str(d.restricciones, 600);
  if (condicion === 'Operativa con restricciones' && !restricciones) return { error: 'Describe las restricciones de uso.' };
  if (condicion === 'Pendiente de verificar' && !str(d.observaciones, 10)) return { error: 'Explica por qué queda pendiente de verificar.' };
  const c = leerC(), reg = c[e.id] || (c[e.id] = { verificaciones: [] });
  reg.verificaciones = Array.isArray(reg.verificaciones) ? reg.verificaciones : [];
  const v = { id: 'VER-' + Date.now().toString(36), condicion, fecha, responsable, restricciones: condicion === 'Operativa con restricciones' ? restricciones : str(d.restricciones, 600),
    observaciones: str(d.observaciones, 1000), evidencia: str(d.evidencia, 600), registradoPor: str(d.registradoPor, 80), registrado: new Date().toISOString() };
  reg.verificaciones.push(v);
  if (!escribirC(c)) return { error: 'No se pudo guardar en este navegador.' };
  return { ok: true, verificacion: v };
}
/* Avisos que invitan a verificar de nuevo, sin concluir nada sobre la condición. */
export function avisosCondicion(e) {
  const a = [], v = verificaciones(e)[0], { abiertos, historial } = trabajosDeEquipo(e);
  if (abiertos.length) a.push(`Hay ${abiertos.length === 1 ? 'un trabajo abierto' : `${abiertos.length} trabajos abiertos`}: confirma si afecta el uso de la máquina.`);
  if (v && historial.some(t => t.estado !== 'Cancelado' && (t.fechaCierre || '').slice(0, 10) > v.fecha)) a.push('Se cerró una intervención después de la última verificación: conviene verificar de nuevo.');
  return a;
}

export const maquinas = () => T.equipos.filter(e => e.tipoRegistro === 'maquina');
export const generales = () => T.equipos.filter(e => e.tipoRegistro === 'general');
export const equipoPorId = id => T.equipos.find(e => e.id === id);
export const solicitudesDe = (e, clase) => T.solicitudes.filter(s => s.equipoOdooId === e.odooId && (!clase || s.clase === clase));
export const categorias = () => [...new Set(maquinas().map(e => e.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
export const urlOdooEquipo = e => (T.fuente ? `${T.fuente.url}/odoo/equipments/${e.odooId}` : '');
export const urlOdooSolicitud = s => (T.fuente ? `${T.fuente.url}/odoo/action-maintenance.hr_equipment_request_action/${s.odooId}` : '');

/* ── Seguimiento de trabajos abiertos (Etapa 4) ──
   Datos complementarios del dashboard para las solicitudes REALES abiertas: quién lo atiende, próxima acción,
   bloqueo o dependencia y un estado de seguimiento opcional. No cambian la etapa de Odoo ni se escriben en Odoo.
   Cada cambio queda en el historial con fecha y autor. Se comparte con el equipo (colección mant-trabajos). */
export const ESTADOS_SEGUIMIENTO = ['Programado', 'En espera', 'Pendiente de validación'];
const KT = 'ccs-infraestructura-v2:mant-trabajos';
const leerT = () => { try { const v = JSON.parse(localStorage.getItem(KT) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
export const seguimientoDe = s => { const v = leerT()[s.id]; return { atiende: '', proximaAccion: '', bloqueo: '', estado: '', fechaPrevista: '', historial: [], ...(v || {}) }; };
export function guardarSeguimiento(s, d, autor) {
  if (s.clase !== 'real' || !s.abierta) return { error: 'El seguimiento solo se registra en trabajos reales abiertos.' };
  const actual = seguimientoDe(s);
  const nuevo = { atiende: str(d.atiende, 120), proximaAccion: str(d.proximaAccion, 600), bloqueo: str(d.bloqueo, 600),
    estado: ESTADOS_SEGUIMIENTO.includes(d.estado) ? d.estado : '', fechaPrevista: /^\d{4}-\d{2}-\d{2}$/.test(d.fechaPrevista || '') ? d.fechaPrevista : '' };
  if (nuevo.estado === 'Programado' && !nuevo.fechaPrevista) return { error: 'Para «Programado» indica la fecha prevista.' };
  const cambios = Object.keys(nuevo).filter(k => nuevo[k] !== actual[k]);
  if (!cambios.length) return { sinCambios: true };
  const t = leerT();
  t[s.id] = { ...nuevo, historial: [...actual.historial, { fecha: new Date().toISOString(), autor: str(autor, 80), cambios: cambios.map(k => ({ campo: k, antes: actual[k], despues: nuevo[k] })) }].slice(-100) };
  try { localStorage.setItem(KT, JSON.stringify(t)); } catch { return { error: 'No se pudo guardar en este navegador.' }; }
  return { ok: cambios.length };
}
export const solicitudPorId = id => T.solicitudes.find(s => s.id === id);
export const equipoDeSolicitud = s => T.equipos.find(e => e.odooId === s.equipoOdooId) || null;
/* Quién atiende: el dato complementario; si no hay, se indica que en Odoo solo figura el usuario genérico. */
export const atiende = s => seguimientoDe(s).atiende || s.responsable || '';

/* ── Preventivos (Etapa 5) ──
   Solo rutinas DOCUMENTADAS: se leen de la descripción de cada equipo en Odoo, con la frecuencia tal como está escrita.
   No se inventan rutinas, intervalos ni calendarios. Una rutina documentada no es una rutina aprobada: la aprobación la
   registra una persona. La próxima fecha solo se calcula si la rutina está aprobada, su frecuencia es de calendario y
   hay una ejecución registrada; las frecuencias por uso («cada 300 h») no generan fechas. */
export const FRECUENCIAS = {
  diario: { orden: 1, nombre: 'Diario', dias: 1 }, semanal: { orden: 2, nombre: 'Semanal', dias: 7 },
  mensual: { orden: 3, nombre: 'Mensual', meses: 1 }, trimestral: { orden: 4, nombre: 'Trimestral', meses: 3 },
  semestral: { orden: 5, nombre: 'Semestral', meses: 6 }, anual: { orden: 6, nombre: 'Anual', meses: 12 }
};
const rxFrec = /^(diario|semanal|mensual|trimestral|semestral|anual)\s*:?\s*$/i;
const rxUso = /^cada\s+(\d+)\s*h(oras)?\b.*$/i;
const rxEtiqueta = /^(mantenimiento rutinario|tareas rutinarias|chequeos rutinarios)\s*:?\s*$/i;
export function rutinasDe(e) {
  const lineas = String(e.descripcion || '').split('\n').map(x => x.trim()).filter(Boolean);
  const out = []; let actual = null;
  for (const l of lineas) {
    const m = l.match(rxFrec), u = l.match(rxUso);
    if (m) { const k = m[1].toLowerCase(); actual = { id: `${e.id}|${k}`, equipoId: e.id, clave: k, frecuencia: FRECUENCIAS[k].nombre, orden: FRECUENCIAS[k].orden, uso: false, tareas: [] }; out.push(actual); continue; }
    if (u) { actual = { id: `${e.id}|uso-${u[1]}h`, equipoId: e.id, clave: `uso-${u[1]}h`, frecuencia: `Cada ${u[1]} h de trabajo`, orden: 9, uso: true, tareas: [] }; out.push(actual); continue; }
    if (rxEtiqueta.test(l)) { actual = null; continue; }
    if (actual) actual.tareas.push(l.replace(/:$/, ''));
  }
  return out.filter(r => r.tareas.length).sort((a, b) => a.orden - b.orden);
}
const KP = 'ccs-infraestructura-v2:mant-preventivos';
const leerP = () => { try { const v = JSON.parse(localStorage.getItem(KP) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const escribirP = v => { try { localStorage.setItem(KP, JSON.stringify(v)); return true; } catch { return false; } };
export const registroRutina = r => ({ aprobacion: null, ejecuciones: [], ...(leerP()[r.id] || {}) });
export function aprobarRutina(r, d) {
  const por = str(d.por, 120); if (!por) return { error: 'Indica quién aprueba la rutina.' };
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : ''; if (!fecha || fecha > hoyIso()) return { error: 'Indica una fecha de aprobación válida (no futura).' };
  const p = leerP(), x = p[r.id] || (p[r.id] = { ejecuciones: [] });
  x.aprobacion = { por, fecha, nota: str(d.nota, 600), registrado: new Date().toISOString() };
  return escribirP(p) ? { ok: true } : { error: 'No se pudo guardar en este navegador.' };
}
export function registrarEjecucion(r, d) {
  const reg = registroRutina(r); if (!reg.aprobacion) return { error: 'Primero debe aprobarse la rutina.' };
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : ''; if (!fecha || fecha > hoyIso()) return { error: 'Indica la fecha en que se hizo (no futura).' };
  const por = str(d.por, 120); if (!por) return { error: 'Indica quién la realizó.' };
  const p = leerP(), x = p[r.id] || (p[r.id] = { ejecuciones: [] });
  x.ejecuciones = [...(x.ejecuciones || []), { fecha, por, observaciones: str(d.observaciones, 1000), registrado: new Date().toISOString() }].slice(-500);
  return escribirP(p) ? { ok: true } : { error: 'No se pudo guardar en este navegador.' };
}
const sumarFrec = (iso, f) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d));
  if (f.dias) t.setUTCDate(t.getUTCDate() + f.dias); else { t.setUTCMonth(t.getUTCMonth() + f.meses); if (t.getUTCDate() !== d) t.setUTCDate(0); } return t.toISOString().slice(0, 10); };
/* Estado de la rutina: próxima fecha solo si es calculable con datos registrados. */
export function estadoRutina(r) {
  const reg = registroRutina(r), ult = reg.ejecuciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
  if (!reg.aprobacion) return { aprobada: false, ultima: ult, proxima: '', motivo: 'Documentada en Odoo; falta aprobarla.' };
  if (r.uso) return { aprobada: true, ultima: ult, proxima: '', motivo: 'Depende de las horas de uso: no se calcula una fecha.' };
  if (!ult) return { aprobada: true, ultima: null, proxima: '', motivo: 'Falta registrar la última ejecución para calcular la próxima.' };
  const proxima = sumarFrec(ult.fecha, FRECUENCIAS[r.clave]), hoy = hoyIso();
  return { aprobada: true, ultima: ult, proxima, vencida: proxima < hoy, motivo: '' };
}

/* ── Fotos (extraídas de Odoo el 16/11/2026, solo lectura; copia reducida en img/maquinas-taller/) ──
   Son las imágenes cargadas en cada equipo de Odoo; algunas parecen de catálogo. Tres pares de máquinas comparten
   exactamente la misma imagen (comparación de archivos): probablemente son imágenes de referencia del modelo. */
const FOTO_COMPARTIDA = { EH01: 'EH02', EH02: 'EH01', EH04: 'EH05', EH05: 'EH04', MV01: 'MV02', MV02: 'MV01' };
export const foto = e => (e.tieneFoto && e.codigo ? { src: `img/maquinas-taller/${e.codigo}.jpg`, compartidaCon: FOTO_COMPARTIDA[e.codigo] || '' } : null);

/* ── Trabajos del dashboard ──
   Los trabajos se crean, editan, cierran y eliminan directamente en el dashboard, independientes de Odoo (no se
   escribe nada en Odoo). Se comparten con el equipo (colección mant-ordenes) y cada cambio queda en su historial.
   El historial capturado de Odoo se conserva como consulta. Un trabajo abierto de Odoo puede pasarse al dashboard
   una sola vez («Gestionar en el dashboard»): se copia con referencia a Odoo y deja de listarse aparte. */
export const ESTADOS_ABIERTOS = ['Nuevo', 'En progreso', 'Programado', 'En espera', 'Pendiente de validación'];
export const ESTADOS_CERRADOS = ['Completado', 'Cancelado'];
export const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Crítica'];
export const TIPOS = ['Correctivo', 'Preventivo', 'Inspección', 'Mejora'];
const KO = 'ccs-infraestructura-v2:mant-ordenes';
const leerO = () => { try { const v = JSON.parse(localStorage.getItem(KO) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const escribirO = v => { try { localStorage.setItem(KO, JSON.stringify(v)); return true; } catch { return false; } };
const fechaOk = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const CAMPOS_ORDEN = { equipoId: 'Equipo', titulo: 'Trabajo', tipo: 'Tipo', prioridad: 'Prioridad', estado: 'Estado', atiende: 'Atiende', fechaReporte: 'Fecha de reporte',
  fechaPrevista: 'Fecha prevista', bloqueo: 'Bloqueo', proximaAccion: 'Próxima acción', descripcion: 'Descripción', diagnostico: 'Diagnóstico', intervenciones: 'Intervenciones',
  repuestos: 'Repuestos', costo: 'Costo', moneda: 'Moneda', evidencias: 'Evidencias', resultadoPruebas: 'Resultado de pruebas', fechaCierre: 'Fecha de cierre' };
export const etiquetaCampoOrden = k => CAMPOS_ORDEN[k] || k;

export const ordenes = () => Object.values(leerO()).filter(o => o && o.id).sort((a, b) => String(b.fechaReporte).localeCompare(String(a.fechaReporte)));
export const ordenPorId = id => leerO()[id] || null;
export const ordenAbierta = o => ESTADOS_ABIERTOS.includes(o.estado);
export const ordenDeOdoo = odooId => ordenes().find(o => o.origenOdoo === odooId) || null;

export function guardarOrden(d, id, autor) {
  const todas = leerO(), actual = id ? todas[id] : null;
  if (id && !actual) return { error: 'El trabajo ya no existe.' };
  const n = {
    equipoId: str(d.equipoId, 40), titulo: str(d.titulo, 200), tipo: TIPOS.includes(d.tipo) ? d.tipo : 'Correctivo',
    prioridad: PRIORIDADES.includes(d.prioridad) ? d.prioridad : 'Normal', estado: [...ESTADOS_ABIERTOS, ...ESTADOS_CERRADOS].includes(d.estado) ? d.estado : 'Nuevo',
    atiende: str(d.atiende, 120), fechaReporte: fechaOk(d.fechaReporte), fechaPrevista: fechaOk(d.fechaPrevista), bloqueo: str(d.bloqueo, 600), proximaAccion: str(d.proximaAccion, 600),
    descripcion: str(d.descripcion, 3000), diagnostico: str(d.diagnostico, 2000), intervenciones: str(d.intervenciones, 3000), repuestos: str(d.repuestos, 1500),
    costo: String(d.costo ?? '').trim() === '' ? null : Number(String(d.costo).replace(',', '.')), moneda: str(d.moneda, 10), evidencias: str(d.evidencias, 1500),
    resultadoPruebas: str(d.resultadoPruebas, 1500), fechaCierre: fechaOk(d.fechaCierre)
  };
  if (!equipoPorId(n.equipoId)) return { error: 'Elige la máquina.' };
  if (!n.titulo) return { error: 'Describe el trabajo o el problema.' };
  if (!n.fechaReporte) return { error: 'Indica la fecha de reporte.' };
  if (n.fechaReporte > hoyIso()) return { error: 'La fecha de reporte no puede ser futura.' };
  if (n.costo !== null && (!Number.isFinite(n.costo) || n.costo < 0)) return { error: 'El costo debe ser un número positivo.' };
  if (n.estado === 'Programado' && !n.fechaPrevista) return { error: 'Para «Programado» indica la fecha prevista.' };
  if (ESTADOS_CERRADOS.includes(n.estado)) {
    if (!n.fechaCierre) n.fechaCierre = hoyIso();
    if (n.fechaCierre < n.fechaReporte) return { error: 'La fecha de cierre no puede ser anterior a la de reporte.' };
    if (n.estado === 'Completado' && !n.intervenciones) return { error: 'Para completar el trabajo describe la intervención realizada.' };
  } else n.fechaCierre = '';
  const quien = str(autor, 80), ahora = new Date().toISOString();
  if (actual) {
    const cambios = Object.keys(CAMPOS_ORDEN).filter(k => JSON.stringify(n[k] ?? '') !== JSON.stringify(actual[k] ?? '')).map(k => ({ campo: k, antes: actual[k] ?? '', despues: n[k] ?? '' }));
    if (!cambios.length) return { sinCambios: true, orden: actual };
    todas[id] = { ...actual, ...n, actualizado: ahora, historial: [...(actual.historial || []), { fecha: ahora, autor: quien, cambios }].slice(-200) };
  } else {
    const nid = 'TR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    todas[nid] = { id: nid, ...n, origenOdoo: d.origenOdoo || null, creado: ahora, creadoPor: quien, actualizado: ahora,
      historial: [{ fecha: ahora, autor: quien, nota: d.origenOdoo ? `Pasado al dashboard desde la solicitud #${d.origenOdoo} de Odoo.` : 'Trabajo creado en el dashboard.' }] };
    id = nid;
  }
  return escribirO(todas) ? { ok: true, orden: todas[id] } : { error: 'No se pudo guardar en este navegador.' };
}
export function eliminarOrden(id) {
  const todas = leerO(); if (!todas[id]) return 'El trabajo ya no existe.';
  delete todas[id]; return escribirO(todas) ? '' : 'No se pudo guardar en este navegador.';
}
/* Copia una solicitud abierta de Odoo como trabajo del dashboard (una sola vez). Odoo no se modifica. */
export function gestionarEnDashboard(s, autor) {
  const ya = ordenDeOdoo(s.odooId); if (ya) return { ok: true, orden: ya, existente: true };
  const e = equipoDeSolicitud(s), g = seguimientoDe(s);
  const prio = { 0: 'Baja', 1: 'Baja', 2: 'Normal', 3: 'Alta' }[s.prioridad] || 'Normal';
  const desc = [s.descripcion, s.avisos.length ? `Avisos al pasar desde Odoo: ${s.avisos.join(' ')}` : ''].filter(Boolean).join('\n\n');
  return guardarOrden({ equipoId: e ? e.id : '', titulo: s.asunto, tipo: s.tipo === 'preventive' ? 'Preventivo' : 'Correctivo', prioridad: prio,
    estado: s.etapa === 'En progreso' ? 'En progreso' : (g.estado || 'Nuevo'), atiende: g.atiende, fechaReporte: s.fechaSolicitud, fechaPrevista: g.fechaPrevista,
    bloqueo: g.bloqueo, proximaAccion: g.proximaAccion, descripcion: desc, diagnostico: [s.falla, s.modoFalla].filter(Boolean).join('\n'), intervenciones: s.accion,
    origenOdoo: s.odooId }, null, autor);
}

/* ── Vista unificada de trabajos (dashboard + Odoo) para listas, fichas e indicadores ── */
const PRIO_N = { 'Baja': 1, 'Normal': 2, 'Alta': 3, 'Crítica': 4 };
const desdeOrden = o => ({ fuente: 'dashboard', id: o.id, act: 'mt-orden', equipoId: o.equipoId, titulo: o.titulo, tipo: o.tipo, prioridad: o.prioridad, prioridadN: PRIO_N[o.prioridad] || 2,
  estado: o.estado, abierta: ordenAbierta(o), atiende: o.atiende, proximaAccion: o.proximaAccion, bloqueo: o.bloqueo, fechaReporte: o.fechaReporte, fechaPrevista: o.fechaPrevista,
  fechaCierre: o.fechaCierre, avisos: [], resumen: o.descripcion.split('\n')[0] || o.titulo, origenOdoo: o.origenOdoo });
const desdeOdoo = s => { const e = equipoDeSolicitud(s), g = seguimientoDe(s);
  return { fuente: 'odoo', id: s.id, act: 'mt-trabajo', equipoId: e ? e.id : '', titulo: s.asunto, tipo: s.tipoTxt, prioridad: { 0: 'Muy baja', 1: 'Baja', 2: 'Normal', 3: 'Alta' }[s.prioridad] || 'Normal',
    prioridadN: Number(s.prioridad) || 0, estado: s.etapa, abierta: s.abierta, atiende: g.atiende || s.responsable, proximaAccion: g.proximaAccion, bloqueo: g.bloqueo || (s.bloqueada ? 'Bloqueado en Odoo (sin motivo)' : ''),
    fechaReporte: s.fechaSolicitud, fechaPrevista: g.fechaPrevista, fechaEjecucion: s.fechaProgramada, fechaCierre: s.fechaCierre, avisos: s.avisos, resumen: s.falla || (s.descripcion || '').split('\n')[0] || s.asunto }; };
/* Abiertos: los del dashboard + los reales de Odoo que todavía no se pasaron al dashboard (sin duplicar). */
export const trabajosAbiertos = () => [...ordenes().filter(ordenAbierta).map(desdeOrden),
  ...T.solicitudes.filter(s => s.clase === 'real' && s.abierta && !ordenDeOdoo(s.odooId)).map(desdeOdoo)].sort((a, b) => b.prioridadN - a.prioridadN);
export const historialTrabajos = () => [...ordenes().filter(o => !ordenAbierta(o)).map(desdeOrden),
  ...T.solicitudes.filter(s => s.clase === 'real' && !s.abierta).map(desdeOdoo)].sort((a, b) => String(b.fechaCierre || b.fechaEjecucion || b.fechaReporte).localeCompare(String(a.fechaCierre || a.fechaEjecucion || a.fechaReporte)));
export const trabajosDeEquipo = e => ({ abiertos: trabajosAbiertos().filter(t => t.equipoId === e.id), historial: historialTrabajos().filter(t => t.equipoId === e.id) });
export const abiertaPrincipal = e => trabajosAbiertos().find(t => t.equipoId === e.id) || null;
