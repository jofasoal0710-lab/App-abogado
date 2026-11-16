# Despliegue en Render (plan gratuito)

Guía para publicar la aplicación en **Render** con **despliegue continuo**: cada cambio que se sube a la rama `ccr-5f143f7a-if1jv4` se compila y se publica solo. Todo se define en [`render.yaml`](render.yaml).

> Lee la sección 8 («Qué está verificado y qué no») antes de empezar.

## 0. Qué esperar del plan gratuito (importante)

| Límite del plan gratuito | Consecuencia para esta app |
|---|---|
| El servicio **se duerme tras 15 min sin visitas** y tarda cerca de un minuto en despertar ([Render](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)) | La primera visita tras un rato espera ~1 min. Ver sección 6 para mantenerlo despierto |
| **Disco efímero** (los discos persistentes requieren plan de pago) | Los documentos **tienen que ir a un bucket S3**; con disco se perderían en cada reinicio |
| La **base de datos gratuita de Render caduca a los 30 días** y se borra tras 14 más de gracia | Por eso este Blueprint usa **Neon** (gratuito y sin caducidad) y no la base de datos de Render |
| 750 horas de instancia gratuitas al mes por espacio de trabajo | Un servicio encendido 24/7 gasta ~744: cabe **uno** |

Si el despacho va a usar la app a diario con datos reales, el plan gratuito es para **probar**; para producción seria conviene el plan de pago (sin dormirse, con copias y disco opcional). Ver sección 9.

## 1. Piezas

| Pieza | Para qué | Coste |
|---|---|---|
| **Render** (servicio web) | La aplicación | Gratis |
| **[Neon](https://neon.tech)** (PostgreSQL, región UE) | Todos los datos | Gratis |
| **Bucket S3** (Cloudflare R2, Backblaze B2, Supabase Storage…) | Documentos | Cada proveedor tiene un tramo gratuito; **comprueba si te pide tarjeta** |
| **Servidor SMTP** (Gmail, Outlook, tu dominio) | Avisos por correo (opcional) | El que ya tengas |

## 2. Base de datos (Neon)

1. Crea un proyecto en Neon, región **UE**.
2. Copia la cadena de conexión (termina en `?sslmode=require`). Será `DATABASE_URL`.

## 3. Almacenamiento (bucket S3)

1. Crea un bucket **privado** y un token de API con permiso de lectura y escritura **solo sobre ese bucket**. Anota *Access Key ID*, *Secret Access Key* y el *endpoint* S3 (en R2: `https://<ID_DE_CUENTA>.r2.cloudflarestorage.com`; región `auto`).
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
| `DATABASE_URL` | Cadena de Neon |
| `S3_BUCKET` | Nombre del bucket |
| `S3_ENDPOINT` | Endpoint S3 del proveedor |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Las del token |

   `AUTH_SECRET` y `CRON_SECRET` **los genera Render** (aleatorios). No hay que poner `APP_URL`: se usa la URL pública que Render asigna.
3. Pulsa *Apply*. El primer despliegue **aplica las migraciones** (crea las tablas), compila y arranca. El `render.yaml` ya apunta a la rama `ccr-5f143f7a-if1jv4`.
4. Cuando termine, anota la URL `https://<nombre>.onrender.com` y **añádela al CORS del bucket** (sección 3).

## 5. Primer administrador y datos del despacho

El primer despliegue crea las tablas pero **ningún usuario**. Créalo desde tu ordenador contra la base de datos de producción, **sin** `--demo`:

```bash
DATABASE_URL="<cadena de Neon>" \
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

## 7. Cambios posteriores (despliegue continuo) y seguridad

- Cada `git push` a la rama compila, aplica las migraciones pendientes y publica. Render conserva despliegues anteriores.
- **Las migraciones son solo hacia delante**: revertir un despliegue no deshace la base de datos. Antes de una migración delicada, crea una rama/copia en Neon.
- Un build de producción que falla con un mensaje que empieza por `✖` es una salvaguarda del script de build (`AUTH_SECRET`, base de datos o almacenamiento): el mensaje dice qué falta.
- **No hay autenticación en dos pasos**: usa contraseñas largas y únicas.
- **Protección de datos (RGPD):** son datos de clientes de un despacho. Usa regiones UE y formaliza los contratos de encargado del tratamiento con Render, Neon y el proveedor del bucket.
- Límite de login: 5 fallos por IP+correo y 15 por correo cada 15 min. Para desbloquear: `delete from login_attempts;`.
- **IP del cliente:** el límite por IP solo se fía de la cabecera que indiques en `CLIENT_IP_HEADER`. En Render **no he podido confirmar** qué cabecera lleva la IP real, así que no está configurada: se usa `X-Forwarded-For`, que un atacante podría falsear. El límite **por correo** no depende de la IP y sigue protegiendo.

## 8. Qué está verificado y qué no

**Verificado en local**, simulando Render con la mayor fidelidad posible: una **copia limpia del repositorio** (como un clon nuevo), `npm ci --include=dev` con `NODE_ENV=production`, el `buildCommand` y el `startCommand` exactos de `render.yaml`, `PORT=10000`, las variables de entorno de producción y un emulador S3:
- El build aplica **las 6 migraciones sobre una base de datos vacía** (16 tablas), compila, y en producción se niega a continuar sin secreto, base de datos o almacenamiento S3. Un preview de pull request no migra ni exige secretos.
- El servidor arranca en el puerto indicado y **en todas las interfaces**; `/api/health` responde también **con PostgreSQL parado**; el planificador de recordatorios arranca.
- Todo el flujo de documentos con subida directa (21 comprobaciones) contra ese servidor.
- Una cabecera de IP falsa **no** se acepta salvo que se configure `CLIENT_IP_HEADER`, y con ella configurada el límite por IP funciona.
- **Memoria en marcha: ~155–165 MB** (cabe de sobra en 512 MB).

**NO verificado** (solo se sabrá en el primer despliegue real):
- **⚠ La memoria del build.** Medido en local, el build llega a un pico de **~1,1 GB** (Turbopack) o **~840 MB** (con `--webpack`, más lento). El plan gratuito tiene 512 MB de RAM. Render indica que un build que se queda sin memoria falla, pero **no he podido confirmar cuánta memoria tienen los builds del plan gratuito** (una respuesta antigua del personal de Render habla de 8 GB; puede no estar vigente). Si el primer build falla con *out of memory*, las salidas son: subir de plan, o compilar fuera de Render (por ejemplo, en GitHub Actions) y desplegar una imagen ya construida. Dímelo y lo preparo.
- **El `render.yaml` contra Render.** Es YAML válido y sus campos coinciden con la documentación consultada, pero no se ha podido validar con Render. Puntos no confirmados: que la región `frankfurt` ofrezca instancias gratuitas (si el Blueprint se queja, cambia `region`) y que `NODE_VERSION` sea la forma de fijar la versión de Node (`package.json` también exige Node ≥ 22).
- **Qué cabecera lleva la IP real del cliente en Render** (por eso `CLIENT_IP_HEADER` no está configurada).
- Que R2/S3 acepte las URLs firmadas y el CORS (el emulador usado **no valida firmas**).
- El comportamiento real tras dormirse y despertar.

## 9. Si más adelante pasas al plan de pago

Cambiar `plan: free` por uno de pago en `render.yaml` elimina el dormirse. Con un disco persistente puedes usar `STORAGE_DRIVER=local`, `UPLOAD_DIR` apuntando al disco y `ALLOW_LOCAL_STORAGE=true` (los documentos quedarían en un único servidor; el bucket S3 sigue siendo la opción más robusta). La base de datos de Render de pago también sustituye a Neon si prefieres todo en un sitio.

## 10. Netlify

Si ya conectaste el repositorio a Netlify y ya no lo usas, **borra o desconecta ese sitio** en Netlify para que deje de intentar desplegar y fallar con cada cambio. Los ficheros de Netlify (`netlify.toml`, `DEPLOY.md`) pueden quedarse en el repositorio sin molestar.

## 11. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El build falla con `✖ AUTH_SECRET…` / `✖ DATABASE_URL…` / `✖ STORAGE_DRIVER…` | Falta una variable (sección 4) |
| Errores de conexión a la base de datos | La cadena no termina en `?sslmode=require` |
| Al subir un documento: «No se pudo subir… CORS» | Falta la URL de Render en el CORS del bucket (sección 3) |
| La web tarda ~1 min la primera vez | El plan gratuito se había dormido (sección 6) |
| Los avisos no salen a su hora | El servicio estaba dormido: ver sección 6 |
| El build falla con *out of memory* | Memoria del build del plan gratuito (sección 8) |
| El Blueprint no se sincroniza | Revisa la región (sección 8) o las variables `sync: false` |
