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
- **Equipo** (solo administradores): altas, roles, tarifa horaria, desactivación.

### Roles

| | Administrador | Abogado | Asistente |
|---|:-:|:-:|:-:|
| Clientes, expedientes, horas, agenda, documentos (subir) | ✓ | ✓ | ✓ |
| Eliminar clientes / documentos | ✓ | ✓ | – |
| Eliminar expedientes, gestionar equipo | ✓ | – | – |
| Emitir/anular facturas, borrar cobros | ✓ | ✓ | – |

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
- Sin recordatorios por correo, firma electrónica, ni portal de clientes.
