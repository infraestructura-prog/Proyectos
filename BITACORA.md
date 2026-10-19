## Sesión: [2026-10-19 - 15:45]

### Objetivo de la Sesión
- Construir el espacio de trabajo del Departamento de Ensamblaje (bienvenida, Neotropya › Nodos, Infraestructura › Máquinas de simulación) listo para GitHub y Vercel.

### Resumen de Cambios
- **Archivos Creados:** index.html, assets/css/app.css, assets/js/{app,registry,config,ui,api}.js, assets/js/modules/{nodos,maquinas}.js, shared/{machines-core,reference-snapshot}.js, api/{machines,reference,auth}.js, api/_lib/{google,auth,http}.js, scripts/hash-password.{ps1,mjs}, package.json, vercel.json, .env.example, .gitignore, README.md, BITACORA.md
- **Archivos Modificados:** N/A (el nodo-dashboard.html original se conserva sin cambios)
- **Archivos Eliminados:** N/A
- **Comandos / Herramientas Ejecutadas:** lectura de la hoja de Nodos (CSV público) y de «Codificación de Máquinas de Simulación» (Google Drive); servidor estático local en PowerShell para pruebas; pruebas en el navegador integrado con /api simulado en la página.

### Tareas Completadas
- [x] Bienvenida, navegación por rutas, migas de pan y cambio de área
- [x] Integración de Nodos con datos en vivo; error con reintento; demostración solo bajo demanda
- [x] Máquinas: vendidas / en stock / referencia, tarjetas y tabla, filtros, ficha, formularios accesibles
- [x] Validación compartida cliente-servidor, duplicados, idempotencia, control de versión
- [x] Funciones de servidor para Google Sheets y autenticación (escritas, sin probar contra Google)
- [x] Corregido: eventos del módulo anterior seguían activos al cambiar de subventana

### Pendientes / Próximos Pasos
- [ ] Crear cuenta de servicio de Google y variables de entorno en Vercel
- [ ] Desplegar y probar /api/auth y /api/machines en Vercel
- [ ] Confirmar la relación entre bloques, la regla de codificación y la asociación de imágenes
- [ ] Definir dónde se publica en GitHub (repositorio infraestructura-prog/Proyectos)
