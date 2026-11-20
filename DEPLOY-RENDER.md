# Despliegue en Render (plan gratuito)

Guía para publicar la aplicación en **Render** con **despliegue continuo**: cada cambio que se sube a la rama `ccr-5f143f7a-if1jv4` se compila y se publica solo. Todo se define en [`render.yaml`](render.yaml).

> Lee la sección 8 («Qué está verificado y qué no») antes de empezar.

## 0. Qué esperar del plan gratuito (importante)

| Límite del plan gratuito | Consecuencia para esta app |
|---|---|
| El servicio **se duerme tras 15 min sin visitas** y tarda cerca de un minuto en despertar ([Render](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)) | La primera visita tras un rato espera ~1 min. Ver sección 6 para mantenerlo despierto |
| **Disco efímero** (los discos persistentes requieren plan de pago) | Los documentos **tienen que ir a un bucket S3**; con disco se perderían en cada reinicio |
| La **base de datos gratuita de Render caduca a los 30 días** y se borra tras 14 más de gracia | Por eso se usa una base de datos externa gratuita, **Supabase** (o Neon), y no la de Render |
| 750 horas de instancia gratuitas al mes por espacio de trabajo | Un servicio encendido 24/7 gasta ~744: cabe **uno** |

Si el despacho va a usar la app a diario con datos reales, el plan gratuito es para **probar**; para producción seria conviene el plan de pago (sin dormirse, con copias y disco opcional). Ver sección 9.

## 1. Piezas

| Pieza | Para qué | Coste |
|---|---|---|
| **Render** (servicio web) | La aplicación | Gratis |
| **[Supabase](https://supabase.com)** (PostgreSQL, región Frankfurt) | Todos los datos | Gratis (ver sección 2) |
| **Bucket S3** (Cloudflare R2, Backblaze B2, Supabase Storage…) | Documentos | Cada proveedor tiene un tramo gratuito; **comprueba si te pide tarjeta** |
| **Servidor SMTP** (Gmail, Outlook, tu dominio) | Avisos por correo (opcional) | El que ya tengas |

## 2. Base de datos (Supabase)

Los nombres de los menús de Supabase pueden variar un poco; lo importante es lo que se elige en cada paso.

1. **Proyecto.** En [supabase.com](https://supabase.com), *New project*:
   - **Database password**: genera una larga **solo con letras y números** (los símbolos habría que codificarlos dentro de la cadena). Guárdala en un lugar seguro: Supabase no la vuelve a mostrar.
   - **Region**: **Central EU (Frankfurt)**. Es la región del servicio de Render y está en la UE.
2. **Cadena de conexión.** Botón **Connect** → *Connection string* → método **Session pooler** (ni *Direct connection* ni *Transaction pooler*). Tiene esta forma:

   ```
   postgresql://postgres.<ref-del-proyecto>:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

   Cópiala tal cual y sustituye `[YOUR-PASSWORD]` (corchetes incluidos) por la contraseña. Será `DATABASE_URL`.
   - *Por qué Session pooler:* la conexión directa de Supabase usa IPv6, que Render no admite de forma fiable. El *Session pooler* funciona por IPv4 y cada conexión se comporta como una sesión normal (migraciones y bloqueos funcionan igual). El *Transaction pooler* (puerto 6543) no debe usarse.
3. **Certificado.** *Project Settings → Database → SSL Configuration → Download certificate*. Abre el fichero con un editor de texto y copia **todo** su contenido, incluidas las líneas `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`. Será `DATABASE_SSL_CA`. En esa misma sección puedes activar *Enforce SSL on incoming connections*.
   - *Por qué:* Supabase firma el certificado de la base de datos con una autoridad propia que Node no reconoce, y sin ella la conexión se rechaza (`unable to verify the first certificate`). Con `DATABASE_SSL_CA` la app **verifica** que habla con tu base de datos (cadena del certificado y nombre del servidor) en vez de desactivar la comprobación. El certificado no es secreto.
4. **Cierra la API automática.** *Project Settings → Data API*: desactiva *Enable Data API* (o quita `public` de los esquemas expuestos).
   - *Por qué:* Supabase publica por defecto las tablas del esquema `public` en una API REST que la app no usa. Además, todas las tablas de la app tienen **Row Level Security** activada sin políticas, de modo que esa API no podría leer ni escribir nada aunque siguiera activa; desactivarla es una segunda barrera.
5. **Plan gratuito** (comprueba las condiciones actuales en Supabase): la base de datos tiene un tamaño máximo (500 MB al escribir esto) y **el proyecto se pausa tras una semana sin actividad**; se reactiva desde el panel de Supabase sin perder datos. Revisa también qué copias de seguridad incluye tu plan: con datos reales de un despacho conviene, además, una copia propia periódica (`pg_dump`).

**Alternativa: Neon.** Proyecto en región UE (Frankfurt), cadena **directa** (sin `-pooler` en el nombre del servidor) terminada en `?sslmode=require`. No necesita `DATABASE_SSL_CA`: su certificado lo emite una autoridad pública.

## 3. Almacenamiento (bucket S3)

Los documentos se suben **directamente del navegador al bucket** con una URL firmada de 10 minutos, y se descargan con otra de 60 segundos que la app solo emite tras comprobar el acceso.

### Opción A — Supabase Storage (la misma cuenta que la base de datos)

1. *Storage → New bucket*: nombre `documentos`, con **Public bucket desactivado** (privado).
2. *Project Settings → Storage → S3 Connection*: activa la conexión por protocolo S3 y anota el **Endpoint** (`https://<ref-del-proyecto>.storage.supabase.co/storage/v1/s3`) y la **Region** (con el proyecto en Frankfurt, `eu-central-1`).
3. En esa misma pantalla, *S3 Access Keys → New access key*: anota el **Access key ID** y el **Secret access key** (el secreto solo se muestra una vez). Esta clave da acceso a **todos** los buckets del proyecto: trátala como una contraseña.
4. `render.yaml` ya trae `S3_REGION=eu-central-1` y `S3_FORCE_PATH_STYLE=true`, que es lo que necesita Supabase. Si tu región es otra, cámbiala en `render.yaml` (no solo en el panel: la siguiente sincronización del Blueprint la volvería a poner).
5. CORS: Supabase no tiene un ajuste de CORS para esto. Si al subir un documento aparece un error de CORS, avísame.
6. **Tamaño máximo por fichero (recomendado):** en la configuración del bucket `documentos` (*Edit bucket*), activa la restricción de tamaño de subida y ponla en **25 MB**, el máximo que admite la app. Así el propio almacenamiento rechaza ficheros mayores aunque alguien manipule la subida.

La app borra cada hora las subidas que nunca llegaron a registrarse (pestaña cerrada a mitad, por ejemplo) y limita a 100 cada 15 minutos las subidas que puede preparar una persona. Solo toca ficheros creados por la propia app; y si de pronto pareciera que «sobran» muchos (por ejemplo, porque `DATABASE_URL` apunta a otra base de datos), no borra nada y lo deja anotado en el log.

### Opción B — Cloudflare R2 (otro proveedor S3)

1. Crea un bucket **privado** y un token de API con permiso de lectura y escritura **solo sobre ese bucket**. Anota *Access Key ID*, *Secret Access Key* y el *endpoint* S3 (`https://<ID_DE_CUENTA>.r2.cloudflarestorage.com`). Cloudflare puede pedir un método de pago para activar R2, aunque tiene tramo gratuito. En `render.yaml`, pon `S3_REGION` a `auto`.
2. **CORS** (imprescindible; sin él el navegador no podrá subir documentos). La URL de Render la sabrás tras el primer despliegue; vuelve aquí entonces:

   ```json
   [
     {
       "AllowedOrigins": ["https://TU-SERVICIO.onrender.com"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 4. Render

1. En el panel de Render: *New → Blueprint*, conecta tu cuenta de GitHub y elige este repositorio. Render lee `render.yaml`.
2. Te pedirá las variables sin valor en el fichero (`sync: false`):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Cadena del *Session pooler* de Supabase (sección 2) |
| `S3_BUCKET` | Nombre del bucket |
| `S3_ENDPOINT` | Endpoint S3 del proveedor |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Las del token |

   Añade además, con *Add Environment Variable*, **`DATABASE_SSL_CA`** con el certificado de Supabase (sección 2). No está en `render.yaml`, así que Render no la pide.

   Si el servicio ya existe porque el primer despliegue falló por falta de variables (`✖ Falta DATABASE_URL…`), no hace falta repetir el Blueprint: rellénalas en *Environment* y pulsa *Manual Deploy → Deploy latest commit*.

   `AUTH_SECRET` y `CRON_SECRET` **los genera Render** (aleatorios). No hay que poner `APP_URL`: se usa la URL pública que Render asigna.
3. Pulsa *Apply*. El primer despliegue **aplica las migraciones** (crea las tablas), compila y arranca. El `render.yaml` ya apunta a la rama `ccr-5f143f7a-if1jv4`.
4. Cuando termine, anota la URL `https://<nombre>.onrender.com` y **añádela al CORS del bucket** (sección 3).

## 5. Primer administrador y datos del despacho

El primer despliegue crea las tablas pero **ningún usuario**.

**Opción fácil, desde el panel de Render.** En *Environment* añade `SEED_ADMIN_EMAIL` (tu correo) y `SEED_ADMIN_PASSWORD` (al menos 10 caracteres) y despliega. El build crea ese administrador **solo si la base de datos no tiene ningún usuario**; en los despliegues siguientes no hace nada. La contraseña no aparece en el log. Es **provisional**: al entrar por primera vez la aplicación te pedirá elegir una nueva, así que la del panel deja de servir. Aun así, **borra `SEED_ADMIN_PASSWORD`** del panel cuando hayas entrado.

Las personas que des de alta en «Equipo» también reciben una contraseña provisional y eligen la suya al entrar.

**Opción alternativa, desde tu ordenador** (con una copia del repositorio y `npm ci`), contra la base de datos de producción, **sin** `--demo`:

```bash
DATABASE_URL="<cadena del Session pooler>" \
DATABASE_SSL_CA="$(cat <ruta-del-certificado-descargado>)" \
SEED_ADMIN_EMAIL="tu@correo.com" SEED_ADMIN_PASSWORD="una-contraseña-larga-y-única" \
npm run db:seed
```

**Nunca ejecutes `npm run db:seed -- --demo` contra producción** (crea usuarios con contraseñas conocidas).

Edita `FIRM_NAME`, `FIRM_TAX_ID`, `FIRM_ADDRESS`… en *Environment* del servicio. Para activar los **avisos por correo** añade `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM` (ver el README).

## 6. Mantenerlo despierto (opcional, no garantizado)

Con el plan gratuito, el servicio se duerme a los 15 min. Dos consecuencias: la primera visita espera ~1 min, y el **planificador de recordatorios se duerme con él** (al despertar se pone al día y envía lo pendiente, pero un aviso no saldrá a su hora si nadie visita la app).

Truco habitual: un servicio externo gratuito (por ejemplo [cron-job.org](https://cron-job.org) o UptimeRobot) que haga `GET https://<nombre>.onrender.com/api/health` cada 10 minutos. Ese endpoint no toca la base de datos ni devuelve nada sensible. Ten en cuenta:
- Gasta casi todas las 750 horas gratuitas del mes (cabe un solo servicio).
- Render podría cambiar sus condiciones; no es una garantía.
- Como alternativa para los avisos, el mismo servicio puede llamar cada hora a `POST /api/cron/recordatorios?respectHour=1` con la cabecera `Authorization: Bearer <CRON_SECRET>` (el secreto está en *Environment*). Es idempotente: no duplica avisos.

## 6b. Factura electrónica (Hacienda, v4.4)

La aplicación genera el comprobante (XML v4.4), lo firma con tu llave criptográfica y lo envía directamente a Hacienda. Empieza **siempre en el ambiente de pruebas**.

1. **Datos del emisor:** en la app, *Facturas → Factura electrónica*: nombre, cédula, actividad económica (6 dígitos), dirección con códigos de provincia, cantón y distrito, y el CABYS predeterminado.
2. **Credenciales** (solo en Render → *Environment*, nunca en la app ni en un chat):
   - `HACIENDA_USERNAME`: usuario del API que generas en ATV / TRIBU-CR (`cpf-…` o `cpj-…`).
   - `HACIENDA_PASSWORD`: su contraseña.
   - `HACIENDA_P12_BASE64`: la llave `.p12` en base64. En Mac o Linux: `base64 -i llave.p12 | tr -d '\n'`. En Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("llave.p12"))`.
   - `HACIENDA_P12_PIN`: el PIN de la llave.
   - `HACIENDA_ENV`: `pruebas` (por defecto) o `produccion`. El usuario, la contraseña y la llave de pruebas son distintos de los de producción.
3. Pulsa **Probar conexión con Hacienda**. Luego, en una factura emitida, pulsa **Enviar a Hacienda**:
   - Cliente con cédula, DIMEX o NITE → factura electrónica.
   - Cliente sin identificación costarricense → tiquete electrónico.
   - Rectificativa → nota de crédito (si abona) o de débito (si cobra más), con referencia a la factura original, que debe estar aceptada antes.
4. Para pasar a producción: cambia las 4 credenciales por las de producción y pon `HACIENDA_ENV=produccion`. Si ya facturabas con otro sistema, usa otra terminal (00002) para no repetir consecutivos.

Cada comprobante guarda el XML firmado y la respuesta de Hacienda (descargables desde la factura), y el PDF incluye la clave y el consecutivo. Si un envío queda «sin confirmar», pulsa **Consultar estado** antes de reintentar.

## 7. Cambios posteriores (despliegue continuo) y seguridad

- Cada `git push` a la rama compila, aplica las migraciones pendientes y publica. Render conserva despliegues anteriores.
- **Las migraciones son solo hacia delante**: revertir un despliegue no deshace la base de datos. Antes de una migración delicada, haz una copia de la base de datos (`pg_dump`, o las copias de Supabase si tu plan las incluye).
- Un build de producción que falla con un mensaje que empieza por `✖` es una salvaguarda del script de build (`AUTH_SECRET`, base de datos o almacenamiento): el mensaje dice qué falta.
- **No hay autenticación en dos pasos**: usa contraseñas largas y únicas.
- **Protección de datos (RGPD):** son datos de clientes de un despacho. Usa regiones UE y formaliza los contratos de encargado del tratamiento con Render, Supabase y el proveedor del bucket.
- Límite de login: 5 fallos por IP+correo y 15 por correo cada 15 min; y, si la IP es fiable (ver abajo), 30 fallos por IP entre todas las cuentas. Para desbloquear: `delete from login_attempts;`.
- **IP del cliente (`CLIENT_IP_HEADER`):** sin ella, la IP que se anota puede estar falseada y el límite por IP entre cuentas está desactivado (a propósito: si todo pareciera venir de la misma IP, bloquearía a todo el despacho). Para configurarla: entra como administrador en **Seguridad → Detección de la IP de origen**; ahí ves qué cabeceras llegan y con qué IP. Busca tu IP pública (p. ej. «cuál es mi IP» en un buscador), elige la cabecera que la contiene **sola** y añádela en *Environment* como `CLIENT_IP_HEADER`.
- **Política de seguridad de contenido (CSP):** cada página solo ejecuta los scripts de la propia app (con un *nonce* por respuesta); un HTML inyectado no puede ejecutar código. Si añades algo externo (analítica, chat…), habría que permitirlo en `src/lib/csp.ts`.

## 8. Qué está verificado y qué no

**Verificado en local**, simulando Render con la mayor fidelidad posible: una **copia limpia del repositorio** (como un clon nuevo), `npm ci --include=dev` con `NODE_ENV=production`, el `buildCommand` y el `startCommand` exactos de `render.yaml`, `PORT=10000`, las variables de entorno de producción y un emulador S3:
- El build aplica **las migraciones sobre una base de datos vacía** (16 tablas), compila, y en producción se niega a continuar sin secreto, base de datos o almacenamiento S3. Un preview de pull request no migra ni exige secretos.
- El servidor arranca en el puerto indicado y **en todas las interfaces**; `/api/health` responde también **con PostgreSQL parado**; el planificador de recordatorios arranca.
- Todo el flujo de documentos con subida directa (21 comprobaciones) contra ese servidor.
- Una cabecera de IP falsa **no** se acepta salvo que se configure `CLIENT_IP_HEADER`, y con ella configurada el límite por IP funciona.
- **Memoria en marcha: ~155–165 MB** (cabe de sobra en 512 MB).

**Preparación para Supabase, verificada en local** con un PostgreSQL con TLS cuyo certificado firma una autoridad propia (como hace Supabase):
- Sin `DATABASE_SSL_CA` la conexión se rechaza; con ella conecta por TLS 1.3. Una autoridad ajena o un nombre de servidor distinto se rechazan (la verificación es real), y ni siquiera `?sslmode=disable` en la cadena puede desactivar el cifrado.
- Las 8 migraciones se aplican desde cero por TLS, y toda la aplicación (más de 300 comprobaciones de extremo a extremo) funciona con todas sus conexiones cifradas.
- Con los permisos que Supabase da por defecto a su rol anónimo, ese rol ve **0 filas** en todas las tablas y no puede insertar, modificar ni borrar (sin RLS vería los datos: comprobado como control).
- Si el proveedor corta una conexión inactiva (Supabase y Neon lo hacen al pausar o reiniciar), la app ya no se cae: descarta esa conexión y abre otra.

**NO verificado** (solo se sabrá en el primer despliegue real):
- **⚠ La memoria del build.** Medido en local, el build llega a un pico de **~1,1 GB** (Turbopack) o **~840 MB** (con `--webpack`, más lento). El plan gratuito tiene 512 MB de RAM. Render indica que un build que se queda sin memoria falla, pero **no he podido confirmar cuánta memoria tienen los builds del plan gratuito** (una respuesta antigua del personal de Render habla de 8 GB; puede no estar vigente). Si el primer build falla con *out of memory*, las salidas son: subir de plan, o compilar fuera de Render (por ejemplo, en GitHub Actions) y desplegar una imagen ya construida. Dímelo y lo preparo.
- **El `render.yaml` contra Render.** Es YAML válido y sus campos coinciden con la documentación consultada, pero no se ha podido validar con Render. Puntos no confirmados: que la región `frankfurt` ofrezca instancias gratuitas (si el Blueprint se queja, cambia `region`) y que `NODE_VERSION` sea la forma de fijar la versión de Node (`package.json` también exige Node ≥ 22).
- **Qué cabecera lleva la IP real del cliente en Render** (por eso `CLIENT_IP_HEADER` no está configurada).
- Que el proveedor real (Supabase Storage o R2) acepte las URLs firmadas y el CORS (el emulador usado **no valida firmas**). Las sumas de verificación automáticas del SDK están desactivadas porque varios proveedores compatibles con S3 las rechazan.
- El comportamiento real tras dormirse y despertar.
- **Supabase real**: no he podido conectarme a Supabase desde aquí. No está comprobado que su *Session pooler* presente un certificado válido para su nombre con la autoridad que se descarga del panel (si no, verás `Hostname/IP does not match certificate's altnames`; avísame), ni los nombres exactos de sus menús.

## 9. Si más adelante pasas al plan de pago

Cambiar `plan: free` por uno de pago en `render.yaml` elimina el dormirse. Con un disco persistente puedes usar `STORAGE_DRIVER=local`, `UPLOAD_DIR` apuntando al disco y `ALLOW_LOCAL_STORAGE=true` (los documentos quedarían en un único servidor; el bucket S3 sigue siendo la opción más robusta). La base de datos de Render de pago también sustituye a Supabase si prefieres todo en un sitio.

## 10. Netlify

La CSP usa `src/proxy.ts`, que en Netlify se ejecutaría como función de borde: **no está verificado en Netlify** (el despliegue recomendado es Render). Si ya conectaste el repositorio a Netlify y ya no lo usas, **borra o desconecta ese sitio** en Netlify para que deje de intentar desplegar y fallar con cada cambio. Los ficheros de Netlify (`netlify.toml`, `DEPLOY.md`) pueden quedarse en el repositorio sin molestar.

## 11. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El build se detiene con `✖ Hay N problemas en las variables de entorno` | Debajo están **todos** los problemas a la vez, cada uno con qué cambiar y dónde. Corrígelos en *Environment* y vuelve a desplegar |
| El build se detiene con `✖ No se pudo conectar con la base de datos` | La línea siguiente explica la causa (contraseña, certificado, pooler, proyecto en pausa…) y qué cambiar |
| El build falla con `✖ AUTH_SECRET…` / `✖ STORAGE_DRIVER…` | Falta una variable (sección 4) |
| `unable to verify the first certificate` o `self-signed certificate in certificate chain` | Falta `DATABASE_SSL_CA` o no es el certificado de tu proyecto (sección 2) |
| `DATABASE_SSL_CA no es un certificado PEM` | El certificado se copió incompleto: deben ir también las líneas `BEGIN` y `END` |
| `ENETUNREACH` o una dirección IPv6 en el error | Se usó la conexión directa de Supabase: usa la del *Session pooler* |
| `Tenant or user not found` | En la cadena del pooler el usuario debe ser `postgres.<ref-del-proyecto>`: cópiala tal cual de Supabase |
| `password authentication failed` | Contraseña mal sustituida en la cadena (o con símbolos sin codificar) |
| `Hostname/IP does not match certificate's altnames` | No verificado con Supabase real (sección 8): avísame |
| Errores de conexión con **Neon** | La cadena no termina en `?sslmode=require` |
| La app no responde y en Supabase el proyecto aparece en pausa | Pasó una semana sin actividad: reactívalo desde su panel |
| Al subir un documento: «No se pudo subir… CORS» | Con R2: falta la URL de Render en el CORS del bucket. Con Supabase: avísame (sección 3) |
| Al subir o descargar: `SignatureDoesNotMatch` o `403` | Claves, `S3_ENDPOINT` o `S3_REGION` no coinciden con el proveedor (sección 3) |
| La web tarda ~1 min la primera vez | El plan gratuito se había dormido (sección 6) |
| Los avisos no salen a su hora | El servicio estaba dormido: ver sección 6 |
| El build falla con *out of memory* | Memoria del build del plan gratuito (sección 8) |
| El Blueprint no se sincroniza | Revisa la región (sección 8) o las variables `sync: false` |
