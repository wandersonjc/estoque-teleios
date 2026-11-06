import {
  enviarRelatorioErro,
  type RelatorioErro,
} from "@/lib/envio-relatorio-erro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const LIMITE_BYTES = 50_000;
const MAXIMO_RELATORIOS_POR_JANELA = 5;
const JANELA_MS = 15 * 60 * 1000;
const enviosPorOrigem = new Map<string, number[]>();

function respostaJson(dados: unknown, status = 200) {
  return Response.json(dados, { status, headers: CABECALHOS_PRIVADOS });
}

function mesmaOrigem(request: Request): boolean {
  const origem = request.headers.get("origin");
  if (!origem) return false;

  try {
    return new URL(origem).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function permitirEnvio(request: Request): boolean {
  const agora = Date.now();
  for (const [chave, horarios] of enviosPorOrigem) {
    const recentes = horarios.filter((horario) => agora - horario < JANELA_MS);
    if (recentes.length === 0) enviosPorOrigem.delete(chave);
    else enviosPorOrigem.set(chave, recentes);
  }

  const origem = request.headers.get("origin") ?? "sem-origem";
  const encaminhados = request.headers.get("x-forwarded-for");
  const ip = encaminhados?.split(",")[0]?.trim() || "local";
  const chave = `${origem}:${ip}`;
  const recentes = enviosPorOrigem.get(chave) ?? [];
  if (recentes.length >= MAXIMO_RELATORIOS_POR_JANELA) {
    enviosPorOrigem.set(chave, recentes);
    return false;
  }
  if (!enviosPorOrigem.has(chave) && enviosPorOrigem.size >= 5000) return false;

  recentes.push(agora);
  enviosPorOrigem.set(chave, recentes);
  return true;
}

async function lerCorpoLimitado(request: Request): Promise<string | null> {
  const leitor = request.body?.getReader();
  if (!leitor) return "";

  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_BYTES) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }

  const corpo = new Uint8Array(total);
  let deslocamento = 0;
  for (const parte of partes) {
    corpo.set(parte, deslocamento);
    deslocamento += parte.byteLength;
  }
  return new TextDecoder().decode(corpo);
}

function validarRelatorio(dados: unknown): dados is RelatorioErro {
  if (typeof dados !== "object" || dados === null || Array.isArray(dados)) {
    return false;
  }

  const relatorio = dados as Partial<RelatorioErro>;
  return (
    typeof relatorio.id === "string" &&
    /^[0-9a-f-]{36}$/i.test(relatorio.id) &&
    typeof relatorio.nome === "string" &&
    typeof relatorio.mensagem === "string" &&
    typeof relatorio.pilha === "string" &&
    typeof relatorio.digest === "string" &&
    typeof relatorio.caminho === "string" &&
    typeof relatorio.ocorridoEm === "string" &&
    typeof relatorio.navegador === "string" &&
    relatorio.nome.length <= 300 &&
    relatorio.mensagem.length <= 10_000 &&
    relatorio.pilha.length <= 30_000 &&
    relatorio.digest.length <= 300 &&
    relatorio.caminho.length <= 2000 &&
    relatorio.navegador.length <= 2000
  );
}

export async function POST(request: Request) {
  if (!mesmaOrigem(request)) {
    return respostaJson({ erro: "Solicitação não permitida." }, 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return respostaJson({ erro: "Tipo de conteúdo inválido." }, 415);
  }

  if (!permitirEnvio(request)) {
    return respostaJson(
      { erro: "Limite de envio atingido. Tente novamente mais tarde." },
      429
    );
  }

  const tamanhoDeclarado = Number(request.headers.get("content-length") ?? 0);
  if (tamanhoDeclarado > LIMITE_BYTES) {
    return respostaJson({ erro: "Relatório muito grande." }, 413);
  }

  let corpo: unknown;
  try {
    const textoCorpo = await lerCorpoLimitado(request);
    if (textoCorpo === null) {
      return respostaJson({ erro: "Relatório muito grande." }, 413);
    }
    corpo = JSON.parse(textoCorpo);
  } catch {
    return respostaJson({ erro: "Relatório inválido." }, 400);
  }

  if (!validarRelatorio(corpo)) {
    return respostaJson({ erro: "Relatório inválido." }, 400);
  }

  try {
    await enviarRelatorioErro(corpo);
    return respostaJson({ enviado: true });
  } catch (erro) {
    console.error("Não foi possível enviar o relatório de erro à Brevo:", erro);
    return respostaJson(
      {
        enviado: false,
        erro: "Não foi possível avisar o suporte automaticamente.",
      },
      503
    );
  }
}
