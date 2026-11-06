const DESTINATARIO_SUPORTE = "wandersonjc@gmail.com";
const TAMANHO_MAXIMO_CAMPO = 20_000;

export type RelatorioErro = {
  id: string;
  nome: string;
  mensagem: string;
  pilha: string;
  digest: string;
  caminho: string;
  ocorridoEm: string;
  navegador: string;
};

function textoSanitizado(valor: string, limite = TAMANHO_MAXIMO_CAMPO): string {
  return valor
    .slice(0, limite)
    .replace(
      /((?:password|passwd|secret|token|api[_-]?key|authorization|cookie|database[_-]?(?:url|ca)|private[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[REDACTED]"
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/:\/\/[^/@\s]+:[^/@\s]+@/g, "://[REDACTED]@")
    .replace(/\b[a-f0-9]{64}\b/gi, "[REDACTED]");
}

function construirConteudoRelatorio(relatorio: RelatorioErro): string {
  const dados = [
    ["ID do relatório", relatorio.id],
    ["Data/hora UTC", relatorio.ocorridoEm],
    ["Ambiente", process.env.NODE_ENV ?? "desconhecido"],
    ["Caminho", textoSanitizado(relatorio.caminho, 500)],
    ["Navegador", textoSanitizado(relatorio.navegador, 1000)],
    ["Nome do erro", textoSanitizado(relatorio.nome, 300)],
    ["Digest Next.js", textoSanitizado(relatorio.digest, 300)],
    ["Mensagem", textoSanitizado(relatorio.mensagem, 3000)],
  ];

  return [
    "Relatório automático de erro do Átria",
    "",
    ...dados.map(([rotulo, valor]) => `${rotulo}: ${valor || "não informado"}`),
    "",
    "Pilha técnica:",
    textoSanitizado(relatorio.pilha),
    "",
    "Nota: detalhes potencialmente sensíveis foram removidos automaticamente.",
  ].join("\n");
}

export async function enviarRelatorioErro(
  relatorio: RelatorioErro
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const emailRemetente = process.env.BREVO_SENDER_EMAIL;
  const nomeRemetente = process.env.BREVO_SENDER_NAME?.trim() || "Átria";

  if (!apiKey || !emailRemetente) {
    throw new Error(
      "BREVO_API_KEY e BREVO_SENDER_EMAIL precisam estar configurados."
    );
  }

  const conteudo = construirConteudoRelatorio(relatorio);
  const resposta = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: emailRemetente, name: nomeRemetente },
      to: [{ email: DESTINATARIO_SUPORTE }],
      subject: `[Átria] Erro inesperado ${relatorio.id}`,
      textContent:
        "Ocorreu um erro inesperado no Átria. O relatório técnico sanitizado está anexado.",
      attachment: [
        {
          name: `relatorio-erro-${relatorio.id}.txt`,
          content: Buffer.from(conteudo, "utf8").toString("base64"),
        },
      ],
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!resposta.ok) {
    console.error("Brevo recusou o envio do relatório de erro:", resposta.status);
    throw new Error("Brevo não aceitou o relatório de erro.");
  }
}
