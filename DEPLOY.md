# Despliegue en Netlify

Guía para publicar la aplicación en **Netlify** con **despliegue continuo**: cada vez que se sube un cambio a la rama de producción del repositorio, Netlify lo compila y lo publica solo.

> **Antes de empezar, lee la sección 9 («Qué está verificado y qué no»).** Se ha comprobado en local todo lo que se puede comprobar sin una cuenta de Netlify, pero hay piezas que solo se pueden confirmar en el primer despliegue real.

## 1. Cómo encaja todo

Netlify solo aloja la aplicación (funciones sin estado y disco efímero). Por eso hacen falta tres servicios más:

| Pieza | Para qué | Recomendado (cualquiera equivalente vale) |
|---|---|---|
| **Netlify** | La aplicación web | — |
| **PostgreSQL** | Todos los datos | [Neon](https://neon.tech) (región UE) |
| **Almacenamiento S3** | Documentos de los expedientes | [Cloudflare R2](https://developers.cloudflare.com/r2/) (también AWS S3, Backblaze B2…) |
| **Servidor SMTP** | Avisos por correo | El que ya uses (Gmail, Outlook, tu dominio) |

**¿Por qué S3 y no el disco?** El disco de Netlify es efímero (los documentos desaparecerían) y sus funciones no admiten peticiones de más de ~6 MB, así que los documentos (hasta 25 MB) **se suben directamente del navegador al bucket** con una URL firmada de corta vida; el servidor solo autoriza y, al terminar, comprueba en el bucket que el fichero existe y mide lo declarado.

## 2. Base de datos (Neon)

1. Crea un proyecto en Neon, región **UE** (por ejemplo `eu-central-1`).
2. En *Connection details* copia **dos** cadenas:
   - **Con pooler** (el host lleva `-pooler`): será `DATABASE_URL`. La usa la aplicación.
   - **Directa** (sin `-pooler`): será `MIGRATE_DATABASE_URL`. La usan las migraciones durante el build.
3. Ambas deben terminar en `?sslmode=require`.

## 3. Almacenamiento (Cloudflare R2)

1. Crea un bucket **privado** (sin acceso público) y anota su nombre.
2. Crea un token de API con permiso *Object Read & Write* **solo sobre ese bucket**. Anota *Access Key ID* y *Secret Access Key*.
3. El *endpoint* S3 es `https://<ID_DE_CUENTA>.r2.cloudflarestorage.com`; la región, `auto`.
4. **CORS del bucket** (imprescindible: sin esto el navegador no podrá subir). Sustituye la URL por la de tu sitio (la sabrás en el paso 4; puedes añadirla después) y, si usas dominio propio, añádelo también:

   ```json
   [
     {
       "AllowedOrigins": ["https://TU-SITIO.netlify.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Con AWS S3 el formato de CORS es el mismo; en `S3_ENDPOINT` déjalo vacío y pon tu región real en `S3_REGION`.

## 4. Netlify

1. *Add new site → Import an existing project → GitHub* y elige este repositorio.
2. **Rama de producción.** El repositorio solo tiene la rama `ccr-5f143f7a-if1jv4` (no existe `main`). En *Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts* pon esa rama como **Production branch**. Así, cada cambio que se suba a ella se publica automáticamente.
3. El comando de build ya viene en `netlify.toml` (`npm run build:deploy`); no hace falta tocar nada más.
4. Variables de entorno (*Site configuration → Environment variables*). Defínelas con ámbito **solo Production** (ver sección 7):

| Variable | Obligatoria | Valor |
|---|:-:|---|
| `AUTH_SECRET` | ✓ | Cadena aleatoria de ≥32 caracteres: `openssl rand -base64 32`. **El build de producción falla si falta.** |
| `DATABASE_URL` | ✓ | Cadena **con pooler** de Neon |
| `MIGRATE_DATABASE_URL` | ✓ | Cadena **directa** de Neon |
| `DATABASE_POOL_MAX` | ✓ | `3` |
| `STORAGE_DRIVER` | ✓ | `s3` (el build falla si no, para no perder documentos) |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` | ✓ | Nombre del bucket / endpoint de R2 / `auto` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | ✓ | Las del token de R2 |
| `APP_URL` | ✓ | `https://TU-SITIO.netlify.app` (enlaces de los correos y de la función programada) |
| `APP_TIMEZONE` | ✓ | `Europe/Madrid` |
| `CLIENT_IP_HEADER` | recomendada | `x-nf-client-connection-ip` (la IP real que entrega Netlify, para el límite de intentos de login) |
| `FIRM_NAME`, `FIRM_TAX_ID`, `FIRM_ADDRESS`, `CURRENCY`, `DEFAULT_TAX_RATE` | ✓ | Datos del despacho y facturación |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | para avisos | Ver el README (Gmail/Outlook/dominio) |
| `CRON_SECRET` | para avisos | Cadena aleatoria de ≥16 caracteres |
| `REMINDER_HOUR`, `REMINDER_DAYS` | opcional | Hora local de envío (por defecto 8) y antelaciones |

   **No definas** `REMINDERS_SCHEDULER` (en Netlify no hay proceso permanente; los avisos los lanza la función programada), `UPLOAD_DIR` ni `ALLOW_LOCAL_STORAGE`.

5. Lanza el primer despliegue (*Deploys → Trigger deploy*). En producción, el build **aplica las migraciones** de la base de datos antes de compilar.

## 5. Primer administrador

El primer despliegue crea las tablas pero **ningún usuario**. Créalo desde tu ordenador contra la base de datos de producción (conexión directa), **sin** `--demo`:

```bash
DATABASE_URL="<cadena directa de Neon>" \
SEED_ADMIN_EMAIL="tu@correo.com" SEED_ADMIN_PASSWORD="una-contraseña-larga-y-única" \
npm run db:seed
```

**Nunca ejecutes `npm run db:seed -- --demo` contra producción**: crea usuarios con contraseñas conocidas.

## 6. Comprobaciones tras el primer despliegue

1. Entra en `https://TU-SITIO.netlify.app` e inicia sesión.
2. **Recordatorios → Enviar correo de prueba**: debe llegarte un correo.
3. Sube un documento **de más de 6 MB** a un expediente y descárgalo. Si el navegador dice que no puede subir, es casi seguro el **CORS** del bucket (sección 3).
4. En Netlify, *Functions*: debe aparecer `reminders` como función programada (cada hora). Puedes probarla con *Run now*.
5. Crea un plazo para mañana asignado a ti y pulsa **Enviar avisos pendientes ahora**.
6. Mira la hora de un evento de la agenda: debe coincidir con la hora local del despacho (si estuviera desplazada, revisa `APP_TIMEZONE`).

## 7. Seguridad: lo que hay que hacer sí o sí

- **Ámbito de las variables = solo Production.** Los *Deploy Previews* y las ramas secundarias compilan el mismo código; si tuvieran `DATABASE_URL` de producción, una rama de pruebas podría tocar datos reales. Sin esas variables, los previews compilan pero no funcionan, que es lo deseable. (Si quieres previews funcionales, apúntalos a una **rama de Neon distinta**.)
- Los previews **nunca** aplican migraciones (lo garantiza el script de build); solo el contexto `production` lo hace.
- Usa un `AUTH_SECRET` y un `CRON_SECRET` únicos y no los reutilices. Rótalos si se filtran (rotar `AUTH_SECRET` cierra todas las sesiones).
- El bucket debe ser **privado**. Las descargas usan URLs firmadas de 60 s emitidas solo tras comprobar el acceso al expediente.
- **No hay autenticación en dos pasos.** Usa contraseñas largas y únicas. Si necesitas una capa extra, Netlify ofrece protección con contraseña o por IP en algunos planes.
- **Protección de datos (RGPD):** son datos de clientes de un despacho. Elige regiones UE, formaliza contratos de encargado del tratamiento con Netlify, Neon y el proveedor de almacenamiento, y activa copias de seguridad en Neon (restauración a un punto en el tiempo).
- Limitador de login: 5 fallos por IP+correo y 15 por correo cada 15 min. Si bloqueas a alguien por error: `delete from login_attempts;`.

## 8. Cambios posteriores (despliegue continuo)

- Cada `git push` a la rama de producción compila, aplica migraciones pendientes y publica. Netlify conserva los despliegues anteriores.
- **Las migraciones son solo hacia delante.** *Revertir un despliegue* en Netlify vuelve al código anterior pero **no deshace** los cambios de base de datos. Por eso, antes de una migración delicada crea una rama/copia en Neon.
- Para aplicar las migraciones tú mismo en lugar de en el build: define `SKIP_DB_MIGRATE=true` y ejecuta `DATABASE_URL=<directa> npm run db:migrate` antes de desplegar.
- Si un build de producción falla con un mensaje que empieza por `✖`, es una de las salvaguardas del script (`AUTH_SECRET`, base de datos o almacenamiento): el propio mensaje dice qué falta.

## 9. Qué está verificado y qué no

**Verificado en local:**
- El build con la CLI de Netlify y su adaptador de Next.js (v5.16) termina bien y empaqueta la función de servidor y la función programada `reminders`.
- El script de build: en producción se niega a continuar sin `AUTH_SECRET` válido, sin base de datos o con almacenamiento local; los previews no migran.
- Todo el flujo de documentos con un **emulador S3** y un navegador real: subida directa (incluido un fichero de 12 MB, que el servidor nunca recibe), descarga por redirección, permisos, tamaño adulterado, token ajeno o repetido y borrado.
- El limitador de login en base de datos (incluido el ataque rotando de IP) y que todas las páginas se protegen solas sin middleware.
- El endpoint de recordatorios con control de hora, y toda la batería de pruebas de las fases anteriores.

**NO verificado (solo se sabrá en el primer despliegue real):**
- **El tiempo de ejecución real de Netlify**: arranques en frío, que la zona horaria se aplique en sus funciones (el código la fija al arrancar, sin depender de `instrumentation.ts`, pero no se ha podido probar allí) y que la función programada se ejecute.
- **Que R2/S3 acepte las URLs firmadas y el CORS.** El emulador usado **no valida firmas**, así que se ha comprobado la forma de la URL (firma AWS4, caducidad de 60 s) y no su aceptación por un servicio real. El cliente está configurado según la recomendación de R2 (`requestChecksumCalculation: WHEN_REQUIRED`).
- **El pooler de Neon.** El bloqueo de recordatorios se ha hecho a nivel de transacción precisamente para que sea seguro con él, pero solo se ha probado contra PostgreSQL directo.
- **Límites de Netlify:** las funciones tienen 60 s de tiempo máximo y ~6 MB de petición/respuesta; cualquier funcionalidad futura que genere respuestas grandes (por ejemplo, exportaciones a PDF/CSV de la fase 3) deberá tenerlo en cuenta.

## 10. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Al subir un documento: «No se pudo subir… configuración CORS» | CORS del bucket ausente o con otro origen (sección 3) |
| El build falla con `✖ AUTH_SECRET…` / `✖ STORAGE_DRIVER…` | Falta una variable de producción (sección 4) |
| Errores de conexión a la base de datos | La cadena no termina en `?sslmode=require`, o `DATABASE_URL` no es la del pooler |
| Los correos no llegan | Revisa *Recordatorios → Enviar correo de prueba* y las variables SMTP |
| No se envían avisos automáticos | `CRON_SECRET`/`APP_URL` sin definir, o la función `reminders` no figura en *Functions* |
| Horas de la agenda desplazadas | `APP_TIMEZONE` mal puesta |
| Un usuario no puede entrar tras muchos intentos | Bloqueo temporal de 15 min (sección 7) |
