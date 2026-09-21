# 🚀 Guia de Deploy — DriveRent API na Vercel com Neon (PostgreSQL)

Este guia leva o DriveRent API do seu computador (rodando com SQLite) até a internet
(rodando na **Vercel**, com um banco **PostgreSQL** hospedado no **Neon**).

Ele foi escrito para um cenário específico e muito comum em rede corporativa ou de
instituição de ensino:

> **A porta 5432 (PostgreSQL) está bloqueada na sua rede.**
> Você não consegue conectar no banco da nuvem a partir da sua máquina.

Isso parece impedir o deploy — afinal, como criar as tabelas num banco que você
não alcança? A resposta curta é: **você não precisa alcançar o banco.** Quem vai
criar as tabelas é o servidor de build da Vercel, que está na nuvem e não passa
pelo firewall da sua rede. O seu papel é só **preparar os arquivos** que dizem a
ele o que fazer.

Todos os comandos deste guia que você roda na sua máquina funcionam **sem nenhuma
conexão com banco de dados**. Isso foi testado, não é teoria.

---

## Índice

- [Antes de começar — o mapa mental](#antes-de-começar--o-mapa-mental)
- [Etapa 0 — Checklist inicial](#etapa-0--checklist-inicial)
- [Etapa 1 — Criar o banco no Neon](#etapa-1--criar-o-banco-no-neon)
- [Etapa 2 — Trocar SQLite por PostgreSQL no schema](#etapa-2--trocar-sqlite-por-postgresql-no-schema)
- [Etapa 3 — Atualizar o `.env` e o `.env.example`](#etapa-3--atualizar-o-env-e-o-envexample)
- [Etapa 4 — Gerar a migration SEM conectar no banco](#etapa-4--gerar-a-migration-sem-conectar-no-banco)
- [Etapa 5 — Preparar o Prisma Client para serverless](#etapa-5--preparar-o-prisma-client-para-serverless)
- [Etapa 6 — Criar o ponto de entrada serverless](#etapa-6--criar-o-ponto-de-entrada-serverless)
- [Etapa 7 — Criar o `vercel.json`](#etapa-7--criar-o-verceljson)
- [Etapa 8 — Ajustar o `package.json`](#etapa-8--ajustar-o-packagejson)
- [Etapa 9 — Tornar o seed re-executável](#etapa-9--tornar-o-seed-re-executável)
- [Etapa 10 — Conferir o `.gitignore` e subir para o GitHub](#etapa-10--conferir-o-gitignore-e-subir-para-o-github)
- [Etapa 11 — Criar o projeto na Vercel](#etapa-11--criar-o-projeto-na-vercel)
- [Etapa 12 — O primeiro deploy, passo a passo](#etapa-12--o-primeiro-deploy-passo-a-passo)
- [Etapa 13 — Rodar o seed em produção](#etapa-13--rodar-o-seed-em-produção)
- [Etapa 14 — Testar a API publicada](#etapa-14--testar-a-api-publicada)
- [Etapa 15 — O dia a dia: criando NOVAS migrations](#etapa-15--o-dia-a-dia-criando-novas-migrations)
- [Etapa 16 — Banco local com Docker (opcional, mas recomendado)](#etapa-16--banco-local-com-docker-opcional-mas-recomendado)
- [Solução de problemas](#solução-de-problemas)
- [Resumo dos comandos](#resumo-dos-comandos)

---

## Antes de começar — o mapa mental

A maior fonte de confusão no deploy é não separar **três lugares diferentes** onde
código roda. Fixe esta tabela antes de continuar:

| Lugar | Quando roda | Alcança o Neon? | O que faz aqui |
|---|---|---|---|
| **Sua máquina** | Enquanto você programa | ❌ Não (porta bloqueada) | Editar arquivos, gerar SQL de migration, dar `git push` |
| **Build da Vercel** | A cada `git push` | ✅ Sim | `prisma generate`, `prisma migrate deploy` — **é aqui que as tabelas nascem** |
| **Runtime da Vercel** | A cada requisição HTTP | ✅ Sim | Sua API respondendo `GET /api/veiculos` etc. |

O firewall da sua rede só afeta a **primeira linha**. As outras duas são máquinas
da Vercel, em datacenters, conversando com o Neon pela internet pública.

### Por que migrations parecem um problema

O Prisma tem dois comandos de migration, e eles fazem coisas bem diferentes:

| Comando | O que faz | Precisa de banco? |
|---|---|---|
| `prisma migrate dev` | **Cria** o arquivo de migration comparando o schema com o banco, e aplica | ✅ **Sim** |
| `prisma migrate deploy` | **Aplica** arquivos de migration que já existem no repositório | ✅ Sim |

Repare: os dois precisam de banco. Mas o `migrate deploy` vai rodar **na Vercel**,
onde há conexão. O problema real é só o `migrate dev`, que você rodaria na sua
máquina — e é ele que você **não vai usar**.

### A solução

Existe um terceiro comando, pouco conhecido, que **gera o SQL da migration sem
tocar em banco nenhum**:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Ele lê apenas o arquivo `prisma/schema.prisma`, compara com "um banco vazio" (que
existe só na cabeça dele) e imprime o SQL resultante. Zero rede. É com esse
comando que você vai criar o arquivo de migration na mão, commitar no Git, e
deixar o `migrate deploy` aplicá-lo lá na nuvem.

**Resumo do plano:**

```
Sua máquina                    GitHub              Vercel (build)         Neon
───────────                    ──────              ──────────────         ────
migrate diff  ──> migration.sql ──> push ──> migrate deploy ──────────> CREATE TABLE
(offline)                                    (tem conexão)
```

---

## Etapa 0 — Checklist inicial

Antes de mexer em qualquer arquivo, garanta que você tem:

- [ ] **Node.js 18 ou superior** — confira com `node -v`
- [ ] **Git configurado** e o projeto já versionado
- [ ] **Conta no GitHub** — <https://github.com>
- [ ] **Conta no Neon** — <https://neon.tech> (plano gratuito serve)
- [ ] **Conta na Vercel** — <https://vercel.com> (faça login com o GitHub, facilita)
- [ ] O projeto rodando localmente com SQLite (`npm run dev` funciona)

Confira também em que pasta você está. Todos os comandos deste guia rodam a partir
da raiz do projeto:

```bash
cd driverent-api
ls package.json prisma/schema.prisma   # os dois devem existir
```

> ⚠️ **Faça um commit antes de começar.** Assim, se algo der errado, você volta
> com `git checkout .` sem perder nada.
>
> ```bash
> git add -A
> git commit -m "checkpoint antes do deploy"
> ```

---

## Etapa 1 — Criar o banco no Neon

O Neon é um PostgreSQL gerenciado, com um plano gratuito generoso e — importante
para nós — um **console web** que funciona por HTTPS (porta 443). Como a porta 443
não é bloqueada em praticamente nenhuma rede, você vai conseguir **ver e consultar
o seu banco pelo navegador** mesmo sem conseguir conectar pelo terminal.

### 1.1 — Criar o projeto

1. Acesse <https://console.neon.tech> e faça login.
2. Clique em **Create project**.
3. Preencha:
   - **Project name:** `driverent`
   - **Postgres version:** a mais recente oferecida (17 ou superior)
   - **Region:** escolha a mais próxima de você. Quanto menor a distância entre a
     região do Neon e a região da Vercel, menor a latência de cada consulta.
4. Clique em **Create**.

### 1.2 — Pegar as DUAS strings de conexão

Essa é a parte que mais gera erro, então leia com atenção. O Neon oferece a mesma
base de dados por **dois endereços diferentes**, e você vai precisar dos dois:

| Endereço | Como identificar | Para que serve |
|---|---|---|
| **Pooled** (com pool) | tem `-pooler` no host | Uso do dia a dia da API (`SELECT`, `INSERT`...) |
| **Direct** (direta) | **não** tem `-pooler` | Rodar migrations |

Na tela do projeto, procure o painel **Connect** (ou **Connection Details**).
Haverá uma caixa de seleção chamada **Connection pooling**:

- **Com** a caixa marcada, você copia a string **pooled**.
- **Desmarcando** a caixa, você copia a string **direct**.

Elas se parecem com isto (os valores são exemplos — use os seus):

```
# POOLED — repare no "-pooler" logo depois do nome do endpoint
postgresql://neondb_owner:npg_A1b2C3d4@ep-cool-frost-12345678-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# DIRECT — mesmo endereço, SEM o "-pooler"
postgresql://neondb_owner:npg_A1b2C3d4@ep-cool-frost-12345678.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Copie as duas para um bloco de notas temporário. Você vai usá-las na Etapa 11.

### 1.3 — Por que duas strings?

Uma pergunta justa. A explicação:

**O endereço pooled** passa por um *connection pooler* (o Neon usa PgBouncer). Ele
fica entre a sua API e o banco, reaproveitando conexões. Isso é essencial em
ambiente serverless: cada requisição HTTP pode acordar uma instância nova da sua
função, e cada instância quer abrir uma conexão. Sem o pooler, cem requisições
simultâneas viram cem conexões e o banco recusa as próximas. Com o pooler, elas
compartilham um punhado de conexões reais.

**O endereço direct** não passa pelo pooler. Migrations precisam dele porque
executam comandos que o PgBouncer não sabe repassar corretamente — `CREATE TABLE`
dentro de transações longas, advisory locks (o Prisma usa um para impedir que dois
deploys apliquem a mesma migration ao mesmo tempo), e comandos de sessão. Se você
tentar migrar pelo endereço pooled, o build vai falhar com erros estranhos e
difíceis de diagnosticar.

O Prisma sabe alternar entre os dois sozinho, desde que você declare os dois no
schema. É o que faremos na próxima etapa.

---

## Etapa 2 — Trocar SQLite por PostgreSQL no schema

Abra `prisma/schema.prisma`. Localize o bloco `datasource db` (por volta da linha 31):

**Antes:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Depois:**
```prisma
datasource db {
  // "postgresql" faz o Prisma gerar SQL no dialeto do Postgres
  // (SERIAL, TIMESTAMP, DOUBLE PRECISION...) em vez do dialeto do SQLite.
  provider = "postgresql"

  // url: usada pela API em produção, no dia a dia. Aponta para o endereço
  // POOLED do Neon (aquele com "-pooler" no host).
  url = env("DATABASE_URL")

  // directUrl: usada APENAS pelos comandos de migration. Aponta para o
  // endereço DIRETO do Neon (sem "-pooler"). Migrations não funcionam
  // através de um connection pooler.
  directUrl = env("DIRECT_URL")
}
```

Salve. **Não mexa em mais nada do schema.**

### 2.1 — Por que os models não precisam mudar

Você pode estar se perguntando se os cinco models (`Cliente`, `CategoriaVeiculo`,
`Veiculo`, `Locacao`, `Manutencao`) vão sobreviver à troca. Vão, sem alteração
nenhuma. O schema deste projeto usa apenas tipos que existem nos dois bancos:

| Tipo no schema | Vira no SQLite | Vira no PostgreSQL |
|---|---|---|
| `Int @id @default(autoincrement())` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `String` | `TEXT` | `TEXT` |
| `Float` | `REAL` | `DOUBLE PRECISION` |
| `DateTime` | `DATETIME` | `TIMESTAMP(3)` |
| `String?` (opcional) | `TEXT` nullable | `TEXT` nullable |

O Prisma faz essa tradução automaticamente. É justamente por isso que o projeto
foi escrito guardando status como `String` (`"Disponivel"`, `"Ativo"`) em vez de
`enum` — `enum` não existe no SQLite, e a escolha por `String` deixou o schema
portável entre os dois bancos.

---

## Etapa 3 — Atualizar o `.env` e o `.env.example`

### 3.1 — O `.env` local

O arquivo `.env` **não vai para o Git** (está no `.gitignore`) e **não é lido pela
Vercel**. Ele serve só para a sua máquina. Mas o Prisma valida o schema antes de
qualquer comando, e o schema agora exige duas variáveis — então elas precisam
existir, mesmo que apontem para lugar nenhum.

Edite o seu `.env`:

```bash
PORT=3333

# --- Banco de dados ---
# Estas duas variáveis precisam EXISTIR para o Prisma validar o schema.
# Localmente elas não conectam em lugar nenhum (a porta 5432 está bloqueada
# pela rede), e tudo bem: nenhum comando deste guia tenta conectar.
# Os valores REAIS ficam nas variáveis de ambiente da Vercel.
DATABASE_URL="postgresql://usuario:senha@localhost:5432/driverent?schema=public"
DIRECT_URL="postgresql://usuario:senha@localhost:5432/driverent?schema=public"

# --- Autenticação ---
JWT_SECRET="driverent_super_secreto_troque_em_producao"
JWT_EXPIRES_IN="1d"
```

> 💡 Se você for fazer a **Etapa 16** (banco local com Docker), essas URLs de
> `localhost` passam a ser reais e funcionais. Guarde essa ideia.

### 3.2 — O `.env.example`

Esse **vai** para o Git, e serve de documentação para quem clonar o projeto.
Atualize o trecho do banco:

```bash
# ---------------------------------------------------------------------------
# DATABASE_URL: string de conexão usada pela API no dia a dia.
# Em produção (Vercel + Neon), use o endereço POOLED — aquele que tem
# "-pooler" no host — com os parâmetros pgbouncer=true e connection_limit=1:
#
#   postgresql://user:senha@ep-xxx-pooler.regiao.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1
#
# DIRECT_URL: string usada APENAS pelas migrations (prisma migrate deploy).
# Use o endereço DIRETO — o mesmo host, mas SEM o "-pooler":
#
#   postgresql://user:senha@ep-xxx.regiao.aws.neon.tech/neondb?sslmode=require
#
# Para desenvolver localmente com PostgreSQL via Docker, veja a Etapa 16
# do GUIA_DE_DEPLOY_VERCEL_NEON.md.
# ---------------------------------------------------------------------------
DATABASE_URL="postgresql://usuario:senha@localhost:5432/driverent?schema=public"
DIRECT_URL="postgresql://usuario:senha@localhost:5432/driverent?schema=public"
```

---

## Etapa 4 — Gerar a migration SEM conectar no banco

Chegamos ao coração do guia.

### 4.1 — Descartar a migration antiga

O projeto já tem uma migration em `prisma/migrations/20260819233143_init/`. Ela foi
escrita em **dialeto SQLite** — contém coisas como `INTEGER PRIMARY KEY
AUTOINCREMENT` e `DATETIME`, que o PostgreSQL não entende. Se você tentar aplicá-la
no Neon, o build quebra na primeira linha.

Como o banco de produção ainda não existe, não há histórico para preservar. Apague
e comece do zero:

```bash
rm -rf prisma/migrations
```

> ⚠️ Isso apaga o histórico de migrations do projeto. É seguro **agora**, porque
> nenhum banco em produção depende dele. Nunca faça isso num projeto que já está
> no ar — lá o caminho é criar uma migration nova, não reescrever o passado.

### 4.2 — Gerar o SQL da nova migration

Agora o comando central:

```bash
mkdir -p prisma/migrations/0_init

npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

Destrinchando cada parte:

| Parte | Significado |
|---|---|
| `migrate diff` | "calcule a diferença entre dois estados de banco" |
| `--from-empty` | estado de origem: um banco vazio (conceito, não conexão) |
| `--to-schema-datamodel prisma/schema.prisma` | estado de destino: o que o arquivo de schema descreve |
| `--script` | imprima SQL executável, em vez de um resumo legível |
| `> arquivo.sql` | redireciona a saída para o arquivo |

**Os dois estados são offline.** `--from-empty` não consulta nada, e
`--to-schema-datamodel` lê um arquivo do disco. Por isso o comando funciona com a
porta bloqueada — e funciona até sem a variável `DATABASE_URL` definida.

### 4.3 — Criar o arquivo de lock

O Prisma guarda numa pasta de migrations qual banco elas foram escritas para, e
recusa aplicá-las em um banco de tipo diferente. Crie esse marcador:

```bash
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
```

### 4.4 — Conferir o resultado

```bash
cat prisma/migrations/0_init/migration.sql
```

Você deve ver SQL de PostgreSQL de verdade. O começo será parecido com:

```sql
-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_veiculos" (
    "id" SERIAL NOT NULL,
    "nomeCategoria" TEXT NOT NULL,
    "valorDiaria" DOUBLE PRECISION NOT NULL,
    "valorCaucao" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "categorias_veiculos_pkey" PRIMARY KEY ("id")
);
```

Faça três verificações rápidas no arquivo:

1. Aparece `SERIAL` (Postgres), **não** `AUTOINCREMENT` (SQLite).
2. As cinco tabelas estão lá: `clientes`, `categorias_veiculos`, `veiculos`,
   `locacoes`, `manutencoes`.
3. No fim do arquivo há blocos `CreateIndex` (para os campos `@unique`) e
   `AddForeignKey` (para os relacionamentos).

Se algum desses três itens falhar, pare e revise a Etapa 2 antes de continuar.

### 4.5 — Regerar o Prisma Client

O Prisma Client que está em `node_modules` foi gerado a partir do schema SQLite.
Regere-o para o schema novo:

```bash
npx prisma generate
```

Esse comando também é offline — ele só lê o schema e escreve código em
`node_modules/.prisma/client`.

### 4.6 — Entendendo o que acabou de acontecer

Você **não** criou tabelas. Não há nenhuma tabela em lugar nenhum ainda. O que você
criou foi um **arquivo de texto com instruções SQL**, versionado no Git.

Quando a Vercel fizer o build, ela vai rodar `prisma migrate deploy`. Esse comando
vai conectar no Neon pela `DIRECT_URL`, procurar uma tabela de controle chamada
`_prisma_migrations`, não encontrá-la (banco vazio), criá-la, e então executar o
seu `0_init/migration.sql` — registrando na tabela de controle que a migration
`0_init` foi aplicada. Nos deploys seguintes ele verá que `0_init` já consta e não
fará nada.

---

## Etapa 5 — Preparar o Prisma Client para serverless

Abra `src/config/prisma.ts`. Hoje o código no fim do arquivo é:

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});
```

Isso é perfeito para a sala de aula com SQLite, mas tem dois problemas em produção
serverless. Substitua o bloco por:

```ts
import { PrismaClient } from '@prisma/client';

// ----------------------------------------------------------------------------
// Por que este código ficou mais complicado?
// ----------------------------------------------------------------------------
// Na Vercel, a API não roda como um servidor ligado 24h. Ela roda em "funções
// serverless": a plataforma acorda uma instância quando chega uma requisição e a
// desliga depois de um tempo sem uso. Enquanto a instância está "morna", ela é
// reaproveitada para novas requisições.
//
// Guardamos a instância do PrismaClient numa variável global para que, ao ser
// reaproveitada, ela use o pool de conexões que JÁ está aberto — em vez de abrir
// um novo a cada requisição e esgotar o limite de conexões do banco.
// ----------------------------------------------------------------------------

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    // Em produção registramos apenas erros. O log de 'query' imprime TODA
    // consulta SQL executada: ótimo para aprender localmente, mas em produção
    // enche os logs da Vercel e deixa cada requisição mais lenta.
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'warn', 'error'],
  });

globalParaPrisma.prisma = prisma;
```

A Vercel define `NODE_ENV=production` automaticamente nos deploys, então a troca de
log acontece sozinha — localmente você continua vendo as queries.

---

## Etapa 6 — Criar o ponto de entrada serverless

### 6.1 — O problema

Olhe o final de `src/server.ts`:

```ts
app.listen(PORT, () => { ... });
```

`app.listen()` **abre uma porta TCP e fica ouvindo para sempre**. É exatamente o
que você quer numa máquina sua, ou num servidor tradicional. Mas a Vercel não roda
servidores de longa duração: ela roda funções. O modelo é outro.

Numa função serverless, a plataforma recebe a requisição HTTP e **chama o seu
código passando `req` e `res` como argumentos**. Ninguém precisa ouvir porta — a
Vercel já ouviu por você.

A boa notícia: uma aplicação Express (`app`) **já é** uma função que aceita
`(req, res)`. É assim que o próprio Express funciona por dentro. Então basta
exportá-la, sem chamar `listen`.

### 6.2 — Criar o arquivo

A Vercel trata automaticamente qualquer arquivo dentro de uma pasta chamada `api/`
na raiz do projeto como uma função serverless. Crie a pasta e o arquivo:

```bash
mkdir -p api
```

**Arquivo: `api/index.ts` (novo)**

```ts
// ============================================================================
// api/index.ts — Ponto de entrada da aplicação na VERCEL
// ============================================================================
// Este arquivo é o equivalente ao src/server.ts, porém para o ambiente
// serverless da Vercel. A diferença fundamental:
//
//   src/server.ts   ->  chama app.listen() e OUVE uma porta para sempre.
//                       Usado na sua máquina, com "npm run dev".
//
//   api/index.ts    ->  apenas EXPORTA o app. A Vercel o chama passando
//                       (req, res) a cada requisição que chega.
//
// Os dois convivem sem conflito: cada ambiente usa o seu. Toda a lógica da
// API continua vivendo em src/app.ts e sendo compartilhada pelos dois.
// ============================================================================

import { app } from '../src/app';

// "export default" é o que a Vercel procura neste arquivo.
export default app;
```

Repare no que **não** está aqui:

- **Não há `app.listen()`.** Chamar `listen` numa função serverless faz a
  requisição pendurar até dar timeout.
- **Não há `import 'dotenv/config'`.** Na Vercel, as variáveis de ambiente já
  chegam prontas em `process.env`; não existe arquivo `.env` no servidor. (Deixar
  o import não quebraria nada, mas é ruído.)

---

## Etapa 7 — Criar o `vercel.json`

Sem configuração, a Vercel só entregaria à sua função as requisições que começam
com `/api`. Requisições para `/` cairiam num 404 da própria plataforma, sem chegar
ao Express.

Como queremos que o Express decida **todas** as rotas (ele já tem o `app.use('/api',
routes)` e a rota `/` de boas-vindas), criamos uma regra que redireciona tudo para
a função.

**Arquivo: `vercel.json` (novo, na raiz do projeto)**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/api" }
  ]
}
```

Traduzindo: *"qualquer caminho que chegar, entregue para a função em `api/`"*. O
Express recebe a requisição com o caminho original e faz o roteamento dele
normalmente — `/api/veiculos` continua caindo no controller de veículos.

> 💡 Se depois do deploy **todas** as rotas responderem a mesma coisa, ou derem 404,
> veja o item *"Todas as rotas retornam 404"* na seção de Solução de problemas.

---

## Etapa 8 — Ajustar o `package.json`

Duas mudanças. Abra o `package.json` e edite o bloco `"scripts"`:

```json
"scripts": {
  "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "postinstall": "prisma generate",
  "vercel-build": "prisma generate && prisma migrate deploy",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:studio": "prisma studio",
  "seed": "prisma db seed"
}
```

### 8.1 — Por que `postinstall`

A Vercel guarda em cache a pasta `node_modules` entre deploys, para acelerar o
build. O problema é que o Prisma Client não é uma biblioteca comum: ele é **gerado**
a partir do seu schema e escrito dentro de `node_modules/.prisma/client`. Quando a
Vercel restaura o cache, ela pode trazer um Client gerado a partir de um schema
antigo — e aí a API quebra em produção com erros de tipo que não existem
localmente.

O script `postinstall` roda automaticamente depois de todo `npm install` e força a
regeneração. É a recomendação oficial do Prisma para deploy na Vercel.

### 8.2 — Por que `vercel-build`

Quando existe um script chamado `vercel-build`, a Vercel o executa **em vez de**
`build`. É o gancho onde colocamos a migration:

```
prisma generate       →  gera o Client a partir do schema atual
prisma migrate deploy →  conecta no Neon (via DIRECT_URL) e aplica as
                         migrations pendentes
```

**Esta linha é a resposta à pergunta que originou este guia.** É literalmente aqui
que as tabelas são criadas no Neon — numa máquina da Vercel, com acesso livre à
internet, sem passar pelo firewall da sua rede.

### 8.3 — Não precisamos do `tsc` no build da Vercel

Note que `vercel-build` **não** chama `tsc`. Isso é intencional: a Vercel compila
`api/index.ts` e tudo que ele importa por conta própria, com o runtime
`@vercel/node`. O `npm run build` continua existindo para você testar o build de
produção localmente, mas não faz parte do deploy.

---

## Etapa 9 — Tornar o seed re-executável

O `prisma/seed.ts` atual usa `prisma.categoriaVeiculo.create()` e
`prisma.veiculo.createMany()`. Rodar duas vezes gera erro, porque `placa` é
`@unique` e as placas já existiriam.

Como na Vercel o seed pode acabar rodando mais de uma vez, adicione uma trava logo
no início da função `main()`:

**Arquivo: `prisma/seed.ts`** — logo depois do `console.log` de abertura:

```ts
async function main() {
  console.log('Iniciando o seed da base de dados do DriveRent...');

  // ------------------------------------------------------------------
  // Trava de segurança: se já existe alguma categoria cadastrada, o banco
  // já foi populado antes. Sair aqui evita erro de chave duplicada (as
  // placas dos veículos são @unique) caso este script rode duas vezes.
  // ------------------------------------------------------------------
  const categoriasExistentes = await prisma.categoriaVeiculo.count();
  if (categoriasExistentes > 0) {
    console.log('Banco já populado anteriormente. Nada a fazer.');
    return;
  }

  const popular = await prisma.categoriaVeiculo.create({
    // ... resto do arquivo continua igual
```

---

## Etapa 10 — Conferir o `.gitignore` e subir para o GitHub

### 10.1 — Conferir o que NÃO vai subir

O `.gitignore` do projeto já está correto, mas confira que estas linhas existem:

```
node_modules/
dist/
.env
prisma/dev.db
prisma/dev.db-journal
```

> 🔒 **O `.env` nunca pode ir para o Git.** Depois da Etapa 11 ele conterá a senha
> real do seu banco Neon. Se um arquivo `.env` já foi commitado alguma vez, ele
> continua no histórico mesmo depois de apagado — nesse caso, troque a senha do
> banco no console do Neon.

Confirme com:

```bash
git check-ignore -v .env
```

Se imprimir a linha do `.gitignore`, está protegido. Se não imprimir nada, o
arquivo **não** está sendo ignorado — corrija antes de continuar.

### 10.2 — O que VAI subir

Confira a lista de arquivos novos e modificados:

```bash
git status --short
```

Você deve ver algo como:

```
 M package.json
 M prisma/schema.prisma
 M prisma/seed.ts
 M src/config/prisma.ts
 M .env.example
 D prisma/migrations/20260819233143_init/migration.sql
?? api/
?? prisma/migrations/0_init/
?? vercel.json
```

Confirme especificamente que a migration nova está incluída — **se ela não subir, a
Vercel não terá o que aplicar e o banco ficará vazio**:

```bash
git status --short prisma/migrations
```

### 10.3 — Commitar e enviar

```bash
git add -A
git commit -m "feat: migra para PostgreSQL (Neon) e prepara deploy na Vercel"
git push origin main
```

---

## Etapa 11 — Criar o projeto na Vercel

### 11.1 — Importar o repositório

1. Acesse <https://vercel.com/new>.
2. Escolha o repositório `driverent-api` na lista. Se ele não aparecer, clique em
   **Adjust GitHub App Permissions** e libere o acesso.
3. Na tela de configuração:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (o `package.json` está na raiz do repositório)
   - **Build / Output Settings:** não mexa. O script `vercel-build` cuida disso.

**Ainda não clique em Deploy.** Configure as variáveis primeiro — um deploy sem
elas falha, e você perde tempo.

### 11.2 — Configurar as variáveis de ambiente

Ainda na tela de criação, expanda **Environment Variables** e adicione as quatro
abaixo. Marque os três ambientes (**Production**, **Preview**, **Development**) em
todas elas.

#### `DATABASE_URL`

Pegue a string **pooled** do Neon (a que tem `-pooler`) e **acrescente dois
parâmetros no final**:

```
postgresql://neondb_owner:SUA_SENHA@ep-xxx-pooler.regiao.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1
```

Os parâmetros extras não são opcionais:

| Parâmetro | Para que serve |
|---|---|
| `pgbouncer=true` | Desliga os *prepared statements* do Prisma. O PgBouncer em modo transaction não consegue rastreá-los, e sem isso você recebe o erro `prepared statement "s0" already exists` de forma intermitente — o pior tipo de bug, porque funciona nos seus testes e quebra com usuários reais. |
| `connection_limit=1` | Limita cada instância serverless a uma conexão. Como podem existir dezenas de instâncias simultâneas, o pool interno padrão do Prisma multiplicaria isso e esgotaria o banco. |

#### `DIRECT_URL`

A string **direta** (sem `-pooler`), **sem** parâmetros extras:

```
postgresql://neondb_owner:SUA_SENHA@ep-xxx.regiao.aws.neon.tech/neondb?sslmode=require
```

#### `JWT_SECRET`

**Não reutilize** o valor do `.env.example` — ele está público no seu repositório,
e qualquer pessoa poderia forjar um token válido. Gere um segredo novo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cole a saída como valor.

#### `JWT_EXPIRES_IN`

```
1d
```

> ℹ️ **Não defina `PORT`.** A Vercel gerencia isso. Como `api/index.ts` nem chama
> `listen`, a variável seria ignorada de qualquer forma.

### 11.3 — Conferência antes do deploy

Releia a lista de variáveis e confirme:

- [ ] `DATABASE_URL` **tem** `-pooler` no host
- [ ] `DATABASE_URL` termina com `&pgbouncer=true&connection_limit=1`
- [ ] `DIRECT_URL` **não tem** `-pooler`
- [ ] As duas terminam o host com `.neon.tech` e têm `sslmode=require`
- [ ] `JWT_SECRET` é um valor novo, não o do `.env.example`

Trocar essas duas URLs entre si é o erro mais comum deste processo, e o sintoma
(build que trava ou falha com mensagem obscura) não aponta para a causa.

Agora sim: **Deploy**.

---

## Etapa 12 — O primeiro deploy, passo a passo

Acompanhe os logs na tela. A Vercel vai executar, nesta ordem:

**1. Clone do repositório** — baixa o código do GitHub.

**2. `npm install`** — instala as dependências. Ao terminar, dispara o
`postinstall`, que roda `prisma generate`. Procure no log:

```
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client
```

**3. `npm run vercel-build`** — aqui acontece a mágica. Procure:

```
> prisma generate && prisma migrate deploy

Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public"

1 migration found in prisma/migrations

Applying migration `0_init`

The following migration has been applied:

migrations/
  └─ 0_init/
    └─ migration.sql

All migrations have been successfully applied.
```

**Este bloco é a confirmação de que as tabelas nasceram no Neon.** A partir daqui,
o banco existe.

**4. Build das funções** — a Vercel compila `api/index.ts` e tudo que ele importa.

**5. Deploy** — a URL fica no ar, algo como
`https://driverent-api.vercel.app`.

### 12.1 — Confirmar no Neon

Vá ao console do Neon e abra o **SQL Editor** (lembre: navegador, HTTPS, porta 443
— funciona mesmo com a 5432 bloqueada). Rode:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Você deve ver seis tabelas:

```
_prisma_migrations
categorias_veiculos
clientes
locacoes
manutencoes
veiculos
```

A `_prisma_migrations` é a tabela de controle do próprio Prisma. Dê uma olhada
nela, vale a pena entender:

```sql
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations;
```

É consultando essa tabela que o `migrate deploy` sabe, em cada deploy futuro, quais
migrations já foram aplicadas e quais faltam.

---

## Etapa 13 — Rodar o seed em produção

O banco está criado, mas vazio. O `prisma db seed` também precisa de conexão, então
usamos a mesma estratégia: rodá-lo no build.

### 13.1 — Adicionar o seed ao build, temporariamente

No `package.json`:

```json
"vercel-build": "prisma generate && prisma migrate deploy && prisma db seed"
```

Commite e envie:

```bash
git add package.json
git commit -m "chore: roda o seed no deploy"
git push origin main
```

Nos logs do novo deploy, procure:

```
Iniciando o seed da base de dados do DriveRent...
Categorias criadas: Popular, Sedan, SUV.
```

### 13.2 — Remover depois

Com a trava da Etapa 9, deixar o seed no build é inofensivo — ele detecta que o
banco já tem dados e sai na hora. Mas ele ainda custa uma conexão e alguns segundos
em **todo** deploy, sem necessidade. Reverta:

```json
"vercel-build": "prisma generate && prisma migrate deploy"
```

```bash
git add package.json
git commit -m "chore: remove o seed do build"
git push origin main
```

### 13.3 — Alternativa: semear pelo SQL Editor do Neon

Se preferir não mexer no build, você pode inserir os dados direto pelo SQL Editor
do Neon, no navegador:

```sql
INSERT INTO categorias_veiculos ("nomeCategoria", "valorDiaria", "valorCaucao")
VALUES ('Popular', 120, 500),
       ('Sedan',   180, 800),
       ('SUV',     250, 1200);
```

Funciona, mas dá mais trabalho para os veículos (você precisaria descobrir os `id`
gerados para preencher `categoriaId`). Para uma carga inicial completa, o caminho
do build é mais simples.

---

## Etapa 14 — Testar a API publicada

Troque `SUA-URL` pela URL que a Vercel te deu.

**A raiz deve responder a mensagem de boas-vindas:**

```bash
curl https://SUA-URL.vercel.app/
```

```json
{"mensagem":"DriveRent API está no ar! Consulte /api para os recursos disponíveis."}
```

**Listar veículos (dados do seed):**

```bash
curl https://SUA-URL.vercel.app/api/veiculos
```

**Cadastrar um cliente:**

```bash
curl -X POST https://SUA-URL.vercel.app/api/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Silva",
    "cpf": "12345678901",
    "email": "maria@exemplo.com",
    "senha": "senha123",
    "telefone": "11999998888"
  }'
```

**Fazer login e obter o token:**

```bash
curl -X POST https://SUA-URL.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@exemplo.com","senha":"senha123"}'
```

**Usar o token numa rota protegida:**

```bash
curl https://SUA-URL.vercel.app/api/locacoes \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

> ⏱️ **A primeira requisição depois de um tempo parado vai demorar mais** (1 a 3
> segundos). São dois "despertares" acontecendo juntos: a função serverless da
> Vercel, que estava desligada, e o banco do Neon, que suspende automaticamente no
> plano gratuito após alguns minutos sem uso. As requisições seguintes são rápidas.
> Isso não é um defeito da sua configuração.

---

## Etapa 15 — O dia a dia: criando NOVAS migrations

Você vai querer mudar o schema depois — adicionar um campo, criar um model novo. E
a porta continua bloqueada. O fluxo abaixo resolve isso **sem banco nenhum**,
usando o Git como memória do estado anterior.

A ideia: o Git guarda a versão do schema que já foi para produção. Basta pedir ao
Prisma a diferença entre **aquela versão** e a **versão nova**.

### Passo 1 — Guardar o schema atual (antes de editar)

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-anterior.prisma
```

### Passo 2 — Editar o schema

Faça a alteração normalmente em `prisma/schema.prisma`. Por exemplo, adicionando um
campo opcional:

```prisma
model Cliente {
  id       Int    @id @default(autoincrement())
  nome     String
  cpf      String @unique
  email    String @unique
  senha    String
  telefone String
  endereco String?   // <-- campo novo
  criadoEm DateTime @default(now())
  // ...
}
```

### Passo 3 — Gerar a migration comparando os dois arquivos

```bash
# Use a data/hora atual no nome da pasta, para manter a ordem cronológica.
# O Prisma aplica as migrations em ordem alfabética do nome da pasta.
NOME="$(date +%Y%m%d%H%M%S)_add_endereco_cliente"
mkdir -p "prisma/migrations/$NOME"

npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-anterior.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/$NOME/migration.sql"

cat "prisma/migrations/$NOME/migration.sql"
```

Saída esperada:

```sql
-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "endereco" TEXT;
```

Os dois lados da comparação são arquivos em disco. Nenhuma conexão é aberta.

### Passo 4 — Regerar o Client e publicar

```bash
npx prisma generate

git add -A
git commit -m "feat: adiciona campo endereco ao cliente"
git push origin main
```

A Vercel roda `migrate deploy`, encontra a migration nova (a `0_init` já consta na
`_prisma_migrations` e é ignorada), aplica só a nova, e pronto.

### ⚠️ Cuidado com colunas obrigatórias

Adicionar uma coluna **`NOT NULL` sem valor padrão** a uma tabela que já tem linhas
faz o PostgreSQL recusar o comando — ele não sabe o que colocar nas linhas
existentes. O build falha e o deploy é abortado.

Sempre que adicionar um campo obrigatório a uma tabela em produção, escolha uma
destas saídas:

```prisma
endereco String?                      // (a) opcional — mais simples
endereco String  @default("")         // (b) obrigatório, com valor padrão
```

Ou, se precisar mesmo de obrigatório sem padrão, edite o `migration.sql` gerado à
mão para fazer em três passos: adicionar como nulo, preencher as linhas
existentes, e só então tornar obrigatório:

```sql
ALTER TABLE "clientes" ADD COLUMN "endereco" TEXT;
UPDATE "clientes" SET "endereco" = 'Não informado' WHERE "endereco" IS NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco" SET NOT NULL;
```

O arquivo de migration é SQL comum e você pode editá-lo. Só não edite uma migration
que **já foi aplicada** — o Prisma guarda um checksum de cada uma e recusa
continuar se o conteúdo mudar depois do fato.

---

## Etapa 16 — Banco local com Docker (opcional, mas recomendado)

Tudo acima funciona sem banco local. Mas desenvolver assim é desconfortável: você
só descobre erros de SQL depois do push, e a cada tentativa gasta um deploy inteiro.

Existe uma saída que o firewall **não** bloqueia: rodar um PostgreSQL na sua
própria máquina, via Docker.

**Por que isso passa pelo firewall:** o bloqueio da sua rede é para conexões que
**saem** para a internet na porta 5432. Uma conexão para `localhost` nunca sai da
sua máquina — ela nem chega na placa de rede. O firewall corporativo não tem como
vê-la.

### 16.1 — Subir o banco

Com o Docker Desktop instalado e rodando:

```bash
docker run --name driverent-postgres \
  -e POSTGRES_USER=driverent \
  -e POSTGRES_PASSWORD=driverent \
  -e POSTGRES_DB=driverent \
  -p 5432:5432 \
  -d postgres:17
```

Verifique:

```bash
docker ps
```

### 16.2 — Apontar o `.env` para ele

As URLs que você já colocou na Etapa 3 servem exatamente para isto:

```bash
DATABASE_URL="postgresql://driverent:driverent@localhost:5432/driverent?schema=public"
DIRECT_URL="postgresql://driverent:driverent@localhost:5432/driverent?schema=public"
```

### 16.3 — Aplicar as migrations e popular

```bash
npx prisma migrate deploy   # aplica as migrations que já existem
npm run seed                # popula com os dados de exemplo
npm run dev                 # http://localhost:3333
```

### 16.4 — O que muda no seu fluxo

Com o banco local funcionando, você volta a usar o comando normal do Prisma, e não
precisa mais do `migrate diff`:

```bash
# Edite prisma/schema.prisma e depois:
npx prisma migrate dev --name add_endereco_cliente
```

Esse comando cria a pasta da migration, gera o SQL, aplica no banco local e regera
o Client — tudo de uma vez. Você testa localmente, e só então dá `push`. A Vercel
aplica a mesma migration no Neon.

Você também ganha o **Prisma Studio**, uma interface visual para o banco:

```bash
npx prisma studio
```

### 16.5 — Comandos úteis do container

```bash
docker stop driverent-postgres     # parar (os dados permanecem)
docker start driverent-postgres    # religar
docker rm -f driverent-postgres    # apagar tudo e recomeçar do zero
```

> 💡 Como o Docker roda a **mesma versão do PostgreSQL** que o Neon, o SQL que
> funciona local funciona em produção. É por isso que esta etapa vale o esforço:
> ela elimina a classe inteira de bugs do tipo "funcionava com SQLite".

---

## Solução de problemas

### `Can't reach database server` / `P1001` — durante o build da Vercel

O `migrate deploy` não conseguiu alcançar o Neon. Verifique, nesta ordem:

1. A `DIRECT_URL` está definida nas variáveis da Vercel? (Não basta estar no `.env`
   local — a Vercel não lê esse arquivo.)
2. Você marcou o ambiente **Production** ao criar a variável?
3. A senha foi copiada inteira? Senhas do Neon são longas e é fácil truncar.
4. A URL termina com `?sslmode=require`? O Neon exige TLS.
5. O projeto do Neon foi apagado ou está suspenso? Confira no console.

### `Can't reach database server` — na SUA máquina

Esperado: é o firewall. Nenhum comando deste guia precisa de conexão. Se apareceu,
você rodou algo que conecta — provavelmente `prisma migrate dev`, `prisma db push`,
`prisma studio` ou `prisma db seed`. Use `migrate diff` (Etapa 15) ou monte o banco
local (Etapa 16).

### `Environment variable not found: DIRECT_URL`

O schema declara `directUrl = env("DIRECT_URL")`, mas a variável não existe no
ambiente onde o comando rodou.

- Aconteceu **localmente**: adicione a linha no seu `.env` (Etapa 3.1). Qualquer
  valor com formato de URL Postgres serve para os comandos offline.
- Aconteceu **na Vercel**: crie a variável nas configurações do projeto. Depois de
  criar, **faça um novo deploy** — variáveis não são aplicadas retroativamente a
  deploys já construídos.

### `prepared statement "s0" already exists`

Falta o `pgbouncer=true` na `DATABASE_URL`. Acrescente, e note que o erro é
intermitente: ele só aparece quando o PgBouncer reaproveita uma conexão, então pode
demorar a se manifestar. Corrija mesmo que esteja funcionando no momento.

### `too many connections for role ...`

Falta o `connection_limit=1` na `DATABASE_URL`, ou você está usando a URL direta
(sem `-pooler`) como `DATABASE_URL`. Revise a checklist da Etapa 11.3.

### Todas as rotas retornam 404

Provavelmente o `vercel.json` não está sendo aplicado. Verifique:

1. O arquivo está na **raiz do repositório**, no mesmo nível do `package.json`.
2. Ele foi commitado? Confira com `git ls-files vercel.json`.
3. O JSON é válido? Um `printf '%s' "$(cat vercel.json)" | python3 -m json.tool`
   acusa erro de sintaxe.
4. O arquivo é `api/index.ts` (esse nome exato) e termina com `export default app`?

Para diagnosticar o que o Express está recebendo, adicione um log temporário como
**primeiro** middleware em `src/app.ts`:

```ts
app.use((req, _res, next) => {
  console.log('[debug] recebido:', req.method, req.url);
  next();
});
```

Faça o deploy, chame uma rota e leia o log em **Vercel → seu projeto → Logs**. Se
`req.url` chegar como `/api` em vez do caminho original, troque o `vercel.json` por:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api" },
    { "source": "/(.*)", "destination": "/api" }
  ]
}
```

Lembre de remover o log depois.

### `PrismaClientInitializationError: Query engine binary not found`

O Prisma Client não foi gerado, ou foi gerado para outro sistema operacional.
Confirme que `"postinstall": "prisma generate"` está no `package.json` (Etapa 8.1) e
force um build sem cache: em **Vercel → Deployments**, no menu `...` do último
deploy, escolha **Redeploy** e **desmarque** *Use existing Build Cache*.

### O build falha em `api/index.ts` com erro de `rootDir`

Alguns builds reclamam que `api/index.ts` está fora do `rootDir` definido no
`tsconfig.json` (que hoje é `./src`). Se isso acontecer, ajuste o `tsconfig.json`:

```json
{
  "compilerOptions": {
    "rootDir": "./",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "api/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

E, como a saída do `tsc` muda de lugar, atualize também no `package.json`:

```json
"main": "dist/src/server.js",
"start": "node dist/src/server.js"
```

### `P3009: migrate found failed migrations`

Uma migration começou e quebrou no meio, deixando o banco num estado
intermediário. O Prisma se recusa a continuar até você resolver. Como este é um
projeto de estudo, o caminho mais rápido é zerar o banco. No SQL Editor do Neon:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Depois faça um **Redeploy** na Vercel — o `migrate deploy` vai recriar tudo do zero,
e o seed roda de novo se você estiver na Etapa 13.

> ⚠️ Isso apaga **todos os dados**. É aceitável aqui porque é um projeto didático.
> Em produção real, o caminho é corrigir a migration e usar `prisma migrate resolve`.

### A migration não aparece no log do build

O log diz `No migration found in prisma/migrations` ou `0 migrations found`.
Quase sempre é a pasta que não subiu para o Git:

```bash
git ls-files prisma/migrations
```

Deve listar `prisma/migrations/0_init/migration.sql` e
`prisma/migrations/migration_lock.toml`. Se não listar, verifique se alguma linha
do `.gitignore` está pegando a pasta e force a adição:

```bash
git add -f prisma/migrations
git commit -m "fix: versiona as migrations"
git push origin main
```

### `Error validating datasource: the URL must start with postgresql://`

Sobrou `file:./dev.db` em algum lugar. Confira o `.env` (local) e as variáveis na
Vercel.

### A API responde, mas as tabelas estão vazias

O `migrate deploy` criou as tabelas, mas o seed não rodou. Volte à Etapa 13.

### Timeout na requisição

No plano gratuito da Vercel, uma função tem limite de execução de 10 segundos.
Se estourar, as causas prováveis são: (a) o `app.listen()` ficou em `api/index.ts` —
remova; (b) consulta muito pesada; ou (c) a `DATABASE_URL` está apontando para o
endereço direto em vez do pooled, e as conexões estão enfileirando.

---

## Resumo dos comandos

Para consulta rápida depois que você já entendeu o processo.

### Migração inicial (uma vez só)

```bash
# 1. schema.prisma: provider = "postgresql" + directUrl = env("DIRECT_URL")

# 2. Descartar a migration SQLite e gerar a de Postgres, offline
rm -rf prisma/migrations
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml

# 3. Regerar o Client
npx prisma generate

# 4. Publicar
git add -A
git commit -m "feat: migra para PostgreSQL e prepara deploy na Vercel"
git push origin main
```

### Nova migration, sem banco local

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-anterior.prisma
# ... edite prisma/schema.prisma ...

NOME="$(date +%Y%m%d%H%M%S)_descricao_da_mudanca"
mkdir -p "prisma/migrations/$NOME"
npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-anterior.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/$NOME/migration.sql"

npx prisma generate
git add -A && git commit -m "feat: ..." && git push origin main
```

### Nova migration, com banco local (Etapa 16)

```bash
npx prisma migrate dev --name descricao_da_mudanca
git add -A && git commit -m "feat: ..." && git push origin main
```

### Arquivos tocados por este guia

| Arquivo | O que mudou |
|---|---|
| `prisma/schema.prisma` | `provider` → `postgresql`, `directUrl` adicionada |
| `prisma/migrations/0_init/migration.sql` | **novo** — SQL do Postgres gerado offline |
| `prisma/migrations/migration_lock.toml` | **novo** — marca o provider |
| `prisma/seed.ts` | trava para não rodar duas vezes |
| `src/config/prisma.ts` | singleton global + log reduzido em produção |
| `api/index.ts` | **novo** — ponto de entrada serverless |
| `vercel.json` | **novo** — redireciona todas as rotas para a função |
| `package.json` | `postinstall` e `vercel-build` |
| `.env` | `DATABASE_URL` + `DIRECT_URL` no formato Postgres |
| `.env.example` | documentação das duas URLs |

### Variáveis de ambiente na Vercel

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Neon **pooled** (`-pooler`) + `&pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Neon **direta** (sem `-pooler`) |
| `JWT_SECRET` | segredo novo, gerado aleatoriamente |
| `JWT_EXPIRES_IN` | `1d` |

---

## Para fixar

Se você levar uma única ideia deste guia, que seja esta:

> **Migrations não rodam onde você programa. Elas rodam onde o código é publicado.**

O seu computador só precisa produzir **arquivos de texto** — o `migration.sql` e o
`schema.prisma`. Quem conversa com o banco é a Vercel, durante o build, e ela não
está atrás do firewall da sua rede.

É por isso que uma porta bloqueada não impede o deploy. Ela só torna o processo um
pouco mais manual — e, honestamente, mais transparente: você passa a **ver** o SQL
que vai ser aplicado, em vez de confiar que o `migrate dev` acertou.
