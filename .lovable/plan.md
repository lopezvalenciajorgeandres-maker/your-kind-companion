# Respaldo Excel completo y restauración segura

## Objetivo
Convertir “Exportar todo / Importar todo” en una copia integral del negocio. Al importar, se combinarán los datos sin duplicarlos, conservando correctamente pagos, saldos, citas, tratamientos y relaciones.

## Qué incluirá el Excel
- Datos y configuración del negocio: nombre, contacto, ubicación, moneda, zona horaria y reservas.
- Clientes, incluidos municipio y departamento.
- Servicios y su configuración completa.
- Profesionales, colores, fotos y relación con los servicios que prestan.
- Tratamientos, número de sesiones, estado y valor total.
- Citas, estados, precios, profesional, tratamiento y firmas de conformidad.
- Pagos y abonos con método, banco, estado y vínculos con cita o tratamiento.
- Gastos y toda la información contable registrada.
- Paquetes y sesiones consumidas.
- Horarios, descansos, días bloqueados y vacaciones.
- Notas de clientes.
- Una hoja de saldos calculados para consulta: total, abonado y pendiente.
- Una hoja de control con versión, fecha y cantidades por sección.

## Restauración sin duplicados
- Incluir identificadores internos en las hojas para relacionar cada pago, cita y tratamiento con el registro correcto, incluso si existen clientes con el mismo nombre.
- Buscar primero por identificador; usar coincidencias seguras como respaldo para archivos anteriores.
- Actualizar registros coincidentes y agregar únicamente los faltantes.
- Restaurar en orden para mantener relaciones: clientes/servicios/profesionales, tratamientos y paquetes, citas, pagos, gastos, notas y horarios.
- Si una relación indispensable no puede recuperarse, no crear un registro contable huérfano; informarlo en el resultado.
- Mantener compatibilidad con los respaldos Excel actuales.

## Seguridad y exclusiones
- No restaurar suscripción, plan contratado, permisos de usuarios, historial de auditoría, credenciales de integraciones ni historial de copias.
- Validar estructura, versión, tamaños y tipos antes de guardar.
- Mostrar un resumen final de agregados, actualizados, omitidos y errores por sección.

## Interfaz
- Unificar la copia completa en Ajustes > Datos y conservar el acceso existente en Agenda.
- Explicar claramente que la importación combina sin duplicar.
- Añadir confirmación antes de importar y un resultado detallado al terminar.
- Retirar la copia JSON incompleta para evitar que se confunda con el respaldo restaurable.

## Verificación
- Crear un Excel de prueba con todas las hojas y revisar que no tenga errores.
- Probar una segunda importación del mismo archivo para confirmar que no duplica registros.
- Verificar que pagos, saldos, sesiones pagadas, contabilidad, firmas, servicios y profesionales se reconstruyan correctamente.
- Ejecutar las comprobaciones del proyecto y revisar el flujo visible en computador y celular.

## Detalles técnicos
No se requieren cambios en la estructura de la base de datos. Se ampliarán el exportador, importador, formato compartido del Excel y controles de importación; las relaciones se reconstruirán mediante los identificadores incluidos en la copia.
