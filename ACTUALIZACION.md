# Actualización de Adara Web

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
