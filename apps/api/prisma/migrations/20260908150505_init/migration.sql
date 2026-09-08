-- CreateEnum
CREATE TYPE "FormaFarmaceutica" AS ENUM ('comprimido', 'capsula', 'jarabe', 'suspension_oral', 'crema', 'pomada', 'gel', 'supositorio', 'ampolla', 'spray', 'colirio', 'gotas', 'polvo', 'inhador', 'parche', 'otro');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('disponible', 'reservado', 'vencido', 'agotado', 'retirado');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('dni', 'cedula', 'pasaporte', 'libreta_civica');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('admin', 'farmaceutico', 'cajero', 'deposito', 'consulta');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('pendiente', 'completada', 'cancelada', 'nota_credito');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo', 'debito', 'credito', 'transferencia', 'mixto');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('stock_bajo', 'stock_critico', 'vencimiento_proximo_30', 'vencimiento_proximo_60', 'vencimiento_proximo_90', 'lote_vencido', 'medicamento_sin_stock');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('info', 'warning', 'critical');

-- CreateTable
CREATE TABLE "medicamentos" (
    "id" UUID NOT NULL,
    "nombre_comercial" TEXT NOT NULL,
    "principio_activo" TEXT NOT NULL,
    "concentracion" TEXT NOT NULL,
    "forma_farmaceutica" "FormaFarmaceutica" NOT NULL,
    "laboratorio" TEXT NOT NULL,
    "codigo_barras" TEXT,
    "codigo_anmat" TEXT,
    "requiere_receta" BOOLEAN NOT NULL DEFAULT false,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "categoria_terapeutica" TEXT NOT NULL,
    "stock_minimo" INTEGER NOT NULL DEFAULT 5,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "medicamento_id" UUID NOT NULL,
    "numero_lote" TEXT NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "fecha_fabricacion" TIMESTAMP(3) NOT NULL,
    "stock" INTEGER NOT NULL,
    "stock_inicial" INTEGER NOT NULL,
    "precio_compra" DECIMAL(10,2) NOT NULL,
    "proveedor" TEXT NOT NULL,
    "numero_factura" TEXT,
    "estado" "EstadoLote" NOT NULL DEFAULT 'disponible',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obras_sociales" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "sigla" TEXT,
    "porcentaje_cobertura" DECIMAL(5,2) NOT NULL,
    "tiene_tope" BOOLEAN NOT NULL DEFAULT false,
    "tope_maximo_por_medicamento" DECIMAL(10,2),
    "restriccion_por_categoria" BOOLEAN NOT NULL DEFAULT false,
    "categorias_cubiertas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiere_afiliado" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obras_sociales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'dni',
    "fecha_nacimiento" TIMESTAMP(3),
    "telefono" TEXT,
    "email" TEXT,
    "obra_social_id" UUID,
    "numero_afiliado" TEXT,
    "observaciones_clinicas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" UUID NOT NULL,
    "numero_venta" TEXT NOT NULL,
    "paciente_id" UUID,
    "obra_social_id" UUID,
    "usuario_id" UUID NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'completada',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total_descuentos" DECIMAL(10,2) NOT NULL,
    "total_cobertura" DECIMAL(10,2) NOT NULL,
    "total_copago" DECIMAL(10,2) NOT NULL,
    "total_final" DECIMAL(10,2) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_venta" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "medicamento_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento_obra_social" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monto_cobertura" DECIMAL(10,2) NOT NULL,
    "monto_copago" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detalles_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_inventario" (
    "id" UUID NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "medicamento_id" UUID NOT NULL,
    "lote_id" UUID,
    "mensaje" TEXT NOT NULL,
    "severidad" "Severidad" NOT NULL DEFAULT 'info',
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medicamentos_codigo_barras_key" ON "medicamentos"("codigo_barras");

-- CreateIndex
CREATE UNIQUE INDEX "medicamentos_codigo_anmat_key" ON "medicamentos"("codigo_anmat");

-- CreateIndex
CREATE INDEX "medicamentos_principio_activo_idx" ON "medicamentos"("principio_activo");

-- CreateIndex
CREATE INDEX "medicamentos_categoria_terapeutica_idx" ON "medicamentos"("categoria_terapeutica");

-- CreateIndex
CREATE INDEX "medicamentos_activo_idx" ON "medicamentos"("activo");

-- CreateIndex
CREATE INDEX "lotes_medicamento_id_idx" ON "lotes"("medicamento_id");

-- CreateIndex
CREATE INDEX "lotes_fecha_vencimiento_idx" ON "lotes"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "lotes_estado_idx" ON "lotes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_medicamento_id_numero_lote_key" ON "lotes"("medicamento_id", "numero_lote");

-- CreateIndex
CREATE UNIQUE INDEX "obras_sociales_nombre_key" ON "obras_sociales"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_documento_key" ON "pacientes"("documento");

-- CreateIndex
CREATE INDEX "pacientes_documento_idx" ON "pacientes"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_numero_venta_key" ON "ventas"("numero_venta");

-- CreateIndex
CREATE INDEX "ventas_numero_venta_idx" ON "ventas"("numero_venta");

-- CreateIndex
CREATE INDEX "ventas_created_at_idx" ON "ventas"("created_at");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "detalles_venta_venta_id_idx" ON "detalles_venta"("venta_id");

-- CreateIndex
CREATE INDEX "detalles_venta_lote_id_idx" ON "detalles_venta"("lote_id");

-- CreateIndex
CREATE INDEX "alertas_inventario_tipo_idx" ON "alertas_inventario"("tipo");

-- CreateIndex
CREATE INDEX "alertas_inventario_acknowledged_idx" ON "alertas_inventario"("acknowledged");

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_obra_social_id_fkey" FOREIGN KEY ("obra_social_id") REFERENCES "obras_sociales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_obra_social_id_fkey" FOREIGN KEY ("obra_social_id") REFERENCES "obras_sociales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_inventario" ADD CONSTRAINT "alertas_inventario_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_inventario" ADD CONSTRAINT "alertas_inventario_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_inventario" ADD CONSTRAINT "alertas_inventario_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
