# Adara Web

Plataforma SaaS para negocios de belleza. El plan Individual incluye una sola profesional y el plan Equipo permite varias agendas. Cada cuenta tiene su propio panel, página pública premium, agenda, servicios, clientas, promociones, cupones, novedades y configuración de pagos.

## Portada y registro

### Primer uso, comparación de planes y crecimiento

- **Inicio guiado:** el inicio del panel muestra servicios, equipo cuando corresponde, revisión de horarios, modalidad de cobro y enlace para compartir. Los servicios se comprueban contra los datos actuales; guardar horarios y pagos registra su revisión. Una cuenta con cobro anticipado necesita al menos un medio utilizable. Copiar el enlace completa el último paso cuando la configuración y el acceso permiten recibir reservas. Cambiar o desactivar servicios/horarios vuelve a reflejar lo que falta, conservando los hitos históricos.
- **Planes:** la portada agrega una comparación desplegable de funciones y límites, calculada con los planes públicos vigentes. El período anual muestra el total y su equivalente mensual. No se duplican precios en el código.
- **Testimonios:** en **Super Admin → Testimonios** se guardan opiniones de profesionales, asociadas a un negocio real. Se pueden editar, ordenar, publicar u ocultar. Publicar exige autorización explícita, negocio activo y email verificado; cambiar la opinión o su autor requiere confirmar nuevamente. La portada sólo muestra las publicadas y se omite por completo si no hay ninguna. No se cargan opiniones de ejemplo en producción.
- **Crecimiento:** en **Super Admin → Crecimiento** se elige una cohorte por fecha de alta y se ven cuentas creadas, email verificado, página preparada, primera reserva online y primer pago de suscripción aprobado. Son hitos acumulados por negocio, no un embudo secuencial ni visitantes únicos. La primera reserva incluye pendientes de pago; un alta manual de suscripción no cuenta como pago. Los hitos se guardan una sola vez y los reenvíos de avisos de pago no duplican registros. El histórico se recupera únicamente desde registros existentes; una verificación previa sin fecha se conserva sin inventar una. Estos datos operativos permanecen en Adara y no amplían los eventos enviados a Google o Meta.
- **Importación de clientas:** disponible en **Clientes → Importar clientas**, también en Inicial. Acepta CSV (coma, punto y coma o tabulación), TSV y Excel `.xlsx`, primera hoja, hasta 2 MB, 2000 clientas y 40 columnas. Se pueden asignar las columnas, revisar todas las filas y elegir cuáles guardar. Requiere nombre y WhatsApp o email válido. Duplicados por teléfono normalizado o email, tanto del archivo como del negocio, y filas inválidas se omiten; no se modifica ninguna ficha existente. Al confirmar se revalidan los duplicados dentro de una transacción. Confirmar dos veces la misma vista previa devuelve el mismo resultado. La vista previa vale quince minutos; las filas se eliminan del lote al terminar y los lotes vencidos se limpian al revisar otra planilla. Excel heredado `.xls` debe volver a guardarse como `.xlsx` o CSV. Se limitan los tamaños descomprimidos y las coordenadas de las hojas antes de leerlas.
- **Páginas por rubro:** `/para/manicuras`, `/para/peluquerias` y `/para/barberias`, con contenido y preguntas propias, enlaces desde la portada y rubro precargado al registrarse. En producción, el servidor entrega el contenido, título, descripción, enlace canónico, vista previa social y datos de navegación sin depender de ejecutar JavaScript. `/sitemap.xml` incluye la portada y las tres páginas; `/robots.txt` indica ese sitemap. Las rutas de acceso y gestión privada reciben `X-Robots-Tag: noindex, nofollow`.

Validación de estos cambios: `npm run build`, suite completa `npm test`, pruebas de `tests/growth.integration.mjs` y revisión visual con datos ficticios. La comprobación de despliegue verifica que las rutas de la aplicación sigan usando el mismo recurso JavaScript, ya que la portada ahora tiene su propio HTML para buscadores.

### Plan Inicial y experiencia de reservas

- **Adara Inicial:** $9.900 por mes o $99.000 por año, una agenda, hasta diez servicios, plantillas esenciales y reseñas moderadas. Promociones, cupones, novedades y herramientas avanzadas se habilitan desde Individual. La incorporación del plan se hace una sola vez y conserva posteriores cambios del administrador.
- El formulario de servicios permite usar el intervalo de la agenda como duración automática. Los servicios existentes mantienen sus minutos explícitos. Cambiar el intervalo actualiza los servicios automáticos para futuras reservas y conserva la duración guardada en turnos anteriores.
- Las nuevas reservas grupales piden nombre, WhatsApp, email según la configuración del negocio y horario por persona, para una única fecha. Los horarios pueden estar separados; sólo se ocupan los intervalos elegidos. Los datos se guardan en las fichas de clientes y se muestran en Turnos.
- El grupo conserva un único total, pago y enlace privado. Su confirmación, vencimiento, cancelación y reprogramación se aplican en conjunto. Reprogramar mueve todos los horarios con la misma separación y valida cada espacio antes de guardar. Las reservas antiguas de varias personas conservan su comportamiento anterior.
- Cada reseña se recibe pendiente. Desde **Reseñas de clientas**, la profesional puede publicarla u ocultarla. La página pública muestra únicamente las aprobadas, con nombre, calificación y comentario; el envío solicita consentimiento y limita repeticiones.
- La página de reservas incorpora menú móvil, promociones y novedades compactas, imágenes ampliables completas y controles de contraseña en ingreso, registro y recuperación.

Las comprobaciones de estas funciones están en `tests/customer-experience.integration.mjs` y forman parte de `npm test`. Los proveedores de pago y avisos se simulan durante las pruebas.

- La portada permite elegir un servicio, un día y un horario en una demostración interactiva. El resultado muestra la confirmación del cliente y un resumen para la agenda. Son datos de ejemplo: no se crean reservas ni se contactan las APIs de pagos.
- El registro presenta primero los datos de la cuenta y resume el plan de prueba. **Cambiar plan** permite elegir otro plan o período, conservando también las selecciones de los enlaces de precios.
- Los planes, importes y días de prueba se consultan desde la configuración pública de la plataforma. Si falla la carga de planes se ofrece un reintento; el envío muestra su estado y evita nuevos intentos mientras está pendiente.
- El código de los paneles se carga al salir de la portada mediante `Router.tsx`, para reducir el JavaScript inicial. Las rutas y el despliegue en Render conservan su configuración.

Validación: `npm run build`, `npm test` y revisión visual de la portada y del registro, incluyendo anchos de 320 y 390 píxeles.

## Inicio rápido en Windows PowerShell (instalación nueva)

```powershell
npm install
npm approve-scripts better-sqlite3
npm run db:seed
npm run dev
```

Abrí `http://localhost:5173`.

Super Admin local:

```text
admin@adaraweb.local
admin1234
```

## Qué podés probar sin credenciales externas

- Home comercial premium con planes Individual y Equipo.
- Cada plan puede contratarse mensual o anual.
- El Super Admin puede crear nuevos planes, ocultarlos, publicarlos y cambiar precios/límites sin tocar código.
- Registro con verificación de email en modo local.
- Reenvío del enlace de verificación si vence o falla.
- Panel profesional individual o para equipos según el plan.
- Servicios con imagen, descripción, precio y duración.
- Descuentos grupales configurables por servicio para reservas de 2 o más personas.
- Seis plantillas premium realmente distintas entre sí: composición, tipografías, header, portada, tarjetas, botones y footer.
- Editor visual con vista previa Desktop/Móvil, logo, portada, colores, tipografías, altura/alineación del hero, estilo de servicios, formato de imágenes y secciones visibles.
- Promociones con opción de banner superior fijo en la página pública.
- Cupones porcentuales o de importe fijo, con fechas, mínimo de compra, límite de usos y servicio opcional.
- Novedades publicadas automáticamente.
- Preguntas frecuentes editables desde el panel y publicadas como acordeón en la web.
- Botón flotante de WhatsApp con número y mensaje configurables por cada profesional.
- Agenda semanal, días/horarios bloqueados y horizonte de reservas.
- Configuración profesional del negocio: datos públicos, redes, SEO, anticipación mínima, cancelación, reservas grupales, email obligatorio y mensajes posteriores a la reserva.
- Selección de uno o varios servicios.
- Reservas para varias personas: como la cuenta corresponde a una sola profesional, el tiempo se multiplica para bloquear toda la atención necesaria.
- Calendario visual y horarios disponibles calculados según duración total.
- La agenda de reservas mantiene una paleta neutra propia y no cambia de color con cada plantilla.
- Cada reserva genera un enlace privado para que la clienta pueda reprogramar o cancelar dentro del plazo permitido.
- Prevención de superposición de turnos.
- CRM de clientas.
- Modalidad de cobro: sin pago, seña o total.
- Simulación local de pago aprobado cuando `DEMO_PAYMENTS=true`.
- Super Admin para cuentas, verificación de email, prueba gratis, suscripciones, planes, precios y límites.

## Verificación de email

En desarrollo no necesitás contratar un proveedor. Si `RESEND_API_KEY` está vacío, luego del registro aparece un enlace local para verificar la cuenta.

La pantalla de verificación también permite pedir un nuevo enlace si el anterior venció o ya no funciona.

Para email real, copiá `.env.example` a `.env` y completá:

```text
RESEND_API_KEY=
EMAIL_FROM=Adara Web <no-reply@tu-dominio.com>
```

## Imágenes

Las imágenes se guardan en `server/uploads/` durante el desarrollo local. Vite redirige tanto `/api` como `/uploads`, por lo que las fotos de servicios, promociones, logo y portada deben verse en el panel y en la página pública.

## Banner de promociones

Desde **Promociones** la profesional puede decidir si una promoción también aparece como barra superior. Puede personalizar:

- texto;
- color del fondo;
- color del texto;
- vigencia;
- imagen y descripción para la sección de promociones.

## Cupones

Desde **Cupones** se pueden crear códigos con:

- porcentaje o importe fijo;
- compra mínima;
- máximo de usos;
- fecha desde/hasta;
- todos los servicios o uno específico;
- activar/pausar.

El descuento se vuelve a calcular en el servidor al reservar; el navegador no decide el precio final.

## Reservas grupales

Cada servicio puede habilitar un beneficio para dos o más personas. Por ejemplo: `2+ personas = 15% OFF`.

La clienta elige cuántas personas son. Si un servicio dura 60 minutos y reservan 2 personas, Adara necesita 120 minutos consecutivos porque la plataforma está pensada para una sola profesional por cuenta.


## Configuración del negocio

La sección **Configuración** está separada del editor visual. Desde ahí la profesional puede manejar:

- nombre, rubro, WhatsApp, email público, Instagram, TikTok, web y dirección;
- anticipación mínima para reservar, horizonte e intervalo de horarios;
- política y horas mínimas para cancelación;
- permitir o no reservas para varias personas y cantidad máxima;
- pedir email obligatorio en las reservas;
- mensaje que verá la clienta después de confirmar;
- título y descripción SEO;
- email interno para futuras notificaciones;
- enlace público para compartir.

## Editor visual premium

**Mi página** ahora permite elegir una plantilla y después personalizarla sin tocar código. Las plantillas no son sólo paletas: cambian la estructura real del sitio.

Opciones disponibles:

- portada de fondo, dividida, centrada, cinematográfica, en arco o asimétrica;
- altura y alineación de portada;
- encabezado clásico, minimal, centrado, oscuro o flotante;
- tarjetas de servicios clásicas, editoriales, boutique, minimalistas, horizontales, luxury o asimétricas;
- imágenes apaisadas, cuadradas o verticales;
- tipografías de títulos y textos;
- botones redondeados, suaves o rectos;
- contenido amplio o editorial;
- cuatro estilos de footer;
- mostrar/ocultar presentación, promociones, novedades, preguntas frecuentes y contacto;
- vista previa en vivo para Desktop y Móvil.


## Preguntas frecuentes

Desde **Preguntas frecuentes** la profesional puede agregar, editar, ocultar y eliminar preguntas. Si la sección está habilitada en **Mi página**, se publica automáticamente en la web pública como acordeón.

## WhatsApp flotante

En **Configuración > Datos del negocio** se puede activar el botón flotante de WhatsApp, cargar el número y personalizar el mensaje inicial. El botón usa el color oficial de WhatsApp y queda fijo abajo a la derecha de la página pública.

## Cancelación y reprogramación por la clienta

Cada reserva crea un enlace privado de gestión. La clienta lo ve al terminar la reserva y, si hay email transaccional configurado, también lo recibe por correo. Desde ese enlace puede:

- ver fecha, horario, servicios, total y estado de pago;
- reprogramar el turno viendo solamente horarios disponibles;
- cancelar el turno y liberar el horario;
- consultar la política de cancelación del negocio.

El panel de **Configuración** define cuántas horas antes del turno se permiten cambios. Si ya hubo un pago, cancelar la reserva no realiza un reintegro automático: la devolución se coordina con la profesional.

## Mercado Pago de cada profesional

Cada profesional conecta su propia cuenta de Mercado Pago mediante OAuth. Los pagos de las clientas van a esa profesional, no a Adara Web.

Configurá en `.env`:

```text
MP_PLATFORM_CLIENT_ID=
MP_PLATFORM_CLIENT_SECRET=
MP_OAUTH_REDIRECT_URI=http://localhost:3001/api/integrations/mercadopago/callback
TOKEN_ENCRYPTION_KEY=
PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

Para webhooks reales, `PUBLIC_API_URL` debe ser una URL HTTPS pública accesible por Mercado Pago. En localhost podés probar el circuito usando `DEMO_PAYMENTS=true`.

### Flujo de cobro

- **Sin pago online:** la reserva queda confirmada inmediatamente.
- **Seña:** puede ser importe fijo o porcentaje del total.
- **Total:** la clienta paga el 100% para confirmar.
- El horario queda retenido durante el plazo que cada negocio elige en Pagos (entre 5 minutos y 24 horas; 15 minutos por defecto). Aparece en Agenda como Esperando pago, con tiempo restante. Al vencer, la reserva se cancela y el horario queda libre automáticamente.
- Pago aprobado: webhook confirma el turno.
- Pago rechazado/cancelado/reembolsado: se cancela la reserva y se libera el horario.

## Planes

La instalación incluye los planes **Adara Individual** y **Adara Equipo**, configurables desde Super Admin.

Desde el Super Admin podés:

- cambiar precio mensual y anual;
- cambiar beneficios y límites;
- ocultar o publicar un plan;
- crear otro plan para el futuro;
- asignar un plan distinto a una cuenta existente;
- desactivar un plan sin eliminarlo.

La plataforma exige que siempre quede al menos un plan público y activo.

## Producción

La configuración para Render está incluida en `render.yaml`. Seguí **RENDER.md** para publicar un solo servicio con la web compilada, API y disco permanente; `npm start` sirve ambos. No uses `db:seed` en producción: el primer Super Admin se crea con tu email y contraseña propios. Sin proveedor de email, el registro queda cerrado y no se muestran enlaces de prueba.

Antes de publicar comercialmente:

1. Cambiar `JWT_SECRET` y `TOKEN_ENCRYPTION_KEY`.
2. Configurar HTTPS y URLs públicas.
3. Configurar email transaccional real.
4. Crear la app OAuth de Mercado Pago y webhook público.
5. Migrar imágenes a object storage/CDN si se espera escala.
6. Para alto volumen, migrar SQLite a PostgreSQL.
7. Configurar el cobro de suscripciones de Adara según `SUSCRIPCIONES.md`, con su cuenta de Mercado Pago, avisos firmados y URLs HTTPS.

No hay etiquetas de versión visibles en la interfaz. El versionado del código queda únicamente interno.

### Google y avisos
El título y la descripción para Google son los metadatos SEO básicos de la página pública de cada profesional. El email de avisos se usa para notificar a la profesional por nuevas reservas, cancelaciones, reprogramaciones y pagos cuando el proveedor de email está configurado.

## Plan Individual y Plan Equipo

La plataforma mantiene dos niveles configurables desde Super Admin:

- **Adara Individual**: una sola profesional y una agenda.
- **Adara Equipo**: varias profesionales, agendas semanales independientes, asignación de servicios por integrante y elección de profesional durante la reserva.

Los precios, límites, visibilidad y beneficios se pueden editar desde **Super Admin → Planes**. También se pueden crear nuevos planes sin tocar código.

### Precio especial por cuenta

En **Super Admin → Negocios** se puede asignar un precio mensual o anual personalizado a una cuenta concreta. Si los campos se dejan vacíos, se usa el precio público del plan. Esto sirve para beneficios particulares, convenios o cuentas bonificadas sin modificar el precio general.

El Super Admin está pensado para administrar **cuentas y suscripciones**. No muestra el detalle de reservas ni las clientas de los negocios.

## Módulos visibles en cada sitio

Cada negocio puede decidir desde su panel qué secciones publica: servicios, reservas, promociones, novedades, preguntas frecuentes, descripción y datos del pie de página. De esta forma, cada web puede adaptarse al tipo de negocio sin mostrar módulos que no usa.

## Home y ejemplos

La Home combina marfil, champagne, terracota y carbón, como el registro y el panel. Conserva su diseño de plataforma e incluye seis ejemplos de plantillas en formato de escritorio. La vista de Agenda reutiliza los mismos componentes de horarios y reservas del panel profesional, con datos de ejemplo y filtros interactivos.

## Funciones incorporadas

Desde **Panel → Herramientas** se accede a lista de espera, recordatorios, packs, historial, fidelidad, horarios especiales, QR, exportación, estadísticas y Google Calendar. La Home muestra las seis plantillas en vistas de escritorio y los planes con nombres sin etiquetas repetidas.

- **Lista de espera:** aparece cuando no hay horarios para los servicios, fecha y profesional seleccionados. Registra consentimiento y prepara avisos al detectar disponibilidad. Un aviso no adjudica ni retiene un turno. El estado “Aviso preparado” no significa que el mensaje haya sido entregado.
- **Recordatorios:** hasta cinco avisos entre 1 y 168 horas antes; por defecto 48 y 24 horas. El proceso revisa cada minuto mientras el servidor está activo. El enlace privado permite confirmar asistencia, reprogramar y cancelar. Los avisos viejos se invalidan al cambiar fecha/hora y los envíos quedan registrados por canal.
- **Ausencias y bloqueo:** la profesional marca “No asistió” desde Agenda. El historial cuenta realizados, cancelaciones, ausencias e importe de servicios completados. Se puede bloquear una clienta o exigir pago completo. Por defecto, dos ausencias exigen 100% en nuevas reservas. Se identifica por teléfono normalizado o email; no es un sistema de verificación de identidad.
- **Packs/abonos:** crear un pack de un servicio, registrar el pago recibido y asignarlo a una clienta existente. Cada reserva con su código privado consume una sesión. Cancelar devuelve la sesión; una ausencia no la devuelve. El código exige los datos de la titular. No se combinan packs con cupones, canjes ni reservas grupales. Esta entrega registra ventas de packs cobradas por la profesional; no incluye un checkout online para comprar packs.
- **Fidelidad:** los turnos completados generan puntos una sola vez. La profesional canjea puntos por un código de descuento privado, usable en la web por esa clienta. Los códigos vencen a los 90 días y no se combinan con cupones. Si se cancela un turno, se libera el canje para otra reserva.
- **QR:** descarga del código en PNG con el logo central o de una tarjeta personalizada en PNG. Usa la plantilla, colores, logo y nombre del negocio, más WhatsApp, Instagram, TikTok y dirección cuando estén completos. Los tonos demasiado claros se oscurecen para permitir el escaneo y se conserva una zona blanca de lectura. Configurar FRONTEND_URL con la URL pública real antes de imprimir. Volver a generar la tarjeta después de cambiar los datos.
- **Agenda especial:** reemplazar el horario de una fecha o cerrar ese día, para todo el negocio o una integrante. Los bloqueos existentes siguen aplicándose; una excepción no cancela los turnos ya creados.
- **Turnos recurrentes:** desde Agenda especial, elegir un turno confirmado/completado, repetir cada X días o cada mes y crear hasta 12 próximos turnos. Cada fecha se valida y la serie se crea completa o no se crea. El cobro de las sesiones de una serie creada por la profesional se acuerda aparte; no genera cargos automáticos ni consume packs. Desde la web, la clienta puede repetir automáticamente si el negocio reserva sin pago online y sin cupones/beneficios. Los turnos quedan accesibles desde el enlace privado. No se acumulan cargos futuros de Mercado Pago.
- **Términos:** texto editable, aceptación obligatoria opcional y copia de la política aceptada guardada con la reserva.
- **Exportación:** CSV compatible con Excel de clientas y turnos, únicamente del negocio conectado, con precios en pesos y protección contra fórmulas en campos de texto.
- **Estadísticas:** visitas, intentos de reserva y reservas creadas en los últimos 30 días. Son conteos de eventos, no visitantes únicos. Google Analytics y Meta Pixel se cargan sólo si la clienta acepta el consentimiento mostrado en la página.

### Conectar Google Calendar

1. Activar Google Calendar API en Google Cloud y crear credenciales OAuth para aplicación web.
2. Registrar GOOGLE_REDIRECT_URI y configurar GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET en el servidor.
3. Desde **Herramientas → Integraciones**, la profesional toca **Conectar Google Calendar** e inicia sesión/autoriza.
4. Adara sincroniza los turnos confirmados en su calendario principal; actualiza reprogramaciones y elimina cancelaciones. Los tokens se guardan cifrados y no se publican en la web.

La sincronización es **Adara → Google**, cada minuto. Los eventos personales de Google no bloquean automáticamente la disponibilidad de Adara. Desconectar no elimina eventos que ya estaban en Google. Los errores de sincronización se muestran en Integraciones y se reintentan mientras el servidor esté activo.

Documentación: https://developers.google.com/workspace/calendar/api/guides/create-events y https://developers.google.com/identity/protocols/oauth2/web-server

### Email y WhatsApp reales

- Email usa RESEND_API_KEY y EMAIL_FROM. Sin proveedor, el registro indica **Vista previa local**; no simula un envío real.
- WhatsApp usa Cloud API de WhatsApp Business, con número de plataforma, token y versión de Graph API configurados en .env. No sirve una cuenta de WhatsApp personal.
- Crear dos plantillas aprobadas para recordatorios y disponibilidad. Ambas deben tener cinco parámetros de texto en el cuerpo, en este orden: **nombre de clienta, nombre del negocio, fecha, hora, URL privada/de reservas**. Los nombres se cargan en WHATSAPP_REMINDER_TEMPLATE y WHATSAPP_WAITLIST_TEMPLATE. Usar el idioma exacto aprobado en WHATSAPP_TEMPLATE_LANGUAGE.
- Los teléfonos para avisos automáticos deben incluir código de país. Los envíos que fallan se reintentan hasta cinco veces; el panel permite reintentar luego de corregir la conexión. Email usa claves de idempotencia. WhatsApp puede duplicar un aviso si el proveedor lo acepta pero la conexión se corta antes de recibir la respuesta.
- Las confirmaciones, cancelaciones y reprogramaciones de reservas continúan enviándose por email transaccional. Los nuevos avisos automáticos por WhatsApp implementados aquí son **recordatorios y lista de espera**.

El servidor debe estar encendido para ejecutar avisos y sincronización. Los recordatorios se preparan dentro de los 15 minutos siguientes a su vencimiento; no se envían todos los recordatorios atrasados tras una caída larga. En producción, mantener el proceso activo y supervisado.

### Actualizar una instalación existente

Con el servidor detenido, conservar **.env**, **data completa** y **server/uploads**. Reemplazar el código con este ZIP y ejecutar npm install. Las nuevas tablas/columnas se crean automáticamente al iniciar; no ejecutar scripts que borren la base. No hay datos de prueba dentro del ZIP.

### Comprobaciones

```powershell
npm run build
npm test
```

Las pruebas usan una base temporal y no modifican los datos del negocio. Las llamadas de Google se simulan para verificar creación, actualización y cancelación; se debe validar OAuth y la entrega real de avisos con las cuentas/proveedores conectados antes de usarlos comercialmente.

### Dependencias y npm

La dependencia shell-quote se fija en 1.11.0 mediante overrides para corregir GHSA-pqg4-j6r4-53mv. Se verificó npm audit sin vulnerabilidades, compilación y las 363 comprobaciones de integración. Si npm pide revisar scripts nativos, ejecutar `npm approve-scripts better-sqlite3` y luego `npm rebuild better-sqlite3`.

## Home, marca y plazos de pago

- Home de plataforma de reservas con tipografía clara, una agenda ilustrativa interactiva, pestañas de producto, seis vistas de escritorio, funciones, pasos, planes y preguntas frecuentes. Diseño propio, con referencias de estructura de AgendaPro y Fresha.
- Prueba gratuita de 15 días por defecto; Super Admin → Configuración permite elegir 7 o 15. La migración conserva las fechas de vencimiento de pruebas ya otorgadas; el nuevo plazo aplica a nuevos registros.
- Pagos → Plazo para pagar: de 5 a 1440 minutos, con accesos de 15 min, 30 min, 1 h, 2 h y 24 h. Cada reserva guarda su propia fecha de vencimiento; cambiar el ajuste no modifica reservas ya creadas. El plazo nunca supera el inicio del turno.
- Agenda muestra confirmados y pendientes, se actualiza cada 15 segundos y ofrece filtros Próximos / Pagos pendientes / Todos. Los vencidos se conservan en el historial como cancelados. El proceso de fondo expira reservas cada minuto; al consultar disponibilidad, agenda o estado también se aplica el vencimiento, por lo que un horario vencido no impide una nueva reserva.
- Mercado Pago recibe la misma fecha de vencimiento en su preferencia. Los webhooks repetidos conservan turnos completados; un pago recibido después de la cancelación o por importe insuficiente se marca para revisión sin ocupar nuevamente el horario. La devolución se coordina con la profesional; no se realiza automáticamente.
- Se mantienen los módulos de lista de espera, recordatorios, Calendar, recurrencias, packs y fidelidad.

La validación automatizada usa transporte simulado para Mercado Pago y Google. El circuito con cuentas reales se prueba al configurar esos proveedores.

### Fotografía de los ejemplos de plantillas

Archivo anterior incluido: `public/images/beauty-studio.png`. Se conserva como recurso del proyecto; la portada principal presenta el producto con una agenda interactiva. La fotografía anterior fue generada con la herramienta integrada de imágenes para este proyecto. Prompt de creación: “Editorial hero photograph for a premium beauty studio website: a quiet boutique beauty salon interior, no people; warm ivory plaster walls, oval mirror and caramel salon chair on the right, travertine counter and subtle beauty bottles on the left, sheer curtains, olive branch in a ceramic vase, sunlight and soft shadows. Architectural magazine photography, cream and muted terracotta palette. No text, logos or watermark.”

## Períodos de agenda y vacaciones

En **Herramientas → Agenda especial** se eligen **Fecha desde** y **Fecha hasta** (ambas incluidas). Seleccionar **Vacaciones o día libre** para cerrar todo el día, o **Horario especial** para indicar apertura y cierre. En Equipo se puede aplicar a todo el negocio o una profesional. Cada período acepta hasta 366 días; el mismo ámbito no puede tener períodos superpuestos. Un período de una profesional tiene prioridad sobre el de todo el negocio, como las excepciones anteriores.

**Períodos guardados → Editar período** permite cambiar fechas, profesional, modalidad, horas y motivo. Las fechas que salen del rango recuperan la agenda habitual. Eliminar un período también restaura la agenda habitual; otros bloqueos y reservas se conservan. Los turnos ya reservados no se cancelan: si quedan fuera del nuevo horario, aparece un aviso para revisarlos en Agenda. Los horarios especiales de un solo día de versiones anteriores se convierten automáticamente en períodos editables, conservando la disponibilidad.

En **Agenda → Días libres y horarios no disponibles**, fecha, todo el día, horas y motivo ahora tienen filas y etiquetas separadas. El servidor valida fechas reales y que el horario final sea posterior al inicial.

API de períodos (requiere sesión de la dueña del negocio): `POST /api/businesses/:id/tools/calendar-periods`, `PUT /api/businesses/:id/tools/calendar-periods/:pid` y `DELETE /api/businesses/:id/tools/calendar-periods/:pid`. Las rutas anteriores de excepciones siguen siendo compatibles para un solo día.


## FAQ de la Home de Adara

En **Super Admin → FAQ de la Home** se pueden agregar, editar, ocultar, ordenar y eliminar preguntas. Los cambios se muestran al volver a abrir la Home. Es independiente de las preguntas frecuentes de cada negocio. En las respuestas, `{dias_prueba}` se reemplaza por los 7 o 15 días configurados. Si todas están ocultas, la sección pública no aparece. Las preguntas iniciales se crean una sola vez y la actualización conserva las ediciones del administrador.

## Transferencias a alias o CBU/CVU

Desde **Pagos → Medios de pago que ofrecés**, la profesional activa Mercado Pago, transferencia o ambos. Para transferencia completa alias o CBU/CVU y titular; banco e instrucciones son opcionales. La reserva guarda una copia de estos datos, de modo que un cambio posterior no altere instrucciones ya enviadas. Los datos bancarios se muestran únicamente en el enlace privado de la reserva.

1. La clienta elige transferencia al reservar. El turno aparece en Agenda como **Esperando pago**, retenido hasta el plazo configurado.
2. Transfiere a la cuenta indicada y envía un comprobante PDF, JPG o PNG de hasta 5 MB desde su enlace privado.
3. La profesional revisa **Ver comprobante**, comprueba el ingreso real en su banco y usa **Confirmar transferencia**. Debe indicar el importe recibido y marcar que verificó el dinero. Entonces se confirma el turno.
4. El anticipo mínimo debe estar cubierto. Si la clienta transfirió el total, puede registrarse ese importe completo sin superar el precio del turno.
5. Si vence el plazo antes de la confirmación, el turno se cancela y el horario se libera automáticamente. El comprobante no extiende ese plazo ni confirma por sí mismo. Una transferencia tardía se coordina con la profesional; no se vuelve a ocupar el horario automáticamente.

Elegir un plazo que permita verificar el ingreso. La simulación de Mercado Pago no aprueba transferencias. El comprobante queda en `data/transfer-receipts`, con acceso sólo para la dueña del negocio, y debe conservarse junto a la base al actualizar.

### Débito y crédito fuera de Mercado Pago

Mercado Pago permite tarjeta de débito y crédito mediante su checkout. Fuera de Mercado Pago se puede conectar un adquirente como Payway, con cuenta comercial, credenciales, checkout y notificaciones de acreditación propios. Esta entrega incluye **Mercado Pago y transferencia manual**; no incorpora una integración de Payway ni un formulario propio para capturar datos de tarjetas. Una transferencia a alias no usa el checkout de Mercado Pago y no se verifica automáticamente con una imagen del comprobante.

## Condición de pago por clienta

Desde **Clientas → Pago para [nombre]**, o **Herramientas → Clientas y puntos**, elegir:

- **Usar la regla del negocio**: se aplica la seña o total habitual y la regla por ausencias.
- **Sin anticipo**: permite reservar sin seña ni pago previo, incluso cuando la regla por ausencias exigiría el total. El precio del servicio se mantiene y se paga al asistir.
- **Exigir pago completo**: la próxima reserva solicita el total por adelantado.

**Sin anticipo** genera un enlace privado para compartir sólo con esa clienta. El enlace precarga sus datos y exige su WhatsApp y, si está registrado, su email. Una reserva desde el enlace público común sigue la regla habitual. **Renovar enlace** invalida el anterior; volver a la regla del negocio o exigir pago completo también revoca el permiso. No se cargan etiquetas externas de Analytics o Meta en la visita con enlace privado para evitar compartirlo con terceros.

Para una sola reserva que está pendiente, **Agenda → Autorizar sin anticipo** la confirma sin cambiar la regla de futuros turnos. Debe marcarse una autorización expresa. Esta acción mantiene el precio, no genera un pago ni un reintegro, y sólo se permite antes de vencer el plazo. Una clienta bloqueada no puede usar el permiso privado.

### Foto nueva de las plantillas

`public/images/beauty-example.jpeg` contiene la foto proporcionada por la usuaria en esta actualización. Se usa en los seis ejemplos de plantillas de la Home. El archivo se copió sin modificar; la presentación se adapta al marco de cada plantilla mediante CSS.


## Suscripciones de Adara

La actualización permite autorizar planes mensuales o anuales desde **Plan**, consultar pagos y cancelar futuras renovaciones conservando el período pagado. **Super Admin → Suscripciones** administra los contratos y cuotas de la plataforma. Los precios especiales se aplican al crear un contrato y los cambios posteriores requieren una nueva autorización.

Para empezar, usar **Preparar suscripción de prueba → Simular primer pago** en desarrollo. Los cobros reales requieren configurar `MP_BILLING_ACCESS_TOKEN`, `MP_BILLING_WEBHOOK_SECRET` y URLs públicas HTTPS. En producción se deshabilita siempre la simulación de suscripciones. El período de gracia de renovaciones pendientes se configura en Super Admin, entre 0 y 14 días; no alarga la prueba gratuita.

Consultar [SUSCRIPCIONES.md](SUSCRIPCIONES.md) para actualizar, probar, conectar la cuenta y revisar los vencimientos. La compilación y las 624 comprobaciones pasaron; 261 comprueban el nuevo circuito con Mercado Pago simulado.
