/* Informes fijos de las investigaciones: contenido entregado por Infraestructura, de solo lectura.
   Se muestra en Resultados, antes de la conclusión (que sigue siendo editable). */
const INFORMES = {
  'ii-extintores': {
    titulo: 'Informe general de extintores',
    fecha: '2026-11-23',
    origen: 'Informe de Infraestructura «Informe general de extintores» (23/11/2026, versión actualizada).',
    resumen: 'Se identificó una compra prioritaria para Ensamblaje. Oficinas también reporta ausencia de extintores propios. Tienda y Almacén 1 tienen un equipo portátil cada uno, con cobertura por confirmar.',
    locales: [
      { espacio: 'Ensamblaje', detalle: 'Local M2', estado: 'falta',
        resultado: 'Sin extintor propio ni operativo cercano. Recorrido verificado de ~2 m al punto junto al clóset.',
        porHacer: 'Validar visibilidad y acceso al punto. Definir zona de carga y evaluar protección para las EcoFlow.' },
      { espacio: 'Oficinas', detalle: 'Locales 24 y 25 · 180 m² en total', estado: 'falta',
        resultado: 'Local 24 de 120 m² y local 25 de 60 m². Se reportó ausencia de extintores en el área revisada.',
        porHacer: 'Verificar extintores, recorridos y salidas en ambos locales para definir cantidad y puntos.' },
      { espacio: 'Tienda', detalle: 'Local 28 · 70 m²', estado: 'tiene',
        resultado: 'Un ABC de 3,2 kg junto a la puerta, visible y accesible. Recorrido de ~5 m. Servicio en abril de 2026.',
        porHacer: 'Confirmar operatividad, potencial de extinción e intervalo de servicio. Identificar muestras inflamables.' },
      { espacio: 'Almacén 1', detalle: 'Locales 29A/29B · 130 m²', estado: 'tiene',
        resultado: 'Un ABC en la entrada y tres bolas vencidas, excluidas del conteo operativo.',
        porHacer: 'Verificar el ABC, medir recorridos desde ambos locales y cuantificar cartón, plásticos, aceites y aerosoles.' },
      { espacio: 'Almacenes 2 y 3', detalle: 'Almacén 2 · Local 27 · 65 m² / Almacén 3 · Local M1', estado: 'pendiente',
        resultado: 'Inspección pendiente en ambos almacenes. Superficie de M1 por confirmar.',
        porHacer: 'Levantar inventario de extintores, riesgos, salidas y recorridos de cada almacén.' }
    ],
    compra: [
      { espacio: 'Ensamblaje', texto: '1 extintor portátil de polvo químico seco ABC. Cotizar con 2A como referencia inicial, sujeta a confirmar el riesgo y la carga calorífica.' },
      { espacio: 'Oficinas', texto: '1 ABC para cotización preliminar. Confirmar cantidad y potencial de extinción tras verificar la cobertura de los locales 24 y 25.' },
      { espacio: 'Almacén 1', texto: '1 ABC condicionado a la revisión del equipo actual y a la cobertura de 29A/29B. Para cotizar, usar 4A:40B:C como referencia preliminar.' },
      { espacio: 'Tienda', texto: '1 ABC de reemplazo solo si el actual falla la inspección o su potencial resulta insuficiente.' }
    ],
    notasCompra: 'Pedir ficha técnica, potencial completo y respaldo de certificación del modelo. Cotizar también la inspección de los dos extintores existentes. Definir cantidades para Almacenes 2 y 3 tras el levantamiento.',
    base: ['FONDONORMA 1040:2006, tabla 3', 'Cuadro de locales e informes de Ensamblaje, Tienda y Almacén 1']
  }
};
export const informe = id => INFORMES[id] || null;
