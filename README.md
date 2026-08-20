# 🚗 DriveRent API

API RESTful do **DriveRent**, um minimundo de aluguer (locação) de veículos, construída como
projeto didático para uma primeira imersão em desenvolvimento Back-End profissional.

Stack: **Node.js + TypeScript + Express + Prisma ORM**, com autenticação **JWT stateless** e
senhas protegidas com **bcrypt**.

> Este README é um guia passo a passo para acompanhar em aula. Siga as secções na ordem — cada
> uma assume que a anterior já foi concluída.

---

## Índice

1. [Visão geral e arquitetura](#1-visão-geral-e-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo a passo de instalação e inicialização](#3-passo-a-passo-de-instalação-e-inicialização)
4. [Tabela completa de endpoints](#4-tabela-completa-de-endpoints)
5. [Roteiro de testes em aula](#5-roteiro-de-testes-em-aula)
6. [Explicação conceitual de apoio](#6-explicação-conceitual-de-apoio)
7. [Regras de negócio implementadas](#7-regras-de-negócio-implementadas)
8. [Estrutura de pastas](#8-estrutura-de-pastas)

---

## 1. Visão geral e arquitetura

O DriveRent é um sistema de aluguer de veículos com 5 entidades principais:

- **Cliente** — quem aluga os veículos.
- **CategoriaVeiculo** — agrupa veículos (Popular, Sedan, SUV...), define valor da diária e da caução.
- **Veiculo** — a frota, cada um pertencente a uma categoria.
- **Locacao** — o contrato de aluguer de um veículo por um cliente.
- **Manutencao** — histórico de manutenções feitas em um veículo.

O projeto segue uma **arquitetura em camadas**, onde cada camada só conhece a camada logo abaixo
dela — isso é o que chamamos de "separação de responsabilidades":

```
Requisição HTTP
      │
      ▼
   Routes        →  define QUAL URL + método HTTP aciona QUAL controller (e se exige login)
      │
      ▼
 Middlewares     →  código que roda ANTES do controller (ex.: validar o token JWT)
      │
      ▼
 Controllers     →  lê req.body/req.params, chama o Service certo, devolve a resposta HTTP
      │
      ▼
  Services       →  TODA a regra de negócio e validações vivem aqui
      │
      ▼
Prisma Client    →  traduz chamadas TypeScript em comandos SQL
      │
      ▼
Base de dados    →  SQLite (arquivo local) ou PostgreSQL
```

**Por que separar assim?** Porque cada camada fica pequena, testável e fácil de entender
isoladamente. Um Controller, por exemplo, nunca deveria conter uma consulta ao banco de dados —
essa responsabilidade é sempre do Service.

---

## 2. Pré-requisitos

Antes de começar, instale:

| Ferramenta | Versão recomendada | Link |
|---|---|---|
| Node.js | 18 LTS ou superior | https://nodejs.org |
| npm | Instalado junto com o Node.js | — |
| VS Code | Última versão | https://code.visualstudio.com |
| Git (opcional) | Última versão | https://git-scm.com |

Extensões recomendadas do VS Code:

- **Prisma** (`Prisma.prisma`) — realce de sintaxe e formatação para arquivos `.prisma`.
- **Thunder Client** ou **REST Client** — para testar a API sem sair do VS Code (alternativa ao
  Postman/Insomnia).
- **ESLint** — ajuda a identificar erros de código enquanto digita.

Não é necessário instalar PostgreSQL nem nenhum outro banco de dados: por padrão, este projeto
usa **SQLite**, que guarda tudo em um único arquivo local (`prisma/dev.db`), criado
automaticamente.

---

## 3. Passo a passo de instalação e inicialização

### 3.1 Obter o projeto

Se recebeu a pasta `driverent-api` pronta, apenas abra-a no terminal:

```bash
cd driverent-api
```

### 3.2 Instalar as dependências

```bash
npm install
```

Isto lê o `package.json` e baixa todas as bibliotecas usadas pelo projeto (Express, Prisma,
jsonwebtoken, bcryptjs, etc.) para a pasta `node_modules/`.

### 3.3 Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Abra o novo arquivo `.env` e observe as três variáveis:

```dotenv
PORT=3333
DATABASE_URL="file:./dev.db"
JWT_SECRET="driverent_super_secreto_troque_em_producao"
JWT_EXPIRES_IN="1d"
```

- **`PORT`** — porta em que a API vai rodar localmente (`http://localhost:3333`).
- **`DATABASE_URL`** — endereço da base de dados que o Prisma vai usar. Por padrão aponta para um
  arquivo SQLite local (`file:./dev.db`), sem exigir nenhuma instalação extra.
- **`JWT_SECRET`** — a "chave secreta" usada para assinar e validar os tokens JWT emitidos no
  login. Em um projeto real, isto deveria ser uma string longa e aleatória, nunca versionada no
  Git (por isso o `.env` está no `.gitignore`).
- **`JWT_EXPIRES_IN`** — por quanto tempo um token continua válido depois de emitido (`1d` = 1 dia).

> **Quer usar PostgreSQL em vez de SQLite?** Troque `provider = "sqlite"` por
> `provider = "postgresql"` em `prisma/schema.prisma`, e ajuste `DATABASE_URL` no `.env` para uma
> connection string do Postgres, por exemplo:
> `postgresql://usuario:senha@localhost:5432/driverent?schema=public`. Depois, rode novamente o
> passo 3.4 abaixo.

### 3.4 Rodar a migração do Prisma

```bash
npx prisma migrate dev --name init
```

Este comando lê o `prisma/schema.prisma`, cria as tabelas correspondentes na base de dados
(criando também o arquivo `prisma/dev.db`, no caso do SQLite) e gera o **Prisma Client** — o
código TypeScript que os `services` usam para consultar a base de dados.

### 3.5 Popular a base de dados com dados de teste (seed)

```bash
npx prisma db seed
```

Isto executa `prisma/seed.ts`, criando:

- 3 categorias de veículo (Popular, Sedan, SUV);
- 5 veículos (placas `ABC1D23`, `ABC2D34`, `DEF3E45`, `DEF4E56`, `GHI5F67`), sendo 4 já
  `Disponivel` e 1 propositalmente já em `Manutencao`;
- 1 cliente de teste pronto para o login:
  - **e-mail:** `cliente@teste.com`
  - **senha:** `123456`

### 3.6 Iniciar o servidor em modo de desenvolvimento

```bash
npm run dev
```

Se tudo correu bem, o terminal deve mostrar algo como:

```
==========================================================
🚗  DriveRent API rodando em http://localhost:3333
📚  Recursos disponíveis em http://localhost:3333/api
==========================================================
```

O modo `dev` usa `ts-node-dev`, que reinicia o servidor automaticamente sempre que você salva um
arquivo `.ts` — ideal durante o desenvolvimento.

### Outros comandos úteis

| Comando | O que faz |
|---|---|
| `npm run build` | Compila o TypeScript para JavaScript puro, gerando a pasta `dist/` |
| `npm start` | Roda a versão já compilada (`dist/server.js`) — usado em produção |
| `npm run prisma:studio` | Abre o Prisma Studio, uma interface visual no navegador para ver/editar os dados |
| `npx prisma migrate dev --name <nome>` | Cria uma nova migração após alterar o `schema.prisma` |

---

## 4. Tabela completa de endpoints

URL base local: `http://localhost:3333/api`

Rotas **protegidas** exigem o header `Authorization: Bearer <token>`, obtido no login.

| Método | Rota | Proteção | Descrição |
|---|---|---|---|
| POST | `/clientes` | 🔓 Pública | Cadastra um novo cliente |
| POST | `/auth/login` | 🔓 Pública | Autentica e devolve um token JWT |
| GET | `/veiculos` | 🔓 Pública | Lista o catálogo de veículos (aceita `?disponibilidade=Disponivel`) |
| GET | `/veiculos/:id` | 🔓 Pública | Detalhe de um veículo específico |
| GET | `/clientes` | 🔒 Protegida | Lista todos os clientes cadastrados |
| GET | `/clientes/:id` | 🔒 Protegida | Detalhe de um cliente específico |
| POST | `/veiculos` | 🔒 Protegida | Cadastra um novo veículo na frota |
| PUT | `/veiculos/:id` | 🔒 Protegida | Atualiza dados de um veículo |
| POST | `/locacoes` | 🔒 Protegida | Abre uma nova locação (RN01) |
| GET | `/locacoes` | 🔒 Protegida | Lista as locações do cliente autenticado |
| GET | `/locacoes/:id` | 🔒 Protegida | Detalhe de uma locação (precisa pertencer ao cliente autenticado) |
| PATCH | `/locacoes/:id/devolver` | 🔒 Protegida | Finaliza a locação, devolvendo o veículo (RN02) |
| PATCH | `/locacoes/:id/cancelar` | 🔒 Protegida | Cancela uma locação ainda ativa |
| POST | `/manutencoes` | 🔒 Protegida | Registra uma manutenção em um veículo (RN03) |
| GET | `/manutencoes` | 🔒 Protegida | Lista todas as manutenções registadas |
| PATCH | `/manutencoes/:id/concluir` | 🔒 Protegida | Conclui a manutenção, liberando o veículo |

---

## 5. Roteiro de testes em aula

Com o servidor rodando (`npm run dev`), abra outro terminal e siga os passos abaixo com `curl`
(ou importe os mesmos exemplos no Thunder Client/Postman/Insomnia).

### 5.1 Criar uma conta de cliente

```bash
curl -X POST http://localhost:3333/api/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Ana Souza",
    "cpf": "11122233344",
    "email": "ana@teste.com",
    "senha": "senha123",
    "telefone": "11987654321"
  }'
```

**Resposta esperada (201 Created)** — repare que a `senha` NUNCA volta na resposta:

```json
{
  "id": 3,
  "nome": "Ana Souza",
  "cpf": "11122233344",
  "email": "ana@teste.com",
  "telefone": "11987654321",
  "criadoEm": "2026-08-19T23:00:00.000Z"
}
```

### 5.2 Efetuar login e copiar o token JWT

Você pode usar tanto o cliente que acabou de criar quanto o cliente de teste do seed
(`cliente@teste.com` / `123456`):

```bash
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@teste.com",
    "senha": "123456"
  }'
```

**Resposta esperada (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
  "cliente": { "id": 1, "nome": "Cliente Teste", "email": "cliente@teste.com" }
}
```

📌 **Copie o valor de `token`** — vamos precisar dele nos próximos passos. Para facilitar em
aula, você pode guardá-lo numa variável do terminal:

```bash
TOKEN="cole_o_token_aqui"
```

### 5.3 Consultar o catálogo público de veículos

Esta rota **não** exige token — é o catálogo público, como uma vitrine:

```bash
curl http://localhost:3333/api/veiculos
```

Também é possível filtrar apenas os disponíveis:

```bash
curl "http://localhost:3333/api/veiculos?disponibilidade=Disponivel"
```

### 5.4 Alugar um veículo (enviando o token no header)

Escolha um veículo com `statusDisponibilidade: "Disponivel"` no passo anterior (o seed cria o
veículo de `id: 1` já disponível) e abra uma locação:

```bash
curl -X POST http://localhost:3333/api/locacoes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "veiculoId": 1,
    "dataPrevistaDevolucao": "2026-08-25T12:00:00.000Z"
  }'
```

**Resposta esperada (201 Created)** — note `statusContrato: "Ativo"` e que o `veiculo` aninhado já
aparece com `statusDisponibilidade: "Locado"`:

```json
{
  "id": 1,
  "clienteId": 1,
  "veiculoId": 1,
  "dataRetirada": "2026-08-19T23:32:03.160Z",
  "dataPrevistaDevolucao": "2026-08-25T12:00:00.000Z",
  "dataDevolucaoReal": null,
  "valorTotal": 720,
  "statusContrato": "Ativo",
  "veiculo": { "id": 1, "statusDisponibilidade": "Locado", "categoria": { "valorDiaria": 120 } }
}
```

### 5.5 Tentar alugar o mesmo carro de novo (RN01 em ação)

Repita exatamente a mesma requisição do passo anterior:

```bash
curl -i -X POST http://localhost:3333/api/locacoes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "veiculoId": 1,
    "dataPrevistaDevolucao": "2026-08-25T12:00:00.000Z"
  }'
```

Desta vez a API deve recusar com **`400 Bad Request`**, pois o veículo já está `Locado`:

```json
{ "erro": "Este veículo não está disponível para locação no momento." }
```

Aproveite para também tentar **sem** o header `Authorization` — a API deve responder
**`401 Unauthorized`** com `{ "erro": "Token não fornecido." }`, demonstrando a RN04 (rotas
protegidas exigem login).

### 5.6 Finalizar a locação (devolver o veículo)

Use o `id` da locação criada no passo 5.4 (normalmente `1`, se for a primeira locação do banco):

```bash
curl -X PATCH http://localhost:3333/api/locacoes/1/devolver \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta esperada (200 OK)** — `statusContrato` agora é `"Finalizado"`, `dataDevolucaoReal` foi
preenchida, e o veículo aninhado volta a `statusDisponibilidade: "Disponivel"`:

```json
{
  "mensagem": "Veículo devolvido com sucesso.",
  "locacao": {
    "id": 1,
    "statusContrato": "Finalizado",
    "dataDevolucaoReal": "2026-08-19T23:40:00.000Z",
    "veiculo": { "statusDisponibilidade": "Disponivel" }
  }
}
```

Confirme consultando o catálogo novamente (passo 5.3): o veículo `1` deve estar `Disponivel` de
novo, pronto para uma nova locação.

### 5.7 (Extra) Registar e concluir uma manutenção — RN03

```bash
# Tente registar manutenção num veículo ALUGADO (ex.: alugue outro carro e tente o id dele) → 400
curl -i -X POST http://localhost:3333/api/manutencoes \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{ "veiculoId": 1, "descricaoServico": "Troca de óleo", "valorCusto": 150 }'

# Registe manutenção num veículo Disponivel → 201, veículo passa a "Manutencao"
curl -X POST http://localhost:3333/api/manutencoes \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{ "veiculoId": 3, "descricaoServico": "Troca de óleo e filtros", "valorCusto": 150 }'

# Conclua a manutenção (use o id retornado acima) → veículo volta a "Disponivel"
curl -X PATCH http://localhost:3333/api/manutencoes/1/concluir \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. Explicação conceitual de apoio

### O que é um Middleware?

Um *middleware* é uma função que fica "no meio do caminho" entre a requisição chegar ao servidor
e a resposta ser enviada de volta. Ele recebe `(req, res, next)` e pode:

- inspecionar ou alterar `req` antes do controller rodar (é o que o `authMiddleware` faz: lê o
  header `Authorization` e injeta `req.user`);
- interromper a requisição e responder diretamente (ex.: `401 Unauthorized` se o token for
  inválido);
- ou simplesmente chamar `next()` para deixar a requisição seguir para o próximo middleware/rota.

Um middleware de **erro** é um caso especial: tem 4 parâmetros (`err, req, res, next`) e só é
executado quando algo lança uma exceção. É assim que o `errorHandler` centraliza todas as
respostas de erro da API num único lugar.

### O que é um JWT Stateless?

**JWT** (JSON Web Token) é um "cartão de identificação" digital, assinado criptograficamente pelo
servidor no momento do login. Ele contém três partes separadas por pontos:
`cabeçalho.payload.assinatura`.

Dizemos que a autenticação é **stateless** (sem estado) porque o servidor **não guarda nada** em
banco de dados sobre quem está logado — nenhuma tabela de "sessões" ou "tokens ativos". Toda a
informação necessária para validar o utilizador (o `id` e o `email`, neste projeto) já está
dentro do próprio token. Em cada requisição protegida, o cliente reenvia o token no header
`Authorization: Bearer <token>`, e o servidor apenas **verifica a assinatura** — se ela bate,
confia no conteúdo; se não bate (token adulterado, expirado ou de outro segredo), rejeita com
`401`.

Vantagem: a API pode escalar horizontalmente (várias instâncias do servidor) sem precisar
partilhar uma tabela de sessões entre elas. Desvantagem: não é possível "invalidar" um token
específico antes da sua expiração natural (por isso `JWT_EXPIRES_IN` deve ser um valor razoável).

### Como o Prisma mapeia as relações?

O `prisma/schema.prisma` descreve os `models` (tabelas) e as relações entre eles usando campos
como `categoria CategoriaVeiculo @relation(fields: [categoriaId], references: [id])`. Isto diz ao
Prisma: "o campo `categoriaId` desta tabela é uma chave estrangeira que aponta para o `id` da
tabela `CategoriaVeiculo`".

A partir disso, o Prisma Client gerado permite:

- **`include`** — trazer os dados de uma relação junto do resultado principal (um "JOIN"
  automático). Ex.: `veiculo.findUnique({ include: { categoria: true } })` devolve o veículo
  **e** a categoria completa dentro do mesmo objeto.
- **`select`** — escolher exatamente quais campos devolver (útil, por exemplo, para nunca trazer
  o campo `senha` de um `Cliente`).
- **`$transaction`** — agrupar várias operações para que aconteçam de forma atômica: ou todas são
  aplicadas, ou nenhuma é (usado neste projeto para abrir/devolver locações e registar
  manutenções, garantindo que o status do veículo e o registo da locação/manutenção nunca fiquem
  "dessincronizados").

---

## 7. Regras de negócio implementadas

| Código | Regra |
|---|---|
| **RN01** | Um veículo só pode ser alugado se `statusDisponibilidade === 'Disponivel'`. Ao abrir a locação, o veículo muda atomicamente para `'Locado'`. |
| **RN02** | Ao devolver o veículo, a locação muda para `'Finalizado'` e o veículo volta a `'Disponivel'`. |
| **RN03** | Não é permitido registar manutenção em um veículo `'Locado'`. Ao registar, o veículo muda para `'Manutencao'`. |
| **RN04** | Criação/atualização de veículos, abertura de locações e registo de manutenções exigem token JWT válido. Apenas login, cadastro de cliente e leitura do catálogo de veículos são públicos. |

---

## 8. Estrutura de pastas

```
driverent-api/
├── prisma/
│   ├── schema.prisma       # Modelo de dados (models, relações, tipos)
│   └── seed.ts              # Povoamento inicial (categorias, veículos, cliente de teste)
├── src/
│   ├── @types/express.d.ts  # Extensão de tipos do Express (req.user)
│   ├── config/prisma.ts     # Instância singleton do PrismaClient
│   ├── controllers/         # Lê req, chama o service, devolve a resposta HTTP
│   ├── middlewares/         # auth.middleware.ts (JWT) e error.middleware.ts (erros centralizados)
│   ├── services/            # Toda a regra de negócio e acesso ao Prisma
│   ├── routes/               # Define as URLs e quais rotas exigem autenticação
│   ├── app.ts                # Monta o Express (middlewares globais + rotas + tratador de erros)
│   └── server.ts             # Sobe o servidor HTTP na porta configurada
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

Bons estudos! 🚀
