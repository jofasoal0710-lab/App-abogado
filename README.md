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
- **Recordatorios** (solo administradores): avisos por correo de plazos, audiencias y tareas (ver abajo).
- **Equipo** (solo administradores): altas, roles, tarifa horaria, desactivación y si recibe avisos por correo.

### Roles

| | Administrador | Abogado | Asistente |
|---|:-:|:-:|:-:|
| Clientes, expedientes, horas, agenda, documentos (subir) | ✓ | ✓ | ✓ |
| Eliminar clientes / documentos | ✓ | ✓ | – |
| Eliminar expedientes, gestionar equipo | ✓ | – | – |
| Emitir/anular facturas, borrar cobros | ✓ | ✓ | – |

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
- **Seguridad**: sesión JWT firmada en cookie `httpOnly`; `proxy.ts` hace el filtrado optimista y **cada página y Server Action vuelve a comprobar usuario y rol**; contraseñas con bcrypt; limitador de intentos de login; redirecciones solo a rutas internas; documentos fuera de `public/`, con nombre aleatorio, MIME deducido de la extensión y servidos como descarga con `nosniff`.
- **Zona horaria**: el proceso fija `APP_TIMEZONE` (por defecto `Europe/Madrid`) para que las horas de la agenda no dependan de dónde esté alojado el servidor.

## Despliegue y limitaciones conocidas

- Define `AUTH_SECRET` y `DATABASE_URL` reales, sirve la app tras HTTPS y haz copias de seguridad de la base de datos **y** de `UPLOAD_DIR`.
- Los documentos se guardan en disco local; con varias réplicas hay que pasar a almacenamiento compartido (S3 o similar).
- El limitador de intentos de login es en memoria (una sola instancia).
- Todos los usuarios ven todos los expedientes (sin confidencialidad por expediente / "muralla china").
- Sin retención IRPF, facturas rectificativas ni facturación electrónica oficial (Verifactu/FacturaE).
- Sin firma electrónica ni portal de clientes.
