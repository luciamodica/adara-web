# Meta Pixel para el Home de Adara Web

## Activación

1. Aplicar los archivos y esperar el despliegue de Render.
2. Entrar a **Super Admin → Configuración → Meta Pixel del Home de Adara**.
3. Pegar sólo el ID numérico del Pixel/conjunto de datos de Adara, marcar **Activar Meta Pixel del Home** y guardar. No pegar código HTML, access token ni client secret.
4. En el Home, abrir **Preferencias de medición**, aceptar **Publicidad (Meta Pixel)** y guardar la selección, o aceptar todo.
5. En el Administrador de eventos de Meta, consultar **Probar eventos** para ese Pixel y abrir el Home. Verificar PageView, tocar crear cuenta y verificar RegistrationStart. CompleteRegistration sólo debe aparecer después de que la API cree una cuenta correctamente.

La configuración es independiente de Google Analytics y de los IDs de cada profesional. No exige nuevas variables de Render, credenciales de WhatsApp ni dependencias.

## Eventos y consentimiento

| Acción | Evento de Meta |
| --- | --- |
| Visita al Home o al registro | PageView |
| Clic del Home para iniciar el registro | RegistrationStart (personalizado) |
| Cuenta creada por la API, antes de verificar el email | CompleteRegistration |

No representa contratación pagada, suscripción aprobada ni verificación de email. No se envía ningún evento Purchase.

El aviso permite elegir **Estadísticas (Google Analytics)** y **Publicidad (Meta Pixel)** por separado. La aceptación anterior de Analytics no activa Meta. Se puede rechazar o cambiar la elección en Preferencias de medición. No se carga ningún archivo de Meta antes de consentir. Al rechazar o salir del Home/registro, se elimina el documento del Pixel.

La etiqueta queda en un documento propio, con la URL limitada a `/` o `/registro`, configuración automática desactivada y sin asociación avanzada de datos de los formularios. Los eventos escritos por Adara no incluyen nombre, email, teléfono, contraseña, token o importes pagados. Los paneles, reservas y páginas de profesionales no reciben el Pixel de la plataforma. Las solicitudes del propio SDK de Meta pueden incluir identificadores del navegador, cookies y datos técnicos de conexión, como parte del servicio externo autorizado.

Guardar la configuración no confirma la entrega a Meta. Hay que comprobarla en el Administrador de eventos después del despliegue, con un ID válido y consentimiento. Los bloqueadores pueden impedir la carga.

## Información de privacidad del Home

Revisar la sección de cookies de la política publicada en el Super Admin. Este texto describe el nuevo funcionamiento; los textos ya publicados y sus registros de aceptación no se alteran automáticamente con esta actualización:

> En el Home y el registro de Adara Web podés elegir por separado Estadísticas (Google Analytics) y Publicidad (Meta Pixel). Analytics mide visitas, clics y creación de cuentas. Meta Pixel permite medir resultados de anuncios y crear públicos de publicidad en Instagram y Facebook. Estas herramientas sólo cargan después de tu autorización correspondiente. Pueden tratar datos técnicos de navegación y conexión e identificadores de cookies, conforme a las condiciones de Google y Meta. Adara no incluye nombre, email, teléfono o contraseña de los formularios en esos eventos. Rechazar no impide usar el sitio. Podés cambiar tus elecciones en Preferencias de medición. Las páginas de los profesionales tienen sus propias configuraciones y elecciones de consentimiento.

## Aplicar

Reemplazar **src**, **server**, **tests**, **package.json** y **ACTUALIZACION.md**. Conservar `.env`, base de datos e imágenes subidas.

```powershell
npm run build
npm test
git add src server tests package.json ACTUALIZACION.md
git commit -m "Agregar Meta Pixel al Home de Adara"
git push
```

Validación local: build y 1.895 comprobaciones, incluidas 131 de Meta Pixel del Home. Se validan permisos, guardado atómico, IDs, consentimiento separado, preferencia anterior, eventos, carga por HTTP, URLs sin datos privados, eliminación de etiquetas y convivencia con Analytics. El SDK externo se simula en las pruebas: no se envían eventos reales a Meta durante las pruebas locales.

Fuentes técnicas: implementación oficial de Meta en https://github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl (consent, autoConfig, disablePushState, trackSingle y trackSingleCustom).

---

# Ajuste de carga de Google Analytics del Home

La configuración y el ID ya guardados se conservan. No hay que crear otra propiedad ni cambiar variables de Render.

La etiqueta ahora carga desde un documento HTML de Adara con una URL propia, en lugar de `srcdoc`. Los eventos quedan en espera hasta recibir la confirmación de que el archivo de Google terminó de cargar. La carga del marco por sí sola ya no se considera una etiqueta lista. Se comprueban el origen, el marco, el canal y el ID antes de enviar eventos.

Se mantiene el consentimiento obligatorio, la separación de las páginas de profesionales y la exclusión de paneles, reservas y enlaces privados. El marco se elimina al salir del Home o el registro y al rechazar la medición. El documento usa el origen real del navegador para funcionar tanto en el dominio principal como en sus alias.

## Aplicar y probar

Reemplazar **src**, **server**, **tests** y **ACTUALIZACION.md** con los del ZIP. Conservar `.env`, datos e imágenes subidas.

```powershell
npm run build
npm test
git add src server tests ACTUALIZACION.md
git commit -m "Corregir carga de Analytics del Home"
git push
```

Tras el despliegue de Render, abrir el Home en incógnito, aceptar la medición, visitar el registro y consultar Tiempo real en la propiedad correspondiente. Un bloqueador puede impedir la carga de Google.

Validación local: build y 1.764 comprobaciones, incluidas 122 de Analytics del Home. Se prueba la respuesta HTML real por HTTP, los eventos y la confirmación de carga simulada. Las pruebas no contactan a Google; la recepción real debe comprobarse después del despliegue.

---

# Google Analytics para el Home de Adara Web

## Activación

1. Aplicar esta actualización y desplegarla en Render.
2. Entrar a **Super Admin → Configuración → Google Analytics del Home de Adara**.
3. Pegar el ID de medición de la propiedad del Home, por ejemplo `G-XXXXXXXXXX`.
4. Marcar **Activar Google Analytics del Home** y guardar.
5. Abrir el Home en una ventana de incógnito y aceptar la medición.
6. Consultar **Google Analytics → Informes → Tiempo real**. Probar también un clic de registro. Un bloqueador de publicidad puede impedir el envío.

## Qué se mide

- `page_view`: visita a `/` y `/registro`.
- `registration_start`: clic desde el Home para empezar el registro.
- `sign_up`: la API creó la cuenta correctamente, antes de que se verifique el correo. No representa una suscripción pagada ni una cuenta con email verificado.

La elección de consentimiento del Home es independiente de la de cada profesional. Se puede cambiar desde **Preferencias de medición**. Rechazar o desactivar el ID detiene la medición.

La etiqueta de la plataforma sólo funciona en el Home y el registro. Usa un documento aislado que se elimina al cambiar a otras rutas; no se instala en los paneles, reservas, enlaces privados, recuperación de contraseña ni páginas de profesionales. Los eventos incluyen únicamente el nombre del evento y la ruta pública canónica; se omiten consultas de URL, fragmentos, nombres, correos, contraseñas y tokens. El origen de referencia se limita al dominio externo. No se activan Google signals ni personalización publicitaria.

Esta configuración conecta Google Analytics. Meta Pixel de los profesionales conserva su configuración existente. No hay nuevas variables de Render ni dependencias.

## Aplicar los archivos

Reemplazar **src**, **server**, **tests**, **package.json** y **ACTUALIZACION.md** dentro del proyecto actual. Conservar los archivos privados de entorno, la base de datos y las imágenes subidas.

```powershell
npm run build
npm test
git add src server tests package.json ACTUALIZACION.md
git commit -m "Agregar Google Analytics al Home de Adara"
git push
```

Validación local: build y 1.740 comprobaciones. Las 98 nuevas verifican configuración, permisos, consentimiento, eventos, rutas privadas, aislamiento y ausencia de datos personales en los mensajes. La recepción en Google Analytics debe comprobarse con el ID real tras desplegar; las pruebas locales no contactan a Google.

---

# Turnos manuales, QR personalizable y soporte

- **Turnos**: nueva sección para ver, editar y cancelar reservas online y manuales. “Agregar turno manual” permite seleccionar uno o varios servicios, cliente nuevo o existente, fecha, horario y agenda del profesional (plan Equipo). El email y WhatsApp del cliente son opcionales. Si hay email, el profesional puede pedir una confirmación por correo.
- Un turno manual se confirma sin cobro online ni pagos ficticios. Adara comprueba disponibilidad para toda su duración dentro de los horarios configurados, vacaciones, bloqueos e intervalos. La carga manual permite horarios de hoy sin exigir la anticipación mínima de las reservas públicas. El importe de los servicios queda informado; el cobro se acuerda con el cliente.
- Los turnos manuales ocupan los horarios de la página, aparecen en el historial y se sincronizan hacia Google Calendar si está conectado. Reprogramarlos o cancelarlos actualiza la disponibilidad y la sincronización.
- **Agenda**: horarios habituales, días libres, bloqueos, vacaciones, horarios temporales, turnos recurrentes y condiciones de reserva. “Agenda especial” deja de estar en Herramientas. El enlace “Ver y gestionar turnos” abre la nueva sección.
- **Herramientas → Compartir mi página**: editor de tarjeta QR con vista previa automática, tres diseños, tres tipografías, colores propios o los de la página, imagen de fondo, intensidad, tamaño del logo y opción de mostrarlo dentro del código. Se conserva una zona blanca y suficiente contraste para escanear. Guardar antes de descargar el PNG.
- **Super Admin → Configuración → Redes de Adara Web**: enlaces completos HTTPS a Instagram, Facebook, TikTok, YouTube y LinkedIn. Los campos vacíos se omiten en el Home.
- **Home → Soporte**: formulario con nombre, email y mensaje, enlace a adaraweb23@gmail.com y WhatsApp cuando esté habilitado en la configuración de la plataforma.
- **Super Admin → Soporte**: consultas guardadas, estado Nueva/Leída/Resuelta y enlace para responder por email. Las consultas se conservan aunque falle el aviso a adaraweb23@gmail.com. El aviso usa el proveedor de correo ya configurado; no se envían respuestas automáticas al visitante.

## Aplicar la actualización

Copiar y reemplazar **src**, **server**, **tests**, **package.json** y **ACTUALIZACION.md** dentro del proyecto actual. Conservar los archivos privados de entorno, la base de datos y las imágenes ya subidas. No reemplazar una instalación existente borrando sus carpetas de datos.

```powershell
npm run build
npm test
git add src server tests package.json ACTUALIZACION.md
git commit -m "Agregar turnos manuales, editor QR y soporte"
git push
```

Render aplica las columnas y tablas nuevas al iniciar. No hay nuevas dependencias ni variables obligatorias. El email de soporte utiliza RESEND_API_KEY y EMAIL_FROM existentes.

## Comprobación después del despliegue

1. En Turnos, crear un turno manual para una fecha disponible. Comprobar que se vea como “Cargado manualmente” y que su horario ya no esté disponible en la página pública.
2. Reprogramar y cancelar: comprobar la liberación del horario y, con Google conectado, la actualización del evento.
3. En Agenda, comprobar períodos especiales y el enlace a Turnos.
4. En Herramientas → Compartir mi página, elegir fondo/colores/tipografía, guardar y descargar la tarjeta. Escanear el QR.
5. En Super Admin → Configuración, guardar redes y comprobar el pie del Home.
6. En el Home, enviar una consulta de prueba. Revisarla en Super Admin → Soporte y comprobar el aviso por correo. Marcarla Resuelta después de probar.

Validación local: build, 1.642 comprobaciones de integración y 36 lecturas de QR en 18 variantes de tarjeta. Los envíos de prueba utilizaron proveedores simulados, sin mensajes a personas reales. La revisión visual del panel en el navegador y la entrega real del correo deben comprobarse tras desplegar.

---

# Actualización de Adara Web

## WhatsApp manual para recordatorios y lista de espera

- **Agenda → Reservas → Recordatorio por WhatsApp:** disponible para próximos turnos confirmados. Adara prepara el nombre del cliente, negocio, fecha, horario, servicio y el enlace privado de la reserva para confirmar asistencia, reprogramar o cancelar.
- **Herramientas → Recordatorios → Próximas asistencias:** incluye el mismo botón. Los recordatorios automáticos por email conservan su configuración y horarios; el WhatsApp manual se abre cuando la profesional lo decide.
- Antes de abrir WhatsApp podés revisar y editar **el destinatario y el mensaje**, o **Copiar mensaje**. Incluí el código de país en el teléfono. Estos cambios son sólo para ese mensaje: no modifican la ficha del cliente ni la reserva.
- **Abrir WhatsApp** vuelve a comprobar el turno. Si cambió su información, muestra el borrador actualizado para revisarlo. Si fue cancelado, completado o ya comenzó, no permite abrir el recordatorio. El envío se completa tocando **Enviar dentro de WhatsApp**.
- **Herramientas → Lista de espera → Avisar por WhatsApp:** prepara el aviso sólo si los servicios y el profesional siguen disponibles y hay un horario libre en ese momento. El aviso lleva al enlace público de reservas y explica que no guarda el horario.
- Preparar, copiar o abrir el chat no marca el mensaje como enviado o recibido, no confirma asistencia, no crea trabajos de envío ni modifica el estado del turno o de la solicitud.
- No necesita tokens, plantillas, verificación de Meta ni nuevas variables de Render. El modo manual aparece disponible en Herramientas. El control de WhatsApp automático se muestra sólo cuando el proveedor está configurado; la integración de API se conserva para una futura activación.
- La vista previa funciona en celular y computadora, con el ícono de WhatsApp, campos editables, cierre por Escape, foco de teclado y fondo sin desplazamiento. Los mensajes se preparan mediante endpoints privados que verifican el negocio dueño de cada reserva o solicitud; el Super Admin no recibe reservas de profesionales.

### Instalar esta actualización

Extraé el ZIP en otra carpeta. Desde **adara-web**, combiná y reemplazá **src**, **server** y **tests** en tu proyecto actual. Reemplazá también **package.json** y **ACTUALIZACION.md**. Conservá **.env**, **data** y tus imágenes en **server/uploads**; no borres esas carpetas.

Desde la carpeta de tu proyecto en PowerShell:

```powershell
npm run build
npm test
git add src server tests package.json ACTUALIZACION.md
git commit -m "Agregar recordatorios y avisos manuales por WhatsApp"
git push
```

Cuando Render termine el despliegue, recargá el panel. Abrí un próximo turno confirmado y usá **Recordatorio por WhatsApp → Abrir WhatsApp → Enviar**. Si el número guardado no incluye código de país, corregilo en el borrador. No hay migraciones ni cambios de credenciales para este modo.

Validación: compilación de producción, **1.459 comprobaciones de integración** (69 nuevas de WhatsApp manual) y **39 comprobaciones en navegador**. Se verificaron permisos, aislamiento, enlaces privados, cambios recientes, estados, disponibilidad de lista de espera, edición, copiado, números inválidos, ausencia de envíos automáticos y tamaños de 320, 390, 768 y 1280 px. Las pruebas usan datos ficticios y no envían mensajes reales.

---

## Contraseñas, intervalos configurables y duración de servicios

- **Ingresar → Olvidé mi contraseña:** ingresá el email de tu cuenta. El enlace enviado por email permite elegir una nueva contraseña, vence en 30 minutos y sirve una sola vez. El formulario da la misma respuesta para emails registrados y no registrados. No modifica la contraseña hasta que se completa el enlace.
- **Panel profesional y Super Admin → Cambiar contraseña:** ingresá la contraseña actual y repetí la nueva. Mínimo 8 caracteres para profesionales y 12 para Super Admin. Al cambiarla o restablecerla, se cierran las sesiones anteriores y se invalidan los enlaces de recuperación pendientes. Después ingresás normalmente con la nueva contraseña. La verificación del email sigue siendo necesaria para cuentas todavía no verificadas.
- La recuperación usa el mismo servicio de email ya configurado en Render; no necesita nuevas claves. Si el envío no está configurado en producción, se informa que hay que contactar a soporte. La dirección del email de recuperación usa FRONTEND_URL, nunca la dirección enviada por quien hace la solicitud.
- En desarrollo local sin proveedor de email aparece un enlace de prueba. En producción ese enlace no se muestra. Se guardan huellas de los tokens, no sus valores; los límites de solicitudes se conservan en la base de datos para evitar envíos repetidos incluso después de reiniciar.
- **Agenda → Intervalo entre horarios** y **Configuración → Intervalo de horarios:** agregamos **1 hora y media (90 minutos)**, **2 horas (120 minutos)** y **Personalizado**. Podés elegir un número entero entre 5 y 720 minutos. Es la separación entre los horarios de inicio ofrecidos; la duración del servicio se configura por separado. Los valores inválidos se rechazan antes de modificar la agenda.
- **Mi página → Decidí qué mostrar** o **Configuración → Qué querés tener activo:** desmarcá **Mostrar duración de los servicios al público** para quitar los minutos de las tarjetas y del formulario de reserva. La duración se mantiene en el panel y se usa internamente para reservar todo el tiempo necesario y evitar superposiciones. Las páginas existentes siguen mostrando la duración hasta que se cambie esta opción.
- **Google Calendar:** la integración actual sincroniza **Adara → Google**. Los turnos creados, reprogramados o cancelados en Adara actualizan Google. Los eventos creados directamente en Google **no aparecen en Adara ni bloquean su disponibilidad**. Para mantener ambas agendas coordinadas, creá o modificá los turnos desde Adara y bloqueá en Adara los compromisos externos. La sincronización inversa requeriría una actualización adicional.

### Instalar esta actualización

Extraé el ZIP aparte. Desde su carpeta **adara-web**, combiná y reemplazá **src**, **server** y **tests** en tu proyecto. Reemplazá también **package.json** y **ACTUALIZACION.md**. Conservá **.env**, **data** y los archivos existentes en **server/uploads**; no borres las carpetas.

En PowerShell, desde la carpeta de tu proyecto:

```powershell
npm run build
npm test
git add src server tests package.json ACTUALIZACION.md
git commit -m "Agregar recuperacion de acceso e intervalos configurables"
git push
```

Render agrega las columnas y tablas automáticamente al iniciar, conservando cuentas, turnos e imágenes. Esperá a que termine el despliegue y recargá la página. No hace falta reiniciar las contraseñas existentes.

**Super Admin:** cambiar la contraseña desde el panel no requiere editar SUPERADMIN_PASSWORD en Render. Esa variable se usa para crear la cuenta en el primer inicio y para el restablecimiento manual mediante `npm run admin:password`. No ejecutes ese comando con la contraseña anterior si querés conservar la nueva.

Validación: build de producción y **1.390 comprobaciones de integración**, incluidas **165 nuevas** sobre enlaces, vencimiento, reutilización, cambios simultáneos, sesiones, permisos, email, límites persistentes, intervalos y duración pública. Revisión del flujo completo en navegador, ambos paneles y tamaños de celular y computadora.

---

## Secciones a tu medida, promociones reservables y WhatsApp del home

- **Mi página → Orden de las secciones:** mové Portada, Turnos, Promociones, Servicios, Novedades y Preguntas frecuentes con las flechas de subir/bajar. La vista previa y la página publicada siguen el mismo orden. Las secciones ocultas conservan su posición; la cabecera y el pie quedan fijos.
- **Promociones:** ahora se pueden editar, pausar y eliminar. Vinculá uno o varios servicios y elegí precio promocional o porcentaje. Se muestran precio antes, precio ahora y porcentaje de ahorro. La duración de la reserva se obtiene de los servicios incluidos, no de un horario inventado para la promoción.
- **Reservar una promoción:** el cliente puede elegirla desde su tarjeta o desde Turnos. El servidor valida sus servicios, su vigencia y su precio al crear la reserva. La seña o el pago total se calculan sobre el importe promocional. Una edición posterior no modifica los turnos ya creados.
- Las promociones anteriores se conservan como avisos. Para hacerlas reservables, entrá a **Editar promoción**, elegí sus servicios y guardá el precio. Se omiten las reservas de ofertas cuyo servicio ya está archivado o eliminado. Las promociones no se combinan con cupones, packs, canjes ni descuentos grupales; los precios son por persona.
- Las fechas de vigencia aplican al momento de reservar y a la fecha inicial del turno. Las promociones no generan repeticiones automáticas; coordiná una serie con el profesional si la necesitás.
- **Servicios en celular:** se respeta el estilo elegido en Mi página. Los estilos con foto arriba se muestran en dos columnas; Horizontal y Editorial mantienen su composición lateral. Las descripciones largas tienen **Leer más / Leer menos**, sin perder contenido.
- **Mi página → Ajuste de imágenes de portada:** elegí imágenes completas, sin ampliar ni recortar, o rellenar el espacio. La opción completa es la predeterminada. Las portadas móviles tienen una altura más cómoda; se conserva el carrusel automático.
- **Super Admin → Configuración → WhatsApp del home de Adara:** activá el botón, cargá el número con código de país y editá el mensaje inicial. Se muestra sólo cuando está habilitado y el número es válido. Abre el chat de soporte; no necesita completar WhatsApp Business ni la verificación de Meta.

### Instalar esta actualización

Extraé el ZIP aparte. Desde su carpeta **adara-web**, combiná y reemplazá los archivos de **src**, **server** y **tests** en tu proyecto. Reemplazá también **package.json** y **ACTUALIZACION.md**. No borres carpetas: conservá **.env**, **data** y los archivos existentes en **server/uploads**.

En PowerShell, desde la carpeta de tu proyecto:

```powershell
npm run build
npm test
git add src server tests package.json ACTUALIZACION.md
git commit -m "Personalizar secciones y habilitar promociones reservables"
git push
```

Render agrega las nuevas columnas automáticamente al iniciar, conservando los datos existentes. Esperá a que termine el despliegue y recargá el sitio. Después vinculá los servicios de tus promociones anteriores, revisá el orden y activá el WhatsApp de soporte si querés usarlo.

Validación: build de producción y **1.225 comprobaciones de integración**, incluidas **149 nuevas** de promociones, vigencia, precios, reservas, permisos y configuración. Revisión en navegador del flujo móvil, descripción completa, orden, diez plantillas, siete estilos de tarjetas y WhatsApp del Super Admin.

---

## Home compacto, carrusel de plantillas y nuevo ícono de pestaña

- Home más cómodo en celular: títulos, márgenes y bloques más compactos. Los seis beneficios se muestran en dos columnas, conservando texto legible y botones cómodos para tocar.
- Se mantiene una sola vista real de la agenda en la portada. La sección «Cómo funciona» ahora explica los estados del turno sin repetir la misma imagen.
- Las diez plantillas pasan a un carrusel: una por vez en celular y dos en pantallas grandes. Avanza automáticamente cada cinco segundos y vuelve al inicio. Incluye flechas, selección directa, gesto de deslizar y pausa; respeta la preferencia de movimiento reducido y se detiene cuando está fuera de pantalla o mientras interactuás.
- El ícono de pestaña usa exactamente el emblema A azul enviado, con fondo transparente y tamaños para navegador y accesos directos. Las rutas nuevas evitan reutilizar el ícono anterior guardado en caché.

### Instalar esta actualización

Extraé el ZIP en una carpeta aparte. Desde su carpeta **adara-web**, combiná y reemplazá **src** y **public** en tu proyecto. Reemplazá también **index.html** y **ACTUALIZACION.md**. No borres tu proyecto ni reemplaces tu **.env**, tu base de datos o tus archivos subidos.

En PowerShell, desde la carpeta de tu proyecto:

```powershell
npm run build
npm test
git add src public index.html ACTUALIZACION.md
git commit -m "Compactar home y agregar carrusel de plantillas"
git push
```

Cuando Render termine el despliegue, recargá con **Ctrl + F5**. Si la pestaña conserva el ícono anterior, cerrala y abrí el sitio nuevamente. En celular, cerrá la pestaña anterior y abrí una nueva.

Validación: build de producción, **1.076 comprobaciones de integración** y revisión en navegador entre **320 y 1.920 px**, navegación móvil, plantillas, pausa, avance automático, accesibilidad de teclado e íconos.

---

## Identidad unisex, logo azul y nuevas plantillas

- Nuevo logo azul completo, con mayor presencia y sin deformarlo. Emblema A en la pestaña e íconos para accesos directos. Nueva paleta azul/celeste/blanco y tipografía Manrope para la plataforma.
- Ingreso de escritorio corregido: el logo, el saludo y el título se muestran en filas separadas. Saludo neutro: «Qué bueno verte de nuevo».
- «Clientes», «Horarios» y «Tu negocio» en la interfaz. Rubros ampliados en el registro: barbería, peluquería, estética y cuidado personal, bienestar, tatuajes, entrenamiento, yoga y otros servicios.
- Cuatro plantillas adicionales: Atlas Studio y Clear Space (nivel 1), Forest Ritual y Carbon Studio (nivel 2). Se conservan las seis anteriores y los límites de cada plan. Las nuevas cuentas empiezan con Atlas; las cuentas existentes conservan sus colores y diseño.
- WhatsApp usa la misma silueta reconocible en la página, la vista previa y el QR. En la tarjeta se elimina el logo del pie: sólo queda arriba y en el centro del código. Se mantienen Instagram, TikTok, ubicación y email público.
- Explicación de Google Analytics y Meta Pixel en Herramientas → Estadísticas. Los campos son opcionales y las etiquetas externas requieren el consentimiento del visitante.
- Se corrige la altura del carrusel dividido en celulares y se evita que la reproducción quede pausada al salir de la imagen.
- Migración automática de los textos de planes y FAQ de la plataforma; no cambia precios, reservas, datos ni contenidos personalizados del negocio. Las versiones legales ya publicadas y sus aceptaciones se conservan. Si querés cambiar también la redacción de esos textos publicados, editá y publicá una nueva versión desde Super Admin → Legal.

### Actualizar tu proyecto en Windows

Copiá y reemplazá las carpetas completas **src**, **server**, **public** y **tests** del ZIP sobre las de tu proyecto. Copiá también **index.html**, **package.json**, **ACTUALIZACION.md** y **THIRD_PARTY_NOTICES.md**. Conservá tu **.env**, **data** y los archivos de **server/uploads**: no borres las carpetas existentes, sólo combiná y reemplazá los archivos del ZIP.

Desde la carpeta de tu proyecto en PowerShell:

```powershell
npm run build
npm test
git add src server public tests index.html package.json ACTUALIZACION.md THIRD_PARTY_NOTICES.md
git commit -m "Adaptar Adara a identidad unisex y nuevas plantillas"
git push
```

Después del despliegue, recargá con **Ctrl + F5**. Para ver la nueva A, cerrá y volvé a abrir la pestaña si conservó el ícono anterior. En **Herramientas → Compartir mi página**, generá y descargá nuevamente tu tarjeta QR: los PNG descargados antes no cambian.

Validación: build de producción y **1.076 comprobaciones de integración** aprobadas. Revisión en navegador de ingreso, registro, colores, plantillas, galerías, reservas, menú móvil, reproducción automática y lectura real del QR.

---

## Logo completo, ícono de pestaña, contactos del QR y portada automática

- El logo usa la nueva imagen horizontal completa en alta resolución. Se aumenta su tamaño en el home y los paneles, conservando un tamaño cómodo en celular.
- La pestaña usa el emblema A enviado por separado. Se incluyen SVG, PNG e ICO y un ícono para accesos directos de iPhone. Las nuevas rutas evitan reutilizar el ícono anterior guardado por el navegador.
- La tarjeta QR reemplaza los rótulos de contacto por los íconos de WhatsApp, Instagram, TikTok, ubicación y email, junto a cada dato. Mantiene los colores, la plantilla, la frase y el logo de la profesional. Se omiten los contactos vacíos; sólo se incluye el email público configurado en el negocio.
- Las portadas con varias imágenes avanzan solas cada 5 segundos y vuelven a la primera. Conservan flechas, gesto de deslizar y un botón para pausar o reanudar. Se detienen temporalmente al interactuar con el carrusel o cambiar de pestaña. Los servicios conservan navegación manual.

### Archivos que hay que reemplazar en esta entrega

Copiá el contenido completo de `src`, `public` y `tests` a las carpetas del mismo nombre de tu proyecto, aceptando reemplazar. Copiá también `server/qr-brand.js`, `index.html` y este `ACTUALIZACION.md`. Conservá `.env`, `data` y `server/uploads`.

```powershell
npm run build
npm test
git add src public tests server/qr-brand.js index.html ACTUALIZACION.md
git commit -m "Corregir logo, favicon, contactos QR y portada automatica"
git push
```

Tras el despliegue de Render, recargá con Ctrl + F5. Si la pestaña conserva el ícono anterior, cerrá esa pestaña y abrí el sitio de nuevo. En **Herramientas → Compartir mi página**, generá y descargá otra tarjeta para obtener los nuevos íconos. Los PNG descargados previamente no cambian.

La compilación de producción y las 992 comprobaciones de integración pasan. La revisión en navegador verifica carga de los íconos, logo completo, contactos del QR y lectura del código, cambio automático a los 5 segundos, pausa y reanudación, navegación manual, reducción de movimiento, portada anterior con una imagen y tamaños de escritorio y celular.

## Logo, paleta, soporte y sitios con carruseles

- El logo enviado se integra al home, ingreso, paneles, vista de ejemplo y documentos legales. El ícono de la pestaña usa la A del mismo logo. La paleta de Adara pasa a ciruela, rosa viejo y champagne.
- El home agrega **Soporte** en la navegación, una sección de ayuda y acceso por email a la dirección de contacto de Adara.
- Cada portada y servicio admite hasta 8 imágenes. Desde **Mi página → Imágenes de portada** o **Servicios → Imágenes del servicio** podés agregar varias fotos, cambiar su orden y quitarlas. Las portadas avanzan automáticamente cada 5 segundos; las flechas también permiten recorrerlas. La primera es la imagen principal.
- **Servicios → Editar** permite actualizar también las fotos de servicios que ya estaban creados.
- **Turnos** aparece inmediatamente debajo de la portada. El encabezado anterior se reemplaza por ese título y una instrucción breve. El botón de reserva de cada servicio selecciona ese servicio en el formulario.
- La categoría se oculta inicialmente. En **Mi página**, **Mostrar texto sobre el título de portada** permite activarla y escribir una frase propia; si no hay frase, muestra el rubro del negocio.
- Las siete variantes de tarjetas de servicios se ajustan a un formato compacto en el celular. Los colores y la identidad de cada profesional siguen siendo personalizables.

### Cómo aplicar esta actualización

Descargá y extraé el ZIP. Copiá el contenido de estas carpetas a tu proyecto actual, combinando los archivos con los existentes y aceptando reemplazar los archivos del mismo nombre:

- `src`
- `tests`
- `public`
- Los archivos `.js` de `server`, incluido el nuevo `server/image-gallery.js`.

Copiá también `index.html`, `package.json` y `ACTUALIZACION.md`. Esto incluye la actualización anterior del QR, por si todavía no la habías aplicado. Conservá tu `.env`, la carpeta `data` y las imágenes de `server/uploads`.

Desde tu carpeta actual `adara-web`, ejecutá en PowerShell:

```powershell
npm run build
npm test
git add src server tests public index.html package.json ACTUALIZACION.md
git commit -m "Actualizar marca, carruseles y turnos de Adara"
git push
```

Render compilará y publicará el cambio. No hace falta agregar variables de entorno ni ejecutar SQL: los campos nuevos se agregan automáticamente al iniciar. Las imágenes anteriores se siguen mostrando. Si el navegador conserva el ícono viejo, recargá con **Ctrl + F5**.

## Tarjeta QR con identidad propia y frase editable

En **Herramientas → Compartir mi página**, cada profesional puede escribir la frase de su tarjeta (hasta 120 caracteres) o dejarla vacía para ocultarla. **Guardar y generar QR** guarda la frase para ese negocio y crea una nueva tarjeta descargable. Se conserva al volver a entrar.

El pie de la tarjeta muestra el logo del negocio; si no tiene uno, muestra su nombre. La dirección de Adara deja de imprimirse en la tarjeta. El código mantiene el enlace a la página de reservas y los colores y datos del negocio. El logo se carga desde **Mi página**.

Para actualizar la instalación publicada, copiá estos siete archivos del ZIP a tu carpeta actual `adara-web`:

- `server/features-db.js`
- `server/features.js`
- `server/qr-brand.js`
- `src/Tools.tsx`
- `src/qr-card.ts`
- `tests/features.integration.mjs`
- `ACTUALIZACION.md`

Luego ejecutá en PowerShell desde esa carpeta:

```powershell
npm run build
npm test
git add server/features-db.js server/features.js server/qr-brand.js src/Tools.tsx src/qr-card.ts tests/features.integration.mjs ACTUALIZACION.md
git commit -m "Personalizar frase e identidad de las tarjetas QR"
git push
```

Render aplicará el cambio al desplegar. El campo de la frase se agrega automáticamente al iniciar; no hace falta ejecutar comandos en la base de datos. Las tarjetas ya descargadas se mantienen como estaban: generá y descargá una nueva para obtener el diseño actualizado.

## Corrección de consulta de facturas de Mercado Pago

La API de facturas rechazó `limit=100` y `limit=20` con HTTP 400 (`Invalid value for limit`). Se verificó con la cuenta vendedora de prueba que `limit=10` devuelve HTTP 200. Adara ahora consulta páginas de 10 tanto al actualizar el estado como al recibir avisos de pagos. Recorre las siguientes páginas para conservar el historial y verificar los pagos acreditados.

Para actualizar tu instalación publicada, copiá estos archivos del ZIP a tu proyecto Git actual:

- `server/platform-billing.js`
- `tests/platform-billing.integration.mjs`
- `ACTUALIZACION.md`

Luego ejecutá en PowerShell, desde la carpeta `adara-web`:

```powershell
npm test
git add server/platform-billing.js tests/platform-billing.integration.mjs ACTUALIZACION.md
git commit -m "Corregir paginacion de facturas de Mercado Pago"
git push
```

Esta corrección no modifica los datos ni las variables de Render. Una vez desplegada, entrá a **Plan → Actualizar estado** sobre la suscripción existente. La autorización y la fecha del primer cobro se conservan. Hasta que se acredite un pago, la cuenta mantiene su prueba gratuita y no muestra un período pagado.

Las pruebas reproducen el rechazo de los límites anteriores y verifican 25 facturas repartidas en tres páginas, un pago aprobado en la última página, respuestas con y sin total de resultados, avisos de pagos, aislamiento entre negocios y ausencia de registros duplicados.

## Documentos legales y aceptación

Nueva sección **Super Admin → Textos legales** para editar y revisar los borradores de términos, privacidad y suscripción. La titular, el email y la dirección completa están cargados: Francia 3138, Mar del Plata, Buenos Aires, Argentina. Si el borrador de una instalación anterior sigue sin localidad, completá ciudad y provincia desde el panel y guardalo. Guardar no publica. Al publicar se habilita la aceptación obligatoria en los nuevos registros y se guarda la edición aceptada, también al autorizar nuevas suscripciones. Los textos necesitan revisión profesional antes del lanzamiento comercial. El detalle y los puntos pendientes están en `LEGAL.md`.

**Esta actualización modifica frontend y servidor.** Si ya publicaste en Render, actualizá `src`, los archivos `.js` de `server`, `tests` y `package.json` en tu proyecto Git actual. Conservá `.env`, `data` y las imágenes de `server/uploads`. Ejecutá:

```powershell
npm run build
npm test
git add src server tests package.json
git commit -m "Agregar documentos legales y aceptación de condiciones"
git push
```

Después del despliegue, verificá la dirección y revisá los borradores desde Super Admin. La publicación se hace desde ese panel. Las tablas legales se agregan sin borrar datos existentes.

## Panel en celulares

El panel de la profesional y el Super Admin ahora tienen una barra compacta y un botón **Menú**. La navegación se abre sobre el contenido y se cierra al elegir una sección, tocar afuera, usar la cruz o presionar Escape. Al cambiar de sección en celular se muestra el contenido desde arriba. Abrir y cerrar el menú conserva los formularios que estás editando.

También se corrigieron los anchos del editor de la página, sus campos y las filas del panel. La vista previa de escritorio se puede deslizar dentro de su recuadro en pantallas pequeñas. En computadora se mantiene el menú lateral.

### Si ya publicaste en Render

1. Hacé una copia de tu proyecto actual.
2. Descomprimí esta entrega en otra carpeta.
3. Copiá únicamente la carpeta `src` de esta entrega dentro de tu carpeta actual `adara-web`, aceptando reemplazar los archivos. Esta corrección no necesita cambios en `.env`, datos, fotos ni variables de Render.
4. Abrí PowerShell en tu proyecto actual y ejecutá:

```powershell
npm run build
git add src
git commit -m "Mejorar el panel en celulares"
git push
```

Render volverá a desplegar el sitio si tenés activado el despliegue automático de la rama `main`. Cuando termine, recargá el panel en el celular.

La compilación de producción y las pruebas en navegador cubren las secciones de ambos paneles en anchos de 323, 390 y 768 px, formularios, cierre del menú, foco del teclado, vistas previas, cambio a escritorio y cierre de sesión.

Esta entrega agrega las suscripciones mensuales y anuales que pagan las profesionales por usar Adara. Incluye precio especial por cuenta, autorización en Mercado Pago, períodos pagados, cancelación de futuras renovaciones, vencimientos y Super Admin → Suscripciones. Conserva la Home aprobada, su paleta y foto, FAQ, transferencias, condiciones por clienta y todas las herramientas anteriores.

## Si ya tenés datos cargados

1. Detené `npm run dev` con `Ctrl + C` en PowerShell.
2. Hacé una copia de tu carpeta actual antes de reemplazar archivos.
3. Descomprimí este ZIP. Conservá tu archivo `.env`, tu carpeta `data` completa y `server/uploads` con las fotos y logos. No reemplaces esos datos por carpetas vacías.
4. Desde la carpeta `adara-web`, ejecutá:

```powershell
npm install
npm run dev
```

Las nuevas columnas se agregan automáticamente al iniciar. Los turnos, fotos, clientas y configuraciones existentes se conservan. Si todavía tenías el valor anterior de prueba gratuita, se ajusta a 15 días para las nuevas cuentas; las pruebas ya otorgadas conservan su fecha de vencimiento.

## Si empezás de cero

```powershell
npm install
npm approve-scripts better-sqlite3
npm rebuild better-sqlite3
npm run db:seed
npm run dev
```

Si tu versión de npm no reconoce `approve-scripts` y no bloqueó la instalación de `better-sqlite3`, continuá con los siguientes comandos.

Abrí `http://localhost:5173`.

## Probar las suscripciones primero

Entrá como profesional a **Plan**, elegí frecuencia e importe y marcá la autorización. Usá **Preparar suscripción de prueba** y **Simular primer pago**. Verificá el período pagado; después cancelá la renovación y comprobá que se conserve. Este modo local no cobra dinero ni ejecuta débitos futuros.

En **Super Admin → Suscripciones** aparecen los contratos y cuotas de Adara. En **Configuración** se eligen los días de gracia para renovaciones pendientes; la prueba gratuita mantiene sus 7 o 15 días.

Para conectar los cobros reales, seguir **SUSCRIPCIONES.md**. Se necesitan la cuenta de cobro de Adara, una aplicación de Mercado Pago, la firma de Webhooks y URLs HTTPS públicas.

## Dónde encontrar los cambios

- **Inicio:** paleta marfil, champagne, terracota y carbón, agenda como la del panel y tu foto nueva en los ejemplos de plantillas.
- **Super Admin → FAQ de la Home:** crear, editar, ordenar, ocultar o eliminar preguntas. `{dias_prueba}` muestra automáticamente la duración configurada.
- **Pagos → Medios de pago que ofrecés:** activar Mercado Pago, transferencia o ambos. Para transferencia, completar alias o CBU/CVU y titular.
- **Agenda → Confirmar transferencia:** abrir el comprobante, verificar el ingreso real e indicar el importe recibido. Enviar un comprobante no confirma ni extiende la retención; elegir un plazo suficiente para revisarlo.
- **Clientas → Pago para [nombre]:** regla habitual, Sin anticipo o Exigir pago completo. Sin anticipo genera un enlace privado para esa clienta; el servicio mantiene su precio y se paga al asistir. Renovar el enlace revoca el anterior.
- **Agenda → Autorizar sin anticipo:** confirmar sólo ese turno pendiente, sin modificar las condiciones de próximos turnos.
- **Agenda → Días libres y horarios no disponibles:** campos separados de fecha, todo el día, horas y motivo.
- **Herramientas → Agenda especial:** Fecha desde y Fecha hasta para vacaciones u horarios especiales. Ambas fechas se incluyen. En Períodos guardados, **Editar período** permite cambiar también las fechas. En Equipo, elegí todo el negocio o una profesional. Las excepciones anteriores se conservan como períodos de un día; no se cancelan reservas existentes. Si un cambio afecta turnos, el panel te avisa para revisarlos.
- **Mi página y Configuración:** guardá logo, plantilla, colores, nombre, WhatsApp, Instagram, TikTok y dirección.
- **Herramientas → Compartir mi página:** generá la tarjeta personalizada. Descargá la tarjeta o el QR con logo; los datos vacíos se omiten. Generá una nueva versión después de cambiar la marca o los contactos.
- **Pagos → Plazo para pagar:** elegí cuánto tiempo retener una nueva reserva sin seña o pago total. El rango es de 5 minutos a 24 horas. Cambiar este ajuste conserva el plazo de las reservas ya creadas.
- **Agenda:** los pendientes aparecen con importe y tiempo restante. Se actualiza automáticamente; los vencidos quedan en Todos como cancelados y liberan el horario. Un pago tardío queda para revisión y no reconfirma la reserva cancelada.
- **Super Admin → Configuración:** prueba gratis de 15 días por defecto, configurable a 7 días.

Antes de imprimir un QR para tu negocio, configurá `FRONTEND_URL` con la dirección pública real. En desarrollo el QR abre el sitio de prueba local.

## Validación

Compilación correcta, 703 comprobaciones de integración y recorridos reales en navegador de escritorio y celular. Se verificaron Home, períodos editables, publicación y ocultado de FAQ, configuración de transferencia, reserva pendiente, envío y descarga privada del comprobante, verificación de pago, liberación por vencimiento, enlace privado por clienta y autorización de un solo turno. El permiso sin anticipo conserva el precio y no se concede por escribir un teléfono en la página pública. También se verificó que el enlace privado no cargue etiquetas externas de Analytics o Meta.

Mercado Pago y Google se prueban con transporte simulado; las cuentas reales requieren configurar los proveedores. Las transferencias se confirman manualmente al verificar el ingreso. Mercado Pago ya ofrece débito y crédito. Cobrar tarjetas fuera de Mercado Pago requiere conectar otro proveedor; Payway no está integrado en este ZIP.


Las 261 comprobaciones nuevas verifican suscripciones con transporte simulado de Mercado Pago: autorización, precios especiales, prueba conservada, firma de avisos, pagos repetidos, importe incorrecto, rechazos, reintegros, dos períodos recurrentes, cambio anual, cancelación, gracia, cuentas bonificadas y simulación bloqueada en producción. El recorrido visual verificó Plan, consentimiento, pago local, cancelación y las nuevas pantallas del Super Admin en escritorio y celular.

## Publicación en Render

Se agregaron `render.yaml` y `RENDER.md`, servidor único para la web y API, datos persistentes configurables, comprobación de salud, creación del Super Admin con credenciales propias y copias manuales con `npm run backup`. La URL HTTPS de Render se utiliza automáticamente. En producción se rechazan claves de ejemplo y la contraseña local del Super Admin, y se desactivan los pagos simulados. El registro requiere email real y nunca entrega enlaces locales de verificación. No se contrató ni publicó un servicio externo; faltan conectar el repositorio y los proveedores con tus cuentas.
