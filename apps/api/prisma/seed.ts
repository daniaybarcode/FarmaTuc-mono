import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  for (const m of medicamentos) {
    await prisma.medicamento.create({ data: m });
  }

  console.log(`Seed completado: ${medicamentos.length} medicamentos creados`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
