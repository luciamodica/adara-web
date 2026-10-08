# Checklist de prueba de Adara Web

Probá en este orden para detectar errores sin mezclar datos:

1. Home: deben verse los planes Individual y Equipo y el selector Mensual / Anual.
2. Registro: crear una cuenta nueva.
3. Verificación: usar el botón local. Debe mostrar “Email verificado” y entrar al panel sin el error de enlace ya utilizado.
4. Servicios: crear un servicio con imagen y otro con descuento grupal (por ejemplo, 2+ personas = 15% OFF).
5. Mi página: subir portada y logo, probar al menos 3 plantillas distintas y comprobar que cambian la estructura (no sólo el color).
6. Editor: cambiar portada dividida/superpuesta, tipografía, tarjetas, botones y formato de imágenes; revisar la vista previa Desktop/Móvil y guardar.
7. Configuración: completar redes, email público, dirección, política de cancelación, WhatsApp y activar el botón flotante.
8. Configuración de reservas: cambiar anticipación mínima, habilitar/deshabilitar grupos y probar el email obligatorio.
9. Promociones: crear una promoción y activar “Mostrar como banner fijo arriba”.
10. Cupones: crear `BIENVENIDA10` con 10% de descuento.
11. Preguntas frecuentes: agregar dos preguntas, editar una, ocultarla/mostrarla y comprobar que aparecen en la página pública.
12. WhatsApp: abrir la página pública y comprobar que el botón verde aparece abajo a la derecha y abre el número configurado.
13. Agenda: configurar días y horarios de atención.
14. Página pública: seleccionar uno o varios servicios.
15. Reserva grupal: elegir 2 personas. Verificar que el tiempo total se duplique y que el descuento aparezca si corresponde.
16. Cupón: aplicar `BIENVENIDA10` y comprobar el nuevo total.
17. Fecha: elegir un día habilitado. Deben aparecer únicamente los horarios donde entra la duración completa.
18. Reserva: completar datos y confirmar.
19. Si hay seña o pago total en modo local, usar “Simular pago aprobado”.
20. Panel > Agenda: comprobar que el turno quedó guardado con cantidad de personas y cupón.
21. Antes de cancelar, intentar reservar el mismo horario desde otra pestaña: no debe volver a estar disponible.
22. En la confirmación de la clienta, abrir “Gestionar, reprogramar o cancelar mi turno”. Probar una reprogramación y verificar que sólo muestre horarios libres.
23. Cancelar la reserva desde ese mismo enlace y comprobar que el horario vuelva a quedar disponible.
24. Super Admin: ingresar con `admin@adaraweb.local / admin1234`.
25. Planes: cambiar precio del plan y comprobar que el Home se actualiza.
26. Crear un segundo plan pero dejarlo oculto: no debe aparecer públicamente.
27. Publicar el segundo plan: entonces sí debe aparecer en Home y registro.

## Ajustes de esta entrega

- Verificar que los textos pequeños “Buen día”, “Reservas online”, “Tu vidriera digital”, “Se publica automáticamente…” y “Una suscripción simple” ya no aparezcan.
- Confirmar que “Servicios” use un ícono genérico de brillo y no tijeras.
- Crear un turno y abrir **Agenda → Reservas → Editar**. Cambiar fecha, horario y datos de la clienta. El sistema debe rechazar horarios ocupados.
- Abrir la página pública y confirmar que el pie muestre discretamente **Creado con ADARA WEB**.
- En **Configuración → Google y avisos**, completar título/descripcion para Google y un email para avisos. Con email transaccional configurado, ese email recibe altas, cancelaciones, reprogramaciones y confirmaciones de pago.

## Prueba Plan Equipo

1. Entrar como Super Admin y confirmar que existen Adara Individual y Adara Equipo.
2. Crear una cuenta con Adara Equipo o cambiar una cuenta existente a ese plan desde Super Admin.
3. Ingresar al panel del negocio: debe aparecer **Equipo** en el menú.
4. Crear dos integrantes y asignar servicios diferentes.
5. Definir horarios distintos para cada integrante.
6. Abrir la página pública, seleccionar un servicio y verificar que aparezcan únicamente integrantes compatibles.
7. Elegir integrante, fecha y horario. Crear una reserva.
8. Confirmar que el turno aparece en Agenda indicando con quién fue reservado.
9. Intentar reservar el mismo horario con el mismo integrante: debe bloquearse. Un integrante diferente puede tener disponibilidad propia.

## Prueba módulos del sitio

En **Mi página** o **Configuración**, desactivar Servicios, Reservas, Promociones, Novedades o FAQ y comprobar que la sección desaparece de la página pública. Volver a activarla y verificar que reaparece.

## Prueba precio especial

1. Entrar a Super Admin → Negocios.
2. Elegir una cuenta y completar **Precio especial mensual** o **anual**.
3. Entrar con esa cuenta y abrir **Plan**.
4. Confirmar que se muestra el precio personalizado y no se modifica el precio público del plan para otras cuentas.
5. Vaciar el precio especial y confirmar que vuelve a usar el precio general.

## Privacidad del Super Admin

Confirmar que el Super Admin muestra cuentas, planes, estado de suscripción y métricas de plataforma, pero no expone el listado global de reservas ni las clientas de los negocios.


## Herramientas agregadas

`npm test` ejecuta 703 comprobaciones con bases temporales. Incluye separación entre negocios, dos agendas de equipo atendiendo a la vez, aceptación de términos, bloqueo, regla de dos ausencias, descuento de canje, devolución de sesión, canje sin duplicación, series completas o rollback, avisos sin duplicación, cancelación de recordatorio viejo, QR PNG, exportación y creación/cancelación de eventos de Google con transporte simulado. Para las pruebas de despliegue, primero ejecutá `npm run build`.

Prueba manual con proveedores antes de producción:

1. Herramientas → Agenda especial: abrir una fecha normalmente cerrada, cerrar una fecha normalmente abierta y verificar disponibilidad pública.
2. Completar todos los horarios de una fecha. Anotarse en espera desde la web y cancelar una reserva; comprobar el aviso en Recordatorios.
3. Configurar un recordatorio a una hora de un turno de prueba; comprobar recepción por email y WhatsApp. Confirmar asistencia desde el enlace privado.
4. Crear pack, asignarlo a una clienta después de recibir el pago y reservar una sesión con el código. Cancelarla y comprobar que vuelve a estar disponible.
5. Marcar turno Completado; comprobar puntos y canjear descuento. Marcar dos ausencias y verificar que la próxima reserva exija pago completo.
6. Crear serie cada 21 días desde el panel y desde la web sin pago online. Si una fecha está ocupada, no debe crearse parcialmente.
7. Generar QR y descargar la tarjeta con logo; escanearla desde un teléfono y comprobar que abre el sitio correcto.
8. Exportar clientas y turnos; abrir el CSV en Excel y comprobar precios en pesos.
9. Conectar Google con OAuth real, confirmar, reprogramar y cancelar un turno. Comprobar los tres cambios en el calendario principal.
10. Probar consentimiento de Analytics/Meta en un navegador nuevo: rechazar no debe cargar etiquetas externas.

Los tests locales no verifican autorización de Google ni entrega de mensajes reales. Los proveedores sin conectar se muestran como modo local o sin configurar.

Validación visual realizada en navegador Chromium, con escritorio de 1440 px y móvil de 390 px: navegación de todas las herramientas, generación de QR y formulario público sin errores de JavaScript ni desbordamiento horizontal en móvil.

## Home y reservas pendientes

1. Abrir Home: seis ejemplos de web de escritorio, sin marcos de celular. Revisar también a 390 px, sin desbordamiento horizontal.
2. Planes: un nombre por tarjeta, sin las antiguas etiquetas repetidas. La prueba debe decir 15 días, o 7 si así se configura desde Super Admin.
3. En Pagos, guardar un plazo de 30 minutos y exigir seña. Reservar desde otra pestaña: Agenda debe mostrar Esperando pago, importe y tiempo restante sin recargarla.
4. Cambiar el plazo a una hora: la reserva existente debe conservar su vencimiento y la siguiente usar el nuevo plazo.
5. Dejar vencer una reserva: se cancela, libera el horario y aparece en Todos como Plazo vencido. Su enlace privado explica el vencimiento.
6. Completar el pago antes del plazo: pasa a Confirmado y desaparece el contador.
7. Verificar con Mercado Pago de prueba un pago tardío: queda registrado para revisión, sin reconfirmar un turno cancelado ni desplazar una nueva reserva.
8. Completar logo, colores y contactos; descargar QR con logo y tarjeta. Ambos deben abrir el sitio correcto al escanear. Cambiar plantilla y volver a generar.

La prueba visual en Chromium verificó Home en 1440 y 390 px, QR descargados con logo para Rose, Noir, Sage de tono claro y Pearl mediante un decodificador, actualización automática de Agenda, vencimiento y guardado del plazo. Las 363 comprobaciones de API incluyen aislamiento del ajuste por negocio, validación de plazos, migración de prueba, vencimiento, pago a tiempo, pago tardío, pago incompleto y webhooks repetidos o fuera de orden.

## Home y períodos desde/hasta

1. Home: explorar las pestañas Agenda & reservas, Tu página web y Señas & pagos; tocar un turno del ejemplo de agenda, cambiar Mensual/Anual y abrir una pregunta frecuente. En celular, abrir/cerrar el menú y verificar que no haya desplazamiento horizontal.
2. Agenda → Días libres y horarios no disponibles: comprobar que la fecha y el motivo ocupan filas amplias. Desmarcar Todo el día, cargar horas desde/hasta y guardar. El final debe ser posterior al inicio.
3. Herramientas → Agenda especial: cargar Fecha desde y Fecha hasta, elegir Vacaciones o día libre y guardar tres días. La página pública no debe ofrecer turnos en esos tres días.
4. En Períodos guardados, tocar Editar período. Deben cargarse ambas fechas anteriores. Cambiar el rango a otras fechas y guardar: las originales deben volver a usar la agenda habitual.
5. Cambiar a Horario especial, indicar apertura/cierre y guardar. Solo deben ofrecerse horarios en los que entra el servicio completo.
6. En Equipo, elegir una profesional y comprobar que las otras conservan su horario. Los períodos de una profesional tienen prioridad sobre los de todo el negocio.
7. Probar un rango invertido, un horario invertido y dos períodos superpuestos para el mismo ámbito. Deben rechazarse sin perder lo guardado.
8. Si había turnos reservados en las fechas elegidas, deben conservarse y el formulario debe avisar cuando quedan fuera del nuevo horario.
9. Eliminar un período: su rango recupera el horario habitual; otros bloqueos y reservas se mantienen.
10. Al actualizar una instalación anterior, comprobar que los horarios especiales de un día aparecen en Períodos guardados y permiten edición.

Validación de esta entrega: compilación, 363 comprobaciones de integración y navegación real en escritorio y celular.


## Home, FAQ, transferencias y excepciones por clienta

1. Home: comparar sus colores con Registro y el panel. Los ejemplos de plantilla deben mostrar la nueva foto; la agenda utiliza horarios y tarjetas de reservas del panel real con datos de ejemplo. Probar el filtro Pagos pendientes y Editar.
2. Super Admin → FAQ de la Home: agregar una pregunta, editar respuesta y orden, ocultarla y volver a mostrarla. La Home debe reflejar cada cambio al recargar. Probar `{dias_prueba}` con prueba de 7 y 15 días. Eliminar una pregunta no debe recrearla al reiniciar.
3. Pagos: exigir seña y habilitar transferencia con alias y titular. Desactivar Mercado Pago. Reservar desde la web; debe mostrar instrucciones y quedar Esperando pago, sin ofrecer una simulación de transferencia aprobada.
4. Enviar un PDF, JPG o PNG como comprobante desde el enlace privado. Debe mantenerse pendiente y conservar el plazo. Un archivo de otro tipo o de más de 5 MB se rechaza.
5. Agenda: abrir Ver comprobante, revisar el ingreso real y Confirmar transferencia. Debe exigir importe suficiente y verificación expresa. Con pago confirmado, el turno sigue ocupado y se elimina el contador. La clienta ve el estado actualizado en su enlace.
6. Dejar vencer otra reserva de transferencia sin confirmarla: se cancela y libera el horario aunque haya enviado comprobante. No debe poder confirmarse sobre una nueva reserva de ese horario.
7. Clientas: seleccionar Sin anticipo y abrir el enlace privado generado. Debe precargar datos y confirmar sin pago previo, conservando el precio para cobrar al asistir. La web pública común no concede el permiso sólo por ingresar esos mismos datos.
8. Cambiar el WhatsApp o email de la titular al reservar por el enlace privado: rechazar. Renovar el enlace: el anterior ya no sirve. Quitar Sin anticipo también revoca el permiso. La condición no desbloquea a una clienta bloqueada.
9. Agenda: crear otro turno pendiente y Autorizar sin anticipo. Exigir casilla de autorización; confirmar conservando el precio y sin modificar la regla de futuras reservas.
10. Activar ambos medios: mostrar elección de transferencia o Mercado Pago. Mantener la confirmación automática de Mercado Pago mediante sus notificaciones verificadas. El comprobante bancario nunca equivale a esa notificación.
11. Revisar Pagos, la reserva privada, Agenda, Clientas y FAQ de Super Admin a 390 px: sin desplazamiento horizontal ni acciones cortadas. La visita con permiso privado no debe cargar Analytics o Meta aun con consentimiento anterior.

Estas pruebas se ejecutan con datos temporales. La validación de un ingreso bancario real corresponde a la profesional y no se simula como acreditación automática.


## Suscripciones de la plataforma

1. Panel → Plan: revisar el precio normal y el especial asignado al negocio; alternar Mensual/Anual.
2. El botón debe exigir la casilla que autoriza el importe y frecuencia. Usar el email de la cuenta de Mercado Pago que autorizará la suscripción.
3. Sin credenciales, en desarrollo, preparar la suscripción y simular un primer pago. Debe indicar que no se cobra dinero. Mostrar Activa, período e historial.
4. Cancelar renovación: exigir una confirmación y conservar el período pagado. Crear otra suscripción anual: respetar el vencimiento del período anterior.
5. Super Admin → Suscripciones: revisar contratos, cuotas y cancelación; no deben aparecer reservas ni clientas de los negocios.
6. Cambiar un precio especial: el contrato anterior conserva su importe. Para cambiar el contrato, cancelar y volver a autorizar.
7. Configurar 0, 3 o 14 días de gracia. Sólo se aplica a renovaciones pendientes tras un período pagado; no alarga la prueba ni una suscripción cancelada.
8. Vencido el acceso, permitir consultar datos y gestionar turnos existentes, pero rechazar la edición del sitio y las nuevas reservas. Un pago válido reactiva el acceso salvo suspensión administrativa.
9. Una bonificación $0 se activa administrativamente, sin crear un débito de $0.
10. Con proveedores de prueba configurados en una URL HTTPS, verificar autorización, primer pago, próximo cobro, cancelación y avisos. Las pruebas locales no certifican una cuenta de Mercado Pago ni una acreditación real.

La entrega pasó 703 comprobaciones: 363 de funciones, 261 de suscripciones y 79 de despliegue. Las pruebas de despliegue verifican claves obligatorias, URL HTTPS, almacenamiento persistente, reinicio sin pérdida de cuentas e imágenes, archivos privados, copia SQLite, acceso propio de Super Admin, simulaciones desactivadas y fallos de email sin exponer enlaces locales. Las pantallas y acciones de Plan y Super Admin también fueron verificadas en Chromium en 1440 y 390 px.
