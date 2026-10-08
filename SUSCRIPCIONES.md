# Suscripciones de Adara Web

Esta actualización incorpora las cuotas que una profesional paga por usar Adara. El dinero de esas cuotas se recibe en la cuenta de la dueña de la plataforma. Los cobros de reservas siguen en la cuenta de cada profesional y tienen su propio circuito.

## Probar primero en tu computadora

Con el servidor detenido, conservar `.env`, toda la carpeta `data` y `server/uploads`. Reemplazar el código con este ZIP y ejecutar en la carpeta `adara-web`:

```powershell
npm install
npm run dev
```

No ejecutar `npm run db:seed` sobre una instalación con datos. La actualización crea las tablas de suscripción automáticamente.

1. Abrir `http://localhost:5173` e ingresar a una cuenta de profesional.
2. Ir a **Plan**. Elegir plan y frecuencia Mensual o Anual.
3. Revisar el importe. Si el Super Admin asignó un precio especial al plan actual, se usa ese importe.
4. Confirmar el email con el que se autorizaría la suscripción y marcar la autorización de la renovación.
5. Tocar **Preparar suscripción de prueba** y luego **Simular primer pago**.
6. Ver el estado Activa, el período pagado y el historial. La simulación local registra un primer período desde ese momento; no hace un cargo real ni ejecuta débitos futuros.
7. Tocar **Cancelar renovación**, marcar la confirmación y confirmar. El período ya pagado y los datos se conservan.
8. Volver a suscribirse con frecuencia Anual: el inicio del nuevo contrato respeta el período pagado anterior.
9. Desde **Super Admin → Suscripciones**, revisar contratos, importes, fechas y pagos. La plataforma no muestra los turnos ni las clientas de los negocios.

Sin un token de cobro real y fuera de producción se habilita la simulación, salvo que `DEMO_SUBSCRIPTIONS=false`. La pantalla la identifica expresamente como prueba local. Con `NODE_ENV=production` no se permite simular suscripciones.

## Conectar la cuenta real de Adara

Este paso requiere que la web y la API ya tengan direcciones HTTPS públicas. Los avisos de Mercado Pago no pueden entrar al localhost de tu computadora.

1. Ingresar a Mercado Pago con la cuenta donde se recibirán las cuotas de Adara.
2. En **Tus integraciones**, crear una aplicación para esta integración y obtener su **Access Token**. Usar una aplicación para el cobro de Adara, separada de la conexión OAuth de las profesionales.
3. Configurar los Webhooks de esa aplicación con la dirección pública de la API seguida de `/api/webhooks/subscriptions`. Elegir eventos de **Planes y suscripciones** y de **Pagos**.
4. Guardar en el servidor el Access Token y la clave secreta de los Webhooks. No se cargan en la página pública ni se envían por este chat.
5. Mantener las demás variables de tu `.env` y agregar o completar:

```dotenv
MP_BILLING_ACCESS_TOKEN=tu-access-token-privado
MP_BILLING_WEBHOOK_SECRET=tu-clave-secreta-de-webhooks
FRONTEND_URL=https://tu-dominio
PUBLIC_API_URL=https://tu-dominio-api
DEMO_SUBSCRIPTIONS=false
DEMO_PAYMENTS=false
NODE_ENV=production
```

Las dos URLs pueden ser iguales si el servidor dirige `/api` hacia el backend. Escribirlas sin barra final. Las credenciales de cobro de Adara son independientes de `MP_PLATFORM_CLIENT_ID`, `MP_PLATFORM_CLIENT_SECRET` y `MP_OAUTH_REDIRECT_URI`, que se usan para conectar cuentas de profesionales.

6. Reiniciar el servidor. **Super Admin → Suscripciones** muestra si las variables y las URLs HTTPS están completas.
7. Validar con la guía vigente de Mercado Pago el circuito con sus cuentas y medios de prueba antes de abrirlo a profesionales. Las pruebas automatizadas de este ZIP verifican el transporte simulado; no certifican una cuenta de Mercado Pago ni una acreditación real.

Documentación oficial:

- [Resumen de Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/overview)
- [Suscripciones con pago pendiente](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
- [Webhooks de Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)

## Qué autoriza la profesional

La profesional revisa el importe y la frecuencia en Adara y autoriza el medio de pago dentro del entorno de Mercado Pago. Adara no captura ni guarda números de tarjeta.

- Mensual: cobro cada mes.
- Anual: cobro cada 12 meses, por el importe anual completo.
- El primer cobro se programa a partir del final de la prueba o del período ya pagado, el que sea posterior. Si ambos terminaron, se programa unos minutos después de crear la suscripción.
- El acceso pagado se activa al acreditar un pago válido. Una autorización de renovación pendiente o una vuelta del navegador desde Mercado Pago no reemplazan esa acreditación.
- El plan elegido en una nueva suscripción se aplica con el primer pago de su período. Para elegir un plan con menos agendas, primero se deben desactivar integrantes que superen el límite.

El contrato guarda el plan, frecuencia y precio autorizados. Cambiar el precio público o especial no cambia automáticamente un contrato existente. Para cambiar la próxima cuota hay que cancelar su renovación y autorizar un nuevo contrato; se conserva el período ya pagado. Si el precio cambia mientras se completa el formulario, Adara pide revisarlo nuevamente.

## Cancelación y cuentas especiales

**Plan → Cancelar renovación** detiene los próximos cobros del contrato. Conserva el período pagado. No realiza un reintegro ni revierte un cobro que Mercado Pago ya inició. Los reintegros se gestionan en Mercado Pago y sus avisos actualizan el pago correspondiente en Adara.

Super Admin puede cancelar futuras renovaciones desde **Suscripciones**. Mientras hay un contrato en curso, los cambios de plan, frecuencia y estado manual de suscripción desde **Negocios** se bloquean para evitar que la pantalla y el contrato se contradigan. Los precios especiales pueden editarse, pero se aplican a una nueva autorización.

Para una cuenta bonificada, sin un contrato en curso, poner precio especial $0 y estado **Activa** desde **Super Admin → Negocios**. No se genera un contrato de débito de $0. Las activaciones administrativas existentes se conservan y las controla el Super Admin.

Suspender una cuenta impide su uso y nuevas reservas públicas, pero no cancela por sí mismo un contrato de Mercado Pago. Para detener sus renovaciones, usar también la acción de cancelación de Suscripciones.

## Vencimientos y conservación de datos

**Super Admin → Configuración → Días de gracia para renovaciones pendientes** permite elegir entre 0 y 14, con 3 por defecto. La gracia se aplica tras un período pagado cuando el contrato sigue autorizado o pausado; no extiende la prueba gratuita y no se aplica a renovaciones canceladas.

Al vencer el acceso, se pausan las nuevas reservas públicas y la edición del negocio. La profesional puede entrar a Plan, consultar sus datos y gestionar turnos ya creados. No se borran clientas, fotos ni reservas. El pago aprobado reactiva el acceso, salvo que la cuenta esté suspendida por el Super Admin.

## Avisos y comprobaciones

Los Webhooks se validan con firma y cada recurso se consulta con el token de cobro de Adara. Los pagos deben corresponder al contrato, importe y moneda ARS. Un aviso duplicado no agrega otro período; un importe incorrecto queda para revisión. Los períodos se calculan con meses calendario y conservan las fechas de cada cobro.

Mientras el servidor está encendido, el proceso de suscripciones revisa contratos cada cinco minutos como respaldo de los avisos. Con email configurado se envían avisos de pago, cancelación y problemas. Sin proveedor quedan identificados como avisos locales; no se presentan como emails entregados. El comprobante del proveedor de pago es independiente de una factura fiscal.

```powershell
npm run build
npm test
```

La entrega pasó 624 comprobaciones: 363 de los módulos anteriores y 261 de suscripciones. Se revisó en navegador el flujo completo en escritorio y celular, incluyendo precio especial, consentimiento, pago local, cancelación, frecuencia anual, Super Admin, gracia y vencimiento.
