# FarmaTuc — Contexto del Proyecto

## Qué es

Sistema de Punto de Venta (POS) y Gestión de Inventario para Farmacia, con trazabilidad completa de lotes/vencimientos y aplicación de coberturas médicas (obras sociales).

## Stack

| Capa | Tecnología |
|------|-----------|
| Monorepo | pnpm workspaces |
| API | Node.js, Express, Prisma ORM, PostgreSQL 16 |
| Frontend | React 19, Vite 6, TailwindCSS 3, React Router 7 |
| Tipos compartidos | `/packages/types` (TypeScript estricto) |
| Containerización | Docker Compose (on-premise, HA) |
| Lenguaje | TypeScript 5.7+ en todo el stack |

## Arquitectura

```
farmatuc-mono/
├── apps/
│   ├── api/            # Backend — Express + Prisma
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Materialización de tipos en DB
│   │   └── src/
│   └── web/            # Frontend — React + Vite + Nginx
│       ├── nginx.conf
│       └── src/
├── packages/
│   └── types/          # Tipos compartidos (CONTRATO de datos)
│       └── src/index.ts
├── docker-compose.yml  # Orquestación completa
└── .env.example        # Variables de entorno
```

## Dominio del Negocio

### Modelo de datos clave

1. **Medicamento** — Producto genérico (nombre, principio activo/monodroga, concentración, código de barras)
2. **Lote** — Ingreso específico de un medicamento (número de lote, vencimiento, stock独立, proveedor)
3. **Obra Social** — Cobertura médica (% de descuento, tope, restricciones)
4. **Paciente** — Cliente con opcional obra social y número de afiliado
5. **Venta** — Transacción consolidada con trazabilidad FIFO
6. **DetalleVenta** — Línea de venta con referencia al lote específico used
7. **AlertaInventario** — Notificaciones automáticas (stock bajo, vencimientos)

### Regla crítica: FIFO (First-In, First-Out)

Al registrar una venta:
1. Buscar lotes disponibles ordenados por `fechaVencimiento` ASC
2. Descontar del lote más viejo primero
3. Si un lote no alcanza, continuar con el siguiente
4. Crear un `DetalleVenta` por cada lote utilizado
5. Nunca modificar una venta creada (impermutabilidad)

### Trazabilidad

Cada línea de venta (`DetalleVenta`) referencia el lote exacto del que se descontó stock. Esto permite:
- Recall de lotes específicos
- Auditoría completa de movimientos
- Historial de vencimientos vendidos

## Docker Compose

```bash
# Copiar .env.example a .env y configurar
cp .env.example .env

# Levantar todo
docker compose up -d

# Servicios:
# - db:      PostgreSQL 16 (puerto 5432)
# - api:     Express + Prisma (puerto 3000)
# - web:     Nginx sirviendo frontend (puerto 80)
```

## Próximos pasos

1. [x] Inicializar dependencies (`pnpm install`)
2. [x] Generar cliente Prisma (`pnpm --filter @farmatuc/api db:generate`)
3. [x] Migraciones y seed (`pnpm --filter @farmatuc/api db:migrate` + `db:seed`) — migración `init` aplicada sobre PostgreSQL 18 local (sin Docker): `db:generate` + `prisma migrate dev --name init` + `tsx prisma/seed.ts` (8 medicamentos, 10 lotes, 3 OS, 4 pacientes, 2 usuarios sistema+admin, 6 alertas); verificado en runtime con smoke test end-to-end; la API corre en el puerto **4310** (3000 está reservado para otros servicios del equipo)
4. [x] Endpoint de autenticación JWT — `POST /api/auth/login` (200 { token, usuario }), `POST /api/auth/registrar` (201, solo admin, usa `requireAuth` + `requireRol("admin")`); middleware `requireAuth` (Bearer token, verifica firma+expiración, usuario activo, inyecta `req.userId/userRol/userNombre`) y factory `requireRol(...roles)` (403); servicio `auth.service.ts` con login genérico (email/contraseña → 401 "Email o contraseña incorrectos", inactivo → 403 "Usuario deshabilitado") y registrarUsuario (email único → 409, hash bcrypt salt 10, no expone passwordHash); rutas protegidas: `/api/ventas` todas requireAuth, `/api/medicamentos` y `/api/lotes` GET requireAuth y POST/PUT/DELETE requireAuth + requireRol("admin","farmaceutico","deposito"); `/api/health` y `/api/auth/login` públicas; en POST /api/ventas la prioridad de usuario es body.usuarioId → req.userId (token) → fallback de sistema; config JWT_SECRET (requerido en producción) + JWT_EXPIRES_IN (default "8h"); seed con passwordHash reales y admin demo `admin@farmatuc.local` / `admin123` (usuario de sistema: `sistema@farmatuc.local` / `sistema`); tests con vitest (27 en total)
5. [x] CRUD de Medicamentos con búsqueda por principio activo — `GET/POST/PUT/DELETE /api/medicamentos`, `?q=` busca principioActivo (primario), nombreComercial y codigoBarras; soft delete (`activo=false`); validación zod
6. [x] Ingesta de lotes con validación de vencimiento — `GET/POST/PUT/DELETE /api/lotes`; vencimiento debe ser hoy/futuro, fabricación ≤ vencimiento, duplicado `(medicamentoId, numeroLote)` → 409, `stockInicial` = `stock` al crear, estado derivado (agotado/vencido/disponible), DELETE marca `retirado` (nunca borra), filtros `medicamentoId`/`estado`/`fechaVencimientoLte`, seed con 10 lotes (1 vencido, 1 agotado)
7. [x] Servicio de venta con lógica FIFO — `POST /api/ventas` registra venta atómica descontando stock riesgo-consistente (`updateMany` condicional), un `DetalleVenta` por lote usado (vencimiento ASC), excluye vencidos, `VTA-YYYY-NNNNNN`, montos `Decimal`, stock insuficiente → 409, ventas impermutables (solo GET); `GET /api/ventas` paginado con filtro `desde`/`hasta`, `GET /api/ventas/:id`; seed crea usuario de sistema (placeholder hasta auth JWT); cobertura de obra social aún en 0 (paso 8); tests con vitest
8. [x] Cálculo de cobertura por obra social — resolución: override `obraSocialId` en body > `paciente.obraSocialId`; gates: OS activa, `requiereAfiliado` exige `numeroAfiliado` del paciente; por detalle: `cobertura = subtotal × % / 100` (HALF_UP 2 decimales), tope `topeMaximoPorMedicamento`, restricción por `categoriasCubiertas`; invariante contable `subtotal = totalCobertura + totalCopago` (sin cobertura el paciente paga el subtotal completo); `totalFinal = subtotal - totalCobertura`; seed con 3 OS (simple 40%, con tope 80%/$3000, categorías 60% solo Antibióticos) y 4 pacientes (con/sin afiliado, categorías, sin OS)
9. [x] Dashboard de alertas (stock bajo, vencimientos 30/60/90 días) — `POST /api/alertas/generar` recalcula alertas desde el estado actual: `stock_bajo` (warning, stock total vigente < stockMinimo), `medicamento_sin_stock` (critical), `vencimiento_proximo_30/60/90` (critical/warning/info, rangos por días hasta vencimiento), `lote_vencido` (critical); deduplicación por clave `(tipo, medicamentoId, loteId)` — solo crea las que faltan, y cuando un lote evoluciona de un rango a otro más cercano cierra (ack automático) la alerta anterior; `GET /api/alertas` paginado con filtros tipo/severidad/acknowledged, `GET /api/alertas/resumen` (counts por tipo/severidad + sinAcknowledged), `POST /api/alertas/ack` (marca ids, requiere admin/farmaceutico); `generar` y `ack` requieren rol admin/farmaceutico, lectura cualquier rol autenticado; seed genera alertas iniciales
10. [ ] POS Frontend — interfaz de caja
11. [ ] Backoffice — panel de administración

## Decisiones de diseño

- **Separación Medicamento vs Lote**: Un medicamento es el producto permanente; un lote es un ingreso específico con stock independiente. Esta separación es la base de la trazabilidad.
- **Cada DetalleVenta referencia un Lote**: Permite saber exactamente de qué lote vino cada producto vendido.
- **Ventas impermutables**: Nunca se modifica una venta creada. Los ajustes se hacen con notas de crédito.
- **Decimal(10,2) en Prisma**: Precisos para manejar pesos con 2 decimales sin errores de punto flotante.
- **UUIDs como IDs**: Mejor para distribución y merge de datos en futuras réplicas.
