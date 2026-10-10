# Actualización de Adara Web

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
