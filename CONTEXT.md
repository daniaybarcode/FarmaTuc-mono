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

1. [ ] Inicializar dependencies (`pnpm install`)
2. [ ] Generar cliente Prisma (`pnpm --filter @farmatuc/api db:generate`)
3. [ ] Crear migraciones (`pnpm --filter @farmatuc/api db:migrate`)
4. [ ] Endpoint de autenticación (JWT)
5. [ ] CRUD de Medicamentos con búsqueda por principio activo
6. [ ] Ingesta de lotes con validación de vencimiento
7. [ ] Servicio de venta con lógica FIFO
8. [ ] Cálculo de cobertura por obra social
9. [ ] Dashboard de alertas (stock bajo, vencimientos 30/60/90 días)
10. [ ] POS Frontend — interfaz de caja
11. [ ] Backoffice — panel de administración

## Decisiones de diseño

- **Separación Medicamento vs Lote**: Un medicamento es el producto permanente; un lote es un ingreso específico con stock independiente. Esta separación es la base de la trazabilidad.
- **Cada DetalleVenta referencia un Lote**: Permite saber exactamente de qué lote vino cada producto vendido.
- **Ventas impermutables**: Nunca se modifica una venta creada. Los ajustes se hacen con notas de crédito.
- **Decimal(10,2) en Prisma**: Precisos para manejar pesos con 2 decimales sin errores de punto flotante.
- **UUIDs como IDs**: Mejor para distribución y merge de datos en futuras réplicas.
