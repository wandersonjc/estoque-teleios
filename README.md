This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Atualização do banco

Depois de alterar `prisma/schema.prisma`, aplique o schema e gere o cliente Prisma:

```bash
npx prisma db push
npx prisma generate
```

Para migrar códigos de barras legados para embalagens, execute também:

```bash
npm run db:migrar-embalagens
```

O comando é idempotente e preserva cada código antigo como embalagem principal, na unidade-base já cadastrada.

## Login com Google (OAuth)

O login com Google autentica somente usuários já cadastrados e ativos no Átria,
associados pelo endereço de e-mail verificado. O fluxo não cria usuários nem
altera ou concede permissões.

### Criar credenciais no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie ou
   selecione um projeto para o Átria.
2. Em **Google Auth Platform**, configure a tela de consentimento:
   - Nome do app: `Átria`.
   - E-mail de suporte: escolha o endereço administrado pela sua organização.
   - Público: **External** para permitir contas Google de diferentes
     organizações; durante o modo de teste, adicione os e-mails permitidos em
     **Test users**.
   - Solicite somente os escopos `openid` e `email`.
3. Em **Clients**, crie um cliente OAuth do tipo **Web application**.
4. Em **Authorized redirect URIs**, adicione:
   - Desenvolvimento local: `http://localhost:3000/api/auth/google/callback`
   - Produção: `https://SEU-DOMINIO/api/auth/google/callback` (troque pelo
     domínio HTTPS real do Átria).
5. Salve e copie o **Client ID** e o **Client secret**. Não os envie pelo chat
   nem os publique em código ou repositório.

### Configurar o Átria

No arquivo `.env` local, preencha:

```env
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=cole-o-client-id-aqui
GOOGLE_CLIENT_SECRET=cole-o-client-secret-aqui
```

Reinicie `npm run dev`. Para produção, configure as mesmas três variáveis no
gerenciador de segredos da hospedagem, usando `APP_URL` com a origem HTTPS
real. A URL de callback calculada pelo Átria deve corresponder exatamente a
uma das **Authorized redirect URIs** cadastradas no Google.

O botão Google não pede senha ao Átria. A conta Google precisa ter o e-mail
verificado igual ao e-mail de um usuário já cadastrado e ativo. Usuários não
cadastrados ou inativos não conseguem entrar; as permissões permanecem sendo
as já atribuídas na matriz de permissões do Átria.

### Relatórios automáticos de erros (Brevo)

Quando uma tela de erro inesperado for exibida, o Átria envia à equipe de
suporte um e-mail para `wandersonjc@gmail.com` com um anexo `.txt` contendo os
detalhes técnicos disponíveis no navegador. Segredos comuns são removidos do
relatório antes do envio. A tela confirma o envio somente quando a API da Brevo
aceita a mensagem.

No painel da Brevo, crie uma chave de API e cadastre/verifique o endereço de
remetente autorizado. Configure estas variáveis no `.env` local:

```env
BREVO_API_KEY=chave-da-api
BREVO_SENDER_EMAIL=remetente-verificado@seudominio.com
BREVO_SENDER_NAME=Atria
```

`BREVO_SENDER_NAME` é opcional. Configure as mesmas variáveis no gerenciador de
segredos da hospedagem e reinicie a aplicação após alterar as configurações.
Não compartilhe nem publique a chave da API.

### Solicitações de orçamento

O módulo Orçamento envia uma planilha `.xlsx` individual a cada fornecedor ativo
vinculado aos produtos selecionados. Para e-mail, reutiliza as configurações
Brevo acima. Para WhatsApp pela API externa da Z-API, configure a URL de
integração exibida no painel e o token completo:

```env
ZAPI_API_URL=https://api.zapi.app.br/v2/api/external/ID_DA_API
ZAPI_EXTERNAL_TOKEN=token-completo-da-api-externa
```

O endpoint `SendMessageAPIFile` recebe `multipart/form-data` na própria URL de
integração, com os campos `media` (arquivo XLSX), `body` (mensagem), `number`
(telefone com DDI), `externalKey` (ID estável da solicitação) e `isClosed`
(`false`). A autenticação usa `Authorization: Bearer`. Mantenha o token como
segredo no `.env` e no gerenciador de variáveis da hospedagem; nunca o exponha
no frontend.

O cadastro do fornecedor precisa conter e-mail e/ou WhatsApp válidos para cada
canal escolhido. A solicitação e as quantidades convertidas para a unidade-base
ficam registradas mesmo quando um canal falha; os resultados são exibidos por
fornecedor. Conceda as permissões `orcamentos.orcamento.consultar` e
`orcamentos.orcamento.enviar` em **Permissões** aos usuários que usarão o módulo.

A planilha enviada ao fornecedor mostra o preço por unidade solicitada (isto é,
por unidade ou embalagem escolhida na solicitação, não por unidade-base) e
campos para disponibilidade total, parcial com quantidade ou indisponibilidade,
prazo em dias, validade da cotação e observações. Os IDs da solicitação, do item
e do produto permanecem em colunas ocultas para identificação e conferência.
O sistema ainda não recebe nem importa a planilha respondida; o fluxo planejado
de validação, prévia, revisão e gravação do preço cotado, assim como as decisões
pendentes sobre disponibilidade e reimportação, está descrito em
[`docs/regras-de-negocio.md`](./docs/regras-de-negocio.md), na seção do Módulo 5.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
