import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { TAMANHO_MAXIMO_IMAGEM } from "@/lib/constantes-imagens";

export { TAMANHO_MAXIMO_IMAGEM } from "@/lib/constantes-imagens";

export type CategoriaImagem = "produtos" | "fornecedores" | "usuarios";

export type ImagemPreparada = {
  conteudo: Buffer;
  tipoConteudo: "image/jpeg" | "image/png" | "image/webp";
  extensao: "jpg" | "png" | "webp";
};

type ResultadoPreparacao =
  | { ok: true; imagem: ImagemPreparada | null }
  | { ok: false; erro: string };

let clienteR2: S3Client | undefined;

function obterConfiguracaoR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("As variáveis do armazenamento R2 não estão configuradas.");
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function obterClienteR2(): { cliente: S3Client; bucket: string } {
  const configuracao = obterConfiguracaoR2();
  clienteR2 ??= new S3Client({
    region: "auto",
    endpoint: configuracao.endpoint,
    credentials: {
      accessKeyId: configuracao.accessKeyId,
      secretAccessKey: configuracao.secretAccessKey,
    },
  });

  return { cliente: clienteR2, bucket: configuracao.bucket };
}

function identificarFormato(conteudo: Buffer): ImagemPreparada["tipoConteudo"] | null {
  if (
    conteudo.length >= 3 &&
    conteudo[0] === 0xff &&
    conteudo[1] === 0xd8 &&
    conteudo[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    conteudo.length >= 8 &&
    conteudo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }

  if (
    conteudo.length >= 12 &&
    conteudo.toString("ascii", 0, 4) === "RIFF" &&
    conteudo.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export async function prepararImagem(
  valor: FormDataEntryValue | null
): Promise<ResultadoPreparacao> {
  if (valor === null) return { ok: true, imagem: null };
  if (!(valor instanceof File)) {
    return { ok: false, erro: "O arquivo enviado não é uma imagem válida." };
  }
  if (valor.size === 0) return { ok: true, imagem: null };
  if (valor.size > TAMANHO_MAXIMO_IMAGEM) {
    return { ok: false, erro: "A imagem deve ter no máximo 5 MB." };
  }

  const conteudo = Buffer.from(await valor.arrayBuffer());
  const tipoConteudo = identificarFormato(conteudo);
  if (!tipoConteudo || (valor.type && valor.type !== tipoConteudo)) {
    return {
      ok: false,
      erro: "Use uma imagem JPEG, PNG ou WebP válida.",
    };
  }

  const extensao =
    tipoConteudo === "image/jpeg"
      ? "jpg"
      : tipoConteudo === "image/png"
        ? "png"
        : "webp";

  return { ok: true, imagem: { conteudo, tipoConteudo, extensao } };
}

export async function armazenarImagem(
  imagem: ImagemPreparada,
  categoria: CategoriaImagem
): Promise<string> {
  const { cliente, bucket } = obterClienteR2();
  const chave = `${categoria}/${randomUUID()}.${imagem.extensao}`;

  await cliente.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: chave,
      Body: imagem.conteudo,
      ContentType: imagem.tipoConteudo,
    })
  );

  return chave;
}

export async function buscarImagem(chave: string) {
  const { cliente, bucket } = obterClienteR2();
  return cliente.send(new GetObjectCommand({ Bucket: bucket, Key: chave }));
}

export async function excluirImagem(chave: string): Promise<void> {
  const { cliente, bucket } = obterClienteR2();
  await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: chave }));
}

export async function excluirImagemSemFalhar(
  chave: string | null | undefined
): Promise<void> {
  if (!chave) return;

  try {
    await excluirImagem(chave);
  } catch (erro) {
    console.error("Falha ao remover imagem antiga do R2:", erro);
  }
}