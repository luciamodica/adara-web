# Publicar Adara en Render

Esta entrega permite servir la web y la API con un solo Web Service de Node.js. La base de datos, imágenes y comprobantes se guardan en el disco permanente. El modo local sigue funcionando con `npm run dev`.

## 1. Preparar el proyecto en Windows

Guardá una copia de tu carpeta actual, incluyendo `.env`, `data` y `server/uploads`. Extraé el ZIP actualizado. Si actualizás tu instalación local, conservá esas tres ubicaciones; no reemplaces ni borres tus datos.

Abrí PowerShell dentro de `adara-web`, donde está `package.json`:

```powershell
npm install
npm approve-scripts better-sqlite3
npm run build
```

Usá Node.js 24.19.0 o una versión posterior de Node 24. Si tu npm no reconoce `approve-scripts` y la instalación compiló correctamente, ese paso no es necesario.

Para seguir probando localmente:

```powershell
npm run dev
```

Las cuentas locales existentes no requieren `npm run db:seed`. En una instalación local nueva, ese comando crea el Super Admin de prueba. No se usa en Render.

## 2. Subir sólo el código a GitHub

En GitHub, creá un repositorio **privado**, por ejemplo `adara-web`, inicialmente sin README ni archivos adicionales. En PowerShell, desde la carpeta que contiene `package.json`:

```powershell
git init
git add .
git status --short
git commit -m "Preparar Adara para Render"
git branch -M main
```

Revisá el listado de `git status`: no debe incluir `.env`, `data`, fotos de `server/uploads`, `node_modules` ni `dist`. `.gitignore` ya excluye esas ubicaciones. El código, `package-lock.json`, `.env.example` y `render.yaml` sí deben incluirse. Si esta carpeta ya tiene un repositorio, conservá su conexión existente.

Después ejecutá los comandos de conexión que GitHub muestre para ese repositorio, usando TU dirección. Ejemplo para reemplazar `TU_USUARIO`:

```powershell
git remote add origin https://github.com/TU_USUARIO/adara-web.git
git push -u origin main
```

Los archivos que personalizaste desde el panel están en tu base de datos local y en las imágenes, no en el código. El primer disco de Render empieza vacío. Revisá la sección de migración antes de trasladar esas personalizaciones.

## 3. Crear el servicio con el Blueprint

1. Entrá a https://dashboard.render.com/.
2. Elegí **New → Blueprint** y conectá el repositorio privado.
3. Render detectará `render.yaml` en la raíz del repositorio. Revisá el servicio y el costo antes de confirmar su creación: el archivo solicita un servidor **pago**, una sola instancia y un disco de 1 GB.
4. Completá `SUPERADMIN_EMAIL` con tu email y `SUPERADMIN_PASSWORD` con una contraseña propia de al menos 12 caracteres. No uses la contraseña local `admin1234`.
5. Aplicá el Blueprint y revisá el progreso en **Events / Logs**.

Si subiste la carpeta `adara-web` completa dentro del repositorio, el archivo estará en `adara-web/render.yaml`. En ese caso seleccioná ese archivo y configurá `rootDir: adara-web` en el servicio del YAML antes de aplicarlo. Lo más simple es que `package.json` y `render.yaml` estén directamente en la raíz del repositorio.

La configuración incluida es:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Instancia | 0.5 CPU / 512 MB (`0.5c-512mb`) |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Disco | 1 GB, montado en `/var/data` |
| Node | `24.19.0` |
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/var/data` |
| `UPLOADS_DIR` | `/var/data/uploads` |
| `DEMO_PAYMENTS` / `DEMO_SUBSCRIPTIONS` | `false` |

El Blueprint genera automáticamente `JWT_SECRET` y `TOKEN_ENCRYPTION_KEY` con valores aleatorios. Conservá ambas claves en un lugar privado: la segunda permite recuperar las conexiones de Mercado Pago y Google de las profesionales. No se regeneran para una actualización normal.

`FRONTEND_URL` y `PUBLIC_API_URL` toman automáticamente la URL HTTPS de Render (`RENDER_EXTERNAL_URL`). No hay que adivinar la dirección antes del primer despliegue. Cuando conectes un dominio propio, definí ambas variables con su URL HTTPS, sin rutas adicionales.

Si creás el servicio manualmente, usá los mismos valores y generá dos claves aleatorias distintas de al menos 32 caracteres. **No uses Free**, porque esta versión necesita un disco permanente. No añadas `db:seed` al build ni al inicio.

## 4. Primer ingreso

Cuando el servicio muestre **Live**, abrí su dirección HTTPS y después `/login`. Ingresá con el email y la contraseña que configuraste: Adara te llevará al Super Admin.

La cuenta se crea sólo si no existe ningún Super Admin. Cambiar las variables después no resetea una contraseña existente. Una vez creado el acceso, podés eliminar `SUPERADMIN_PASSWORD` del entorno de Render; no se necesita para reiniciar ni actualizar.

Comprobá también `https://TU-SITIO.onrender.com/api/health`: debe responder `{"ok":true}`.

## 5. Activar el registro por email

Se puede publicar el Home y entrar al Super Admin antes de conectar los proveedores. **El registro de nuevas profesionales estará cerrado hasta configurar los emails reales.** En producción no se muestran enlaces locales de verificación, incluso si falla el envío.

En **Environment** agregá:

```text
RESEND_API_KEY=tu-clave-privada
EMAIL_FROM=Adara Web <no-reply@tu-dominio-verificado>
```

Resend necesita un remitente autorizado para enviar a tus usuarias. Su dominio de prueba no sirve como remitente general de una plataforma pública. Para abrir las inscripciones, conectá un dominio que puedas verificar con el proveedor de email. Guardá las variables y volvé a desplegar.

Probá registrarte con un email distinto al del Super Admin, recibir el enlace y abrirlo. Si el proveedor rechaza el envío, la cuenta queda pendiente y permite reenviar; no se confirma por un enlace de prueba.

## 6. Mercado Pago y Google

Para las señas de las clientas, agregá las credenciales OAuth de la plataforma y registrá esta dirección en Mercado Pago:

```text
MP_OAUTH_REDIRECT_URI=https://TU-SITIO.onrender.com/api/integrations/mercadopago/callback
```

Cada profesional conecta su propia cuenta desde su panel. El cobro de las suscripciones a Adara usa otras credenciales (`MP_BILLING_ACCESS_TOKEN`, `MP_BILLING_WEBHOOK_SECRET`). Seguí `SUSCRIPCIONES.md` para configurar el aviso firmado en `/api/webhooks/subscriptions` y comprobar el primer cobro real.

Para Google Calendar:

```text
GOOGLE_REDIRECT_URI=https://TU-SITIO.onrender.com/api/integrations/google/callback
```

Los pagos de prueba quedan desactivados en producción, aunque una variable antigua diga `true`. Los recordatorios, vencimientos y sincronización usan el proceso del servicio; no hace falta contratar un segundo worker para esta entrega.

## 7. Copias y datos locales

El disco permanente conserva los datos en las actualizaciones, pero también hay que guardar copias fuera de ese disco.

Para generar una copia desde PowerShell local, o desde **Shell** en Render:

```text
npm run backup
```

El comando crea una carpeta fechada en `data/backups` local o `/var/data/backups` en Render. Incluye una copia consistente de SQLite (con los cambios confirmados en WAL), las imágenes y los comprobantes privados. No incluye las claves ni `.env`. Para una copia completa de archivos, hacela en un momento sin modificaciones de fotos/comprobantes. Descargá la carpeta por SSH/SCP y guardá las claves por separado. La copia en el mismo disco no protege frente a perder ese disco. Las copias de esta entrega se ejecutan manualmente: no hay un cron externo contratado ni una descarga automática.

Si querés trasladar cuentas y personalizaciones desde tu PC:

1. Guardá primero una copia de seguridad y detené `npm run dev` con Ctrl+C.
2. Cambiá la contraseña del Super Admin local con `npm run admin:password`, definiendo `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` en su `.env`. La publicación rechaza `admin1234`. Generá luego una nueva copia para el traslado.
3. Las conexiones OAuth existentes necesitan la misma `TOKEN_ENCRYPTION_KEY` usada localmente, o el `JWT_SECRET` anterior si no había una clave separada. Si esa clave era la de ejemplo o es débil, hay que desconectar los proveedores en la instalación local y volver a conectarlos después con una clave nueva segura; no cambies una clave con tokens que querés conservar sin migrarlos.
4. Transferí la carpeta de la copia por SSH/SCP a una ubicación privada del disco, separada de las imágenes públicas, por ejemplo `/var/data/import`. No subas estos datos al repositorio. La restauración debe hacerse en un procedimiento de mantenimiento, con reservas, tareas y escrituras detenidas. **No reemplaces el archivo de una base SQLite mientras Adara lo tiene abierto.** Preparar y comprobar ese procedimiento es un paso aparte del despliegue inicial; esta entrega genera la copia, no incluye un comando de restauración automática.
5. No mezcles `app.db` con archivos `app.db-wal` o `app.db-shm` de otra base. La copia generada contiene un SQLite completo y no necesita esos dos archivos.
6. Después de una restauración controlada, iniciá nuevamente el servicio y verificá el acceso, imágenes, configuración y un turno. La base importada sustituye la base que se había creado en Render: no es una combinación de cuentas.

## 8. Antes de abrir comercialmente

Probá crear una cuenta real, verificar su email, configurar un servicio, reservar, pagar, cancelar y comprobar la agenda. Revisá los textos de Términos y Privacidad: las páginas actuales todavía tienen texto pendiente de completar. Las pruebas automáticas de proveedores usan transporte simulado; falta validar las credenciales y avisos reales con tu cuenta.

Esta arquitectura usa una única instancia. Si el tráfico crece, medí CPU, memoria, espacio y tiempos de respuesta; para varios servidores habrá que separar la base de datos y las imágenes. No compartas este SQLite entre varios procesos de despliegue.

Referencias oficiales consultadas:
- https://render.com/docs/web-services
- https://render.com/docs/disks
- https://render.com/docs/blueprint-spec
- https://render.com/docs/environment-variables
- https://render.com/docs/node-version
