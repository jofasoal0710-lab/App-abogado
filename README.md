# App Abogado · Gestión de bufete

Aplicación web interna para un despacho de abogados: **expedientes, clientes, agenda y plazos, documentos, control de horas y facturación**.

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Drizzle ORM · Tailwind CSS 4.

## Puesta en marcha

Requisitos: Node 22+ y PostgreSQL 16 (o Docker).

```bash
cp .env.example .env            # y cambia AUTH_SECRET: openssl rand -base64 32
docker compose up -d            # PostgreSQL local (o apunta DATABASE_URL a tu servidor)
npm install
npm run db:migrate              # crea las tablas
npm run db:seed                 # crea el administrador (imprime una contraseña aleatoria)
npm run dev                     # http://localhost:3000
```

Para probar con datos de ejemplo: `npm run db:seed -- --demo`
(usuarios `lucia@bufete.local` y `marcos@bufete.local`, contraseña `demo-bufete-2026`; **no usar en producción**).

Variables del administrador inicial: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`.

## Despliegue

Guía paso a paso para publicar la aplicación en **Netlify** con despliegue continuo desde este repositorio (base de datos en Neon, documentos en un bucket S3/R2, avisos por correo): **[DEPLOY.md](DEPLOY.md)**.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | Desarrollo, compilación y servidor de producción |
| `npm test` | Tests unitarios (importes, duraciones, numeración, fechas, facturas) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run db:generate` | Genera una migración tras cambiar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |

## Módulos

- **Clientes**: personas y empresas, búsqueda, ficha con expedientes y facturas.
- **Expedientes**: numeración correlativa por año (`EXP-2026-0001`), área, estado, juzgado, parte contraria, notas, honorarios por horas o tarifa fija. La ficha reúne notas, documentos, horas, agenda y facturas.
- **Agenda y plazos**: calendario mensual, audiencias/plazos/reuniones/tareas, alerta de plazos vencidos sin completar.
- **Documentos**: subida por expediente (máx. 25 MB, lista de extensiones permitida), descarga autenticada.
- **Horas**: registro con tarifa congelada por entrada; las facturadas quedan bloqueadas.
- **Facturación**: borrador → emitida (número correlativo `FAC-2026-0001`) → pagada / anulada; cobros parciales, IVA configurable, vista imprimible (Imprimir / PDF).
- **Permisos y confidencialidad**: expedientes abiertos, restringidos o confidenciales (ni los administradores), clientes confidenciales y registro de lecturas (ver abajo).
- **Recordatorios** (solo administradores): avisos por correo de plazos, audiencias y tareas (ver abajo).
- **Equipo** (solo administradores): altas, roles, tarifa horaria, desactivación y si recibe avisos por correo.

### Roles

| | Administrador | Abogado | Asistente |
|---|:-:|:-:|:-:|
| Clientes, expedientes, horas, agenda, documentos (subir) | ✓ | ✓ | ✓ |
| Eliminar clientes / documentos | ✓ | ✓ | – |
| Eliminar expedientes, gestionar equipo | ✓ | – | – |
| Ver expedientes **restringidos** | todos | solo si es responsable o miembro | solo si es miembro |
| Ver expedientes **confidenciales** | solo si es responsable o miembro | ídem | ídem |
| Cambiar visibilidad, responsable y miembros de un expediente | ✓ | solo si es su responsable | – |
| Emitir/anular facturas, borrar cobros | ✓ | ✓ | – |

## Permisos y confidencialidad

**Expedientes: tres niveles de visibilidad**

| Nivel | Quién lo ve |
|---|---|
| **Abierto** (por defecto) | Todo el equipo |
| **Restringido** | Responsable, miembros añadidos y administradores |
| **Confidencial** | Solo responsable y miembros. **Ni los administradores** (muralla china) |

Se elige al crear el expediente y se cambia en la pestaña *Acceso* (solo el responsable y los administradores *con acceso*). Esa pestaña muestra quién tiene acceso, un **historial** de cambios (visibilidad, miembros, responsable, reasignaciones, reclamaciones) y las **lecturas recientes**.

**Qué cubre.** Todo lo que cuelga del expediente: notas, documentos (incluida la descarga), horas, agenda, facturas y cobros; en listas, búsquedas, ficha de cliente, panel y cifras, y en **cada** acción del servidor. Quien no tiene acceso recibe **404** (no se revela que existe). Los avisos por correo no se envían a quien no pueda ver el expediente y no se puede asignar un evento a alguien sin acceso.

**Clientes confidenciales.** Un cliente confidencial solo lo ve quien lo dio de alta o quien tiene acceso a alguno de sus expedientes; sus expedientes nunca pueden ser abiertos (al marcar un cliente como confidencial, sus expedientes abiertos pasan a restringidos). Las facturas sueltas (sin expediente) siguen al cliente. Lo gestionan su creador o un administrador con acceso (no los asistentes).

**Salvaguardas contra el bloqueo.** Un confidencial exige responsable activo; quien lo hace confidencial debe ser responsable o miembro (si no, se bloquearía a sí mismo); no se puede quitar a la última persona activa con acceso ni desactivar a la única persona activa que tiene acceso a un confidencial; ser administrador no basta para eliminar un expediente sin acceso.

**Procedimiento de emergencia.** Si un confidencial queda sin ninguna persona activa con acceso, aparece **solo a los administradores** en *Equipo*, que pueden reclamarlo con un **motivo obligatorio** que queda en el historial. Solo funciona cuando de verdad está huérfano. Es la única excepción deliberada a la muralla china.

**Reasignación.** Cuando alguien pierde el acceso (se le quita como miembro, se restringe el expediente, cambia el responsable o el cliente pasa a ser confidencial), sus eventos **pendientes** en ese expediente pasan al responsable y queda anotado. Los completados no se tocan.

**Registro de lecturas.** En expedientes restringidos/confidenciales y clientes confidenciales se anotan las aperturas de ficha, facturas y descargas de documentos (quién y cuándo; lo repetido en 10 min cuenta una vez). Lo abierto no se registra. Lo ven el responsable y los administradores con acceso.

**Limitaciones conocidas**
- Un administrador **ve los restringidos** (y, por tanto, el cliente confidencial si tiene un expediente restringido suyo). Para ocultárselo, marca los expedientes como **confidenciales**.
- Los números de expediente y de factura son correlativos: un hueco en la serie revela que existe algo oculto (no qué).
- Borrar un cliente con expedientes ocultos responde "tiene expedientes o facturas asociados".
- Las aperturas de pantalla se registran **desde el navegador**: una persona técnica podría evitarlas bloqueando esa llamada. Las **descargas** se registran siempre en el servidor. Las lecturas no se pueden borrar desde la aplicación y se conservan indefinidamente.
- No se registran listas ni búsquedas, solo el acceso a fichas, facturas y documentos.
- La reasignación no avisa por separado al nuevo responsable (le llegan los recordatorios normales).
- Los administradores de la base de datos, evidentemente, ven todo: esto protege dentro de la aplicación, no frente a quien tenga acceso directo a PostgreSQL o a `UPLOAD_DIR`.

## Recordatorios por correo

Cada persona recibe **un solo correo resumen** con los plazos, audiencias, reuniones y tareas que tiene asignados y que toca avisar. Si un evento no tiene responsable, el aviso va al responsable de su expediente.

**Configuración (`.env`)** — cualquier servidor SMTP:

| Proveedor | `SMTP_HOST` | `SMTP_PORT` | `SMTP_SECURE` | Usuario / contraseña |
|---|---|---|---|---|
| Gmail | `smtp.gmail.com` | `465` | `true` | tu correo + *contraseña de aplicación* (requiere verificación en dos pasos) |
| Outlook / Microsoft 365 | `smtp.office365.com` | `587` | `false` | tu correo + contraseña (el administrador debe permitir *SMTP autenticado*) |
| Servidor de tu dominio | el de tu hosting | `587` o `465` | según puerto | los que te dé el hosting |

Además: `MAIL_FROM` (remitente), `APP_URL` (para los enlaces) y, opcionalmente, `REMINDER_DAYS` (por defecto `7,3,1,0,-1`: una semana, 3 días, 1 día y el mismo día antes, y un aviso de vencido un día después) y `REMINDER_HOUR`.

**Cómo se envían** (elige uno):
- `REMINDERS_SCHEDULER=true`: planificador interno; revisa cada 15 min y envía desde `REMINDER_HOUR` (solo para despliegues de **una** instancia).
- Cron externo: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/cron/recordatorios` (por ejemplo, a diario). Sin `CRON_SECRET` el endpoint queda desactivado.

La pantalla **Recordatorios** (administradores) permite enviar un correo de prueba, ver qué se enviará y ejecutar los avisos a mano, y muestra el historial.

**Reglas**
- Cada aviso se envía **una sola vez** (se registra por evento + fecha + antelación). Si se reprograma el evento, vuelve a avisar.
- Se avisa solo lo no completado. "Vencido" solo aplica a plazos y tareas, y solo durante 7 días después.
- Un evento **nuevo** con menos margen que la antelación mayor recibe un aviso de recuperación (p. ej. creado con 5 días de margen, avisa "en 5 días" y luego en 3, 1 y 0).
- Si el SMTP falla, se reintenta en la siguiente ejecución, hasta 3 intentos; después se da por perdido y queda visible en el historial.
- Es seguro ejecutarlo varias veces o desde varios sitios a la vez (bloqueo en PostgreSQL).

## Decisiones de diseño

- **Dinero en céntimos (enteros)**. Las líneas por horas guardan la cantidad en minutos, de modo que `1 h 25 min × 150 €/h = 212,50 €` es exacto.
- **Concurrencia**: la numeración de expedientes y facturas usa bloqueos consultivos de PostgreSQL dentro de la transacción; las horas se bloquean (`FOR UPDATE`) al facturar, así que dos facturas simultáneas no pueden cobrar las mismas horas.
- **Numeración fiscal**: una factura anulada conserva su número; solo las emitidas reciben número.
- **Seguridad**: sesión JWT firmada en cookie `httpOnly`; **cada página, ruta de descarga y Server Action comprueba por sí misma la sesión y el rol** (no hay middleware que sustituya esa comprobación); contraseñas con bcrypt; limitador de intentos de login; redirecciones solo a rutas internas; documentos fuera de `public/`, con nombre aleatorio, MIME deducido de la extensión y servidos siempre como descarga (con almacenamiento S3, mediante una URL firmada de 60 s emitida solo tras comprobar el acceso).
- **Zona horaria**: el proceso fija `APP_TIMEZONE` (por defecto `Europe/Madrid`) para que las horas de la agenda no dependan de dónde esté alojado el servidor.

## Despliegue y limitaciones conocidas

- Define `AUTH_SECRET` y `DATABASE_URL` reales, sirve la app tras HTTPS y haz copias de seguridad de la base de datos **y** de `UPLOAD_DIR`.
- Los documentos usan disco local por defecto (`STORAGE_DRIVER=local`, para un servidor propio con disco persistente) o almacenamiento compatible con S3 (`STORAGE_DRIVER=s3`, obligatorio en Netlify; ver [DEPLOY.md](DEPLOY.md)).
- El limitador de intentos de login vive en la base de datos (5 fallos por IP+correo y 15 por correo, cada 15 min): sirve con varias instancias. Un atacante podría bloquear temporalmente a un usuario concreto con 15 intentos.
- Sin retención IRPF, facturas rectificativas ni facturación electrónica oficial (Verifactu/FacturaE).
- Sin firma electrónica ni portal de clientes.
