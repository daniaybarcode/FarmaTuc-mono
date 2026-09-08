import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  await prisma.lote.deleteMany();
  await prisma.medicamento.deleteMany();

  const medicamentos = [
    {
      nombreComercial: "Ibuprofeno 600mg Genfar",
      principioActivo: "Ibuprofeno",
      concentracion: "600mg",
      formaFarmaceutica: "comprimido" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567890",
      requiereReceta: false,
      precioUnitario: 1500.0,
      activo: true,
      categoriaTerapeutica: "Analgesicos",
      stockMinimo: 10,
    },
    {
      nombreComercial: "Amoxicilina 500mg Genfar",
      principioActivo: "Amoxicilina",
      concentracion: "500mg",
      formaFarmaceutica: "capsula" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567891",
      requiereReceta: true,
      precioUnitario: 2800.0,
      activo: true,
      categoriaTerapeutica: "Antibioticos",
      stockMinimo: 8,
    },
    {
      nombreComercial: "Paracetamol 500mg Genfar",
      principioActivo: "Paracetamol",
      concentracion: "500mg",
      formaFarmaceutica: "comprimido" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567892",
      requiereReceta: false,
      precioUnitario: 800.0,
      activo: true,
      categoriaTerapeutica: "Analgesicos",
      stockMinimo: 15,
    },
    {
      nombreComercial: "Losartan 50mg Genfar",
      principioActivo: "Losartan",
      concentracion: "50mg",
      formaFarmaceutica: "comprimido" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567893",
      requiereReceta: true,
      precioUnitario: 1200.0,
      activo: true,
      categoriaTerapeutica: "Cardiovasculares",
      stockMinimo: 10,
    },
    {
      nombreComercial: "Amlodipina 5mg Genfar",
      principioActivo: "Amlodipina",
      concentracion: "5mg",
      formaFarmaceutica: "comprimido" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567894",
      requiereReceta: true,
      precioUnitario: 950.0,
      activo: true,
      categoriaTerapeutica: "Cardiovasculares",
      stockMinimo: 10,
    },
    {
      nombreComercial: "Omeprazol 20mg Genfar",
      principioActivo: "Omeprazol",
      concentracion: "20mg",
      formaFarmaceutica: "capsula" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567895",
      requiereReceta: false,
      precioUnitario: 1100.0,
      activo: true,
      categoriaTerapeutica: "Gastrointestinal",
      stockMinimo: 12,
    },
    {
      nombreComercial: "Salbutamol 100mcg spray GSK",
      principioActivo: "Salbutamol",
      concentracion: "100mcg/dosis",
      formaFarmaceutica: "spray" as const,
      laboratorio: "GSK",
      codigoBarras: "7791234567896",
      requiereReceta: true,
      precioUnitario: 3500.0,
      activo: true,
      categoriaTerapeutica: "Respiratorio",
      stockMinimo: 5,
    },
    {
      nombreComercial: "Diclofenac 1% gel Genfar",
      principioActivo: "Diclofenac",
      concentracion: "1%",
      formaFarmaceutica: "gel" as const,
      laboratorio: "Genfar",
      codigoBarras: "7791234567897",
      requiereReceta: false,
      precioUnitario: 1800.0,
      activo: true,
      categoriaTerapeutica: "Antiinflamatorios",
      stockMinimo: 8,
    },
  ];

  const medicamentoIdPorActivo = new Map<string, string>();

  for (const m of medicamentos) {
    const medicamento = await prisma.medicamento.create({ data: m });
    medicamentoIdPorActivo.set(m.principioActivo, medicamento.id);
  }

  const fechaBase = new Date();

  type LoteSeed = {
    principioActivo: string;
    numeroLote: string;
    vencimiento: Date;
    stock: number;
    precioCompra: number;
    proveedor: string;
    numeroFactura: string | null;
    estado: "disponible" | "vencido" | "agotado";
  };

  const lotesSeed: LoteSeed[] = [
    {
      principioActivo: "Ibuprofeno",
      numeroLote: "IBU-2601",
      vencimiento: addMonths(fechaBase, 3),
      stock: 120,
      precioCompra: 900.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2026-001",
      estado: "disponible",
    },
    {
      principioActivo: "Ibuprofeno",
      numeroLote: "IBU-2602",
      vencimiento: addMonths(fechaBase, 11),
      stock: 60,
      precioCompra: 910.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2026-002",
      estado: "disponible",
    },
    {
      principioActivo: "Amoxicilina",
      numeroLote: "AMX-2601",
      vencimiento: addMonths(fechaBase, 4),
      stock: 90,
      precioCompra: 1800.0,
      proveedor: "Farmacity Mayorista",
      numeroFactura: "FAC-2026-003",
      estado: "disponible",
    },
    {
      principioActivo: "Amoxicilina",
      numeroLote: "AMX-2602",
      vencimiento: addMonths(fechaBase, 12),
      stock: 50,
      precioCompra: 1750.0,
      proveedor: "Farmacity Mayorista",
      numeroFactura: "FAC-2026-004",
      estado: "disponible",
    },
    {
      principioActivo: "Paracetamol",
      numeroLote: "PRC-2601",
      vencimiento: addMonths(fechaBase, 5),
      stock: 200,
      precioCompra: 500.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2026-005",
      estado: "disponible",
    },
    {
      principioActivo: "Paracetamol",
      numeroLote: "PRC-2602",
      vencimiento: addMonths(fechaBase, 10),
      stock: 150,
      precioCompra: 510.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2026-006",
      estado: "disponible",
    },
    {
      principioActivo: "Losartan",
      numeroLote: "LST-2601",
      vencimiento: addMonths(fechaBase, 2),
      stock: 40,
      precioCompra: 800.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2026-007",
      estado: "disponible",
    },
    {
      principioActivo: "Losartan",
      numeroLote: "LST-2602",
      vencimiento: addMonths(fechaBase, 9),
      stock: 30,
      precioCompra: 790.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2026-008",
      estado: "disponible",
    },
    {
      principioActivo: "Omeprazol",
      numeroLote: "OMP-2501",
      vencimiento: addMonths(fechaBase, -1),
      stock: 15,
      precioCompra: 650.0,
      proveedor: "Drogueria del Centro",
      numeroFactura: "FAC-2025-099",
      estado: "vencido",
    },
    {
      principioActivo: "Salbutamol",
      numeroLote: "SLB-2502",
      vencimiento: addMonths(fechaBase, 6),
      stock: 0,
      precioCompra: 2200.0,
      proveedor: "GSK Directo",
      numeroFactura: "FAC-2026-009",
      estado: "agotado",
    },
  ];

  let lotesCreados = 0;

  for (const lote of lotesSeed) {
    const medicamentoId = medicamentoIdPorActivo.get(lote.principioActivo);

    if (!medicamentoId) {
      throw new Error(
        `Medicamento no encontrado para seed de lotes: ${lote.principioActivo}`,
      );
    }

    await prisma.lote.create({
      data: {
        medicamentoId,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.vencimiento,
        fechaFabricacion: addMonths(lote.vencimiento, -6),
        stock: lote.stock,
        stockInicial: lote.stock,
        precioCompra: lote.precioCompra,
        proveedor: lote.proveedor,
        numeroFactura: lote.numeroFactura,
        estado: lote.estado,
      },
    });

    lotesCreados++;
  }

  console.log(
    `Seed completado: ${medicamentos.length} medicamentos y ${lotesCreados} lotes creados`,
  );
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
