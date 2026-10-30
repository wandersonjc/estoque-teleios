// ============================================================
// Cliente Prisma global (Prisma 7 + PostgreSQL da Aiven)
// Use sempre este arquivo para acessar o banco:
//   import prisma from "@/lib/prisma";
// ============================================================

import { PrismaClient } from "../generated/prisma/client"; // atenção: termina em /client
import { PrismaPg } from "@prisma/adapter-pg";

const urlOriginal = process.env.DATABASE_URL;
if (!urlOriginal) {
  throw new Error("DATABASE_URL não definida. Verifique o arquivo .env.");
}

// Certificado (CA) da Aiven. A Aiven usa uma autoridade certificadora
// própria, então o driver precisa dele para confiar no servidor.
// Em hospedagens que não aceitam texto com várias linhas na variável,
// trocamos o "\n" escrito por quebras de linha de verdade.
const ca = process.env.DATABASE_CA?.replace(/\\n/g, "\n");
if (!ca) {
  throw new Error(
    "DATABASE_CA não definida. Cole o certificado CA da Aiven no arquivo .env."
  );
}

// Removemos o "?sslmode=require" da URL só aqui no driver: se ele ficar,
// o driver ignora a configuração de SSL abaixo (e a verificação falha).
// A URL completa continua no .env para a ferramenta de linha de comando
// do Prisma (prisma db push), que lê o prisma.config.ts.
const connectionString = urlOriginal.split("?")[0];

const adapter = new PrismaPg({
  connectionString,
  ssl: { ca },
  // Poucas conexões por instância: em hospedagem serverless (Vercel)
  // cada função abre as suas, e o plano da Aiven tem limite de conexões.
  max: 5,
});

// Guarda a instância em "global" no ambiente de desenvolvimento para o
// hot reload do Next.js não abrir uma conexão nova a cada alteração.
// A "versao" força a recriação quando o schema do Prisma muda (ex.:
// tabela historico_preco), porque o hot reload sozinho reusa o cliente velho.
const VERSAO_DO_CLIENTE_PRISMA = 2;
const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  prismaVersao?: number;
};

const prisma =
  globalForPrisma.prisma &&
  globalForPrisma.prismaVersao === VERSAO_DO_CLIENTE_PRISMA
    ? globalForPrisma.prisma
    : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaVersao = VERSAO_DO_CLIENTE_PRISMA;
}

export default prisma;
