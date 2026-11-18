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

- **Render (plan gratuito)** — recomendado: **[DEPLOY-RENDER.md](DEPLOY-RENDER.md)** y [`render.yaml`](render.yaml). Servidor Node permanente, base de datos en Supabase (o Neon) y documentos en un bucket S3.
- **Netlify** — **[DEPLOY.md](DEPLOY.md)**. Funciona, pero al ser *serverless* exige adaptaciones y tiene límites (peticiones de ~6 MB, 60 s).

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
- **Facturación**: borrador → emitida (número correlativo `FAC-2026-0001`) → pagada; cobros parciales, IVA y **retención IRPF** configurables, **facturas rectificativas** (serie `RECT-2026-0001`), **PDF** de cada factura y **exportación CSV** del libro de facturas (ver «Facturación» abajo).
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
| Cambiar su propia contraseña y ver sus sesiones («Mi cuenta») | ✓ | ✓ | ✓ |
| Restablecer contraseñas de otros, cerrar sus sesiones, ver el registro de seguridad | ✓ | – | – |
| Registrar cobros | ✓ | ✓ | ✓ |
| Emitir facturas, borrar cobros | ✓ | ✓ | – |
| Crear facturas rectificativas, exportar el libro de facturas (CSV) | ✓ | ✓ | – |
| Descargar el PDF de una factura | ✓ (si ve el expediente/cliente) | ✓ (ídem) | ✓ (ídem) |

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

## Facturación

**Ciclo**: borrador (editable, sin número) → emitida (número correlativo por serie y año) → pagada. Una factura emitida **ya no se anula ni se edita**: se corrige con una **rectificativa**. (Se retiró deliberadamente el botón «Anular»: en España una factura emitida no se «borra», se rectifica.)

**Retención IRPF**
- Cada factura lleva un porcentaje de retención (0–60 %). Por defecto 15 % cuando el cliente es una **empresa** y 0 % para particulares; el valor por defecto se cambia con `DEFAULT_WITHHOLDING_RATE`.
- Se calcula sobre la **base imponible** (no sobre el IVA): `total = base + IVA − retención`.
- Se muestra en pantalla, en el PDF, en el CSV y en los totales pendientes.

**Facturas rectificativas** (solo administradores y abogados)
- Se crean desde una factura emitida («Rectificar»), con **motivo obligatorio**. Nacen en borrador con las líneas de la original en negativo (abono total); se pueden ajustar para una rectificación parcial («por diferencias»: las líneas son el **cambio** respecto a la original, con signo).
- Al emitirse reciben número de la **serie propia `RECT`** (no consumen números de `FAC`, que sigue sin huecos).
- La rectificativa nunca puede abonar **más de lo facturado**: la suma de la original y de todas sus rectificativas emitidas no puede quedar por debajo de 0. Dos abonos totales simultáneos de la misma factura no pasan los dos (bloqueo en la base de datos).
- La factura original muestra «rectificada por RECT-…», su **total neto** y su **saldo a favor del cliente** si ya estaba cobrada; las rectificativas no se cobran.
- Si la factura tenía horas vinculadas, al emitir una rectificativa total se puede elegir **liberar esas horas** para volver a facturarlas.
- Los importes de un abono son **exactamente** el negativo de los de la original (redondeo simétrico «half away from zero»; hay una prueba de propiedad con 500 casos aleatorios).

**PDF**: `/api/facturas/<id>/pdf` (botón «Descargar PDF» en la ficha). Se genera en el servidor con `pdf-lib` (sin navegador ni servicios externos): despacho, cliente con NIF, líneas, base, IVA, retención, total, referencia a la original en las rectificativas, paginación y marca de agua «BORRADOR» en borradores. La ruta exige sesión y respeta el acceso al expediente/cliente (404 si no se ve); la descarga de una factura de un expediente confidencial **queda en el registro de lecturas**. Las fuentes estándar del PDF solo cubren el alfabeto latino occidental: los caracteres fuera de él (p. ej. emojis) se sustituyen por «?».

**Exportación CSV** (`/facturas/exportar`, solo administradores y abogados): libro de facturas **emitidas** (no borradores) por rango de fechas, con accesos rápidos por trimestre y resumen de totales netos (base, IVA, retención). Formato para Excel en español (`;` como separador, coma decimal, BOM UTF-8, fechas `dd/mm/aaaa`), importes en negativo para las rectificativas y columnas «Rectifica a» y «Motivo». Solo incluye lo que el usuario puede ver (las facturas de un expediente confidencial no salen en el CSV de quien no tiene acceso), con un máximo de 20.000 filas, y neutraliza la **inyección de fórmulas** (un nombre de cliente como `=HIPERVINCULO(...)` sale como texto).

**Supuestos fiscales a validar con vuestro gestor** (la app los aplica tal cual; no sustituyen el asesoramiento profesional):
1. Retención del 15 % por defecto para clientes empresa (en los 3 primeros años de actividad suele ser el 7 %; configurable por factura).
2. Las rectificativas son **«por diferencias»** (no «por sustitución») y siguen la serie `RECT`.
3. No hay **suplidos** (gastos pagados por cuenta del cliente) ni tipos de IVA distintos por línea: un solo IVA por factura.
4. No hay **facturación electrónica oficial** (Verifactu / FacturaE): el PDF y el CSV son documentos de gestión, no el registro oficial de facturación.

## Cuentas, sesiones y registro de seguridad

- **Contraseña provisional y cambio obligatorio.** Al crear una cuenta, el administrador pone una contraseña provisional; al entrar por primera vez la persona tiene que elegir la suya (hasta entonces no puede usar nada: ni páginas, ni descargas, ni acciones). Lo mismo cuando un administrador restablece una contraseña. Así el administrador nunca conoce la contraseña definitiva de nadie.
- **«Mi cuenta»** (todas las personas): cambiar la propia contraseña (pide la actual; 5 intentos fallidos la bloquean 15 min), ver las sesiones abiertas (navegador, IP, desde cuándo) y cerrar las de otros dispositivos.
- **Sesiones en el servidor, de 12 horas como máximo.** Cerrar sesión, cambiar la contraseña, restablecerla o desactivar a alguien anula sus sesiones **al instante**, aunque alguien hubiera copiado la cookie. En la base de datos solo se guarda un hash del identificador de sesión.
- **Avisos por correo** (si hay SMTP configurado): cuando cambia la contraseña de una cuenta, a su titular (si la restableció un administrador, se dice cuál; si a la vez cambió el correo, se avisa a la dirección anterior). Nunca incluyen la contraseña.
- **Registro de seguridad** (pantalla «Seguridad», solo administradores): inicios de sesión correctos, fallidos (con el motivo) y bloqueados, cierres de sesión, cambios y restablecimientos de contraseña, altas, cambios de rol y de correo, desactivaciones y sesiones cerradas; con fecha, quién, a quién e IP. Nunca guarda contraseñas ni tokens. Los intentos bloqueados se anotan una vez por correo y ventana (no se puede inundar el registro). Se conserva un año.

## Recordatorios por correo

Cada persona recibe **un solo correo resumen** con los plazos, audiencias, reuniones y tareas que tiene asignados y que toca avisar. Si un evento no tiene responsable, el aviso va al responsable de su expediente.

**Configuración (`.env`)** — cualquier servidor SMTP:

| Proveedor | `SMTP_HOST` | `SMTP_PORT` | `SMTP_SECURE` | Usuario / contraseña |
|---|---|---|---|---|
| Gmail | `smtp.gmail.com` | `465` | `true` | tu correo + *contraseña de aplicación* (requiere verificación en dos pasos) |
| Outlook / Microsoft 365 | `smtp.office365.com` | `587` | `false` | tu correo + contraseña (el administrador debe permitir *SMTP autenticado*) |
| Servidor de tu dominio | el de tu hosting | `587` o `465` | según puerto | los que te dé el hosting |

Con el puerto 587 la conexión se cifra con STARTTLS y es **obligatorio**: si el servidor no lo ofrece (o alguien lo suprime por el camino), no se envía nada, tampoco la contraseña. Solo para un servidor interno de confianza sin cifrado existe `SMTP_REQUIRE_TLS=false`.

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
- **Concurrencia**: la numeración de expedientes y facturas usa bloqueos consultivos de PostgreSQL dentro de la transacción; las horas se bloquean (`FOR UPDATE`) al facturar, así que dos facturas simultáneas no pueden cobrar las mismas horas. Las ediciones de un borrador (cabecera, líneas, eliminarlo) bloquean la factura igual que la emisión y comprueban que sigue en borrador, así que nada puede modificar ni borrar una factura ya emitida aunque coincida en el mismo instante.
- **Numeración fiscal**: solo las facturas emitidas reciben número, correlativo por serie (`FAC`, `RECT`) y año; los borradores no consumen números.
- **Redondeo**: IVA y retención se redondean «half away from zero» para que un abono sea exactamente el negativo de la factura original.
- **Seguridad**: sesión con estado en el servidor (12 h, revocable al instante) en cookie `httpOnly` firmada; **cada página, ruta de descarga y Server Action comprueba por sí misma la sesión y el rol** (no hay middleware que sustituya esa comprobación); contraseñas con bcrypt; limitador de intentos de login; política de seguridad de contenido con *nonce* por respuesta (`src/proxy.ts` solo añade cabeceras, no controla el acceso); cambios de acceso, su historial y la reasignación de eventos en una sola transacción; redirecciones solo a rutas internas (la ruta se interpreta como lo haría el navegador, que elimina tabuladores y saltos de línea y trata «\» como «/», y se exige que siga en el mismo origen); cabecera HSTS (solo HTTPS) y sin `X-Powered-By`; correo SMTP siempre cifrado; documentos fuera de `public/`, con nombre aleatorio, MIME deducido de la extensión y servidos siempre como descarga (con almacenamiento S3, mediante una URL firmada de 60 s emitida solo tras comprobar el acceso).
- **Row Level Security en todas las tablas**, sin políticas: la app no se ve afectada (se conecta con el rol dueño de las tablas), pero cualquier otro rol queda sin acceso. En Supabase eso cierra su API REST automática. Las tablas nuevas deben llevar `.enableRLS()` en `src/db/schema.ts`.
- **Conexión a la base de datos**: con `DATABASE_SSL_CA` (proveedores con autoridad propia, como Supabase) la conexión es siempre cifrada y verificada; el pool descarta las conexiones que el proveedor corta en vez de caerse.
- **Zona horaria**: el proceso fija `APP_TIMEZONE` (por defecto `Europe/Madrid`) para que las horas de la agenda no dependan de dónde esté alojado el servidor.

## Despliegue y limitaciones conocidas

- Define `AUTH_SECRET` y `DATABASE_URL` reales, sirve la app tras HTTPS y haz copias de seguridad de la base de datos **y** de `UPLOAD_DIR`.
- Los documentos usan disco local por defecto (`STORAGE_DRIVER=local`, para un servidor propio con disco persistente) o almacenamiento compatible con S3 (`STORAGE_DRIVER=s3`, obligatorio en Netlify; ver [DEPLOY.md](DEPLOY.md)).
- El limitador de intentos de login vive en la base de datos (5 fallos por IP+correo y 15 por correo, cada 15 min; con `CLIENT_IP_HEADER` configurada, además 30 por IP entre todas las cuentas): sirve con varias instancias. Un atacante podría bloquear temporalmente a un usuario concreto con 15 intentos.
- Sin facturación electrónica oficial (Verifactu/FacturaE), ni suplidos, ni varios tipos de IVA por factura (ver «Facturación»).
- El PDF se genera en el servidor: en **Netlify** una respuesta de función no puede superar ~6 MB (una factura normal pesa unas decenas de KB, pero una con cientos de líneas puede acercarse); la exportación CSV se limita a 20.000 filas por la misma razón.
- Sin firma electrónica ni portal de clientes.

### Riesgos aceptados (revisados en la auditoría OWASP)

- **Sin verificación en dos pasos (2FA).** Mitigado con contraseñas de al menos 10 caracteres elegidas por cada persona, límites de intentos, sesiones de 12 h revocables y registro de seguridad. Recomendable añadirla para administradores en una fase futura.
- **`pdf-lib` sin versiones nuevas desde 2021.** Solo se usa para **generar** PDF con datos de la propia app (nunca para leer PDF de terceros), lo que deja poca superficie. Revisar si aparece una vulnerabilidad o si se amplía el uso de PDF.
- **CSP con estilos en línea permitidos** (`style-src 'unsafe-inline'`): los estilos no ejecutan código; los scripts sí van restringidos por *nonce*.
- **La página 404 de rutas inexistentes** es estática y no lleva *nonce*: no necesita JavaScript (sus enlaces funcionan igual).
