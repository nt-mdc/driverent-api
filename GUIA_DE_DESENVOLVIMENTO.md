# 🛠️ Guia de Desenvolvimento — Construindo o DriveRent API do Zero

Este guia ensina a **construir** o DriveRent API passo a passo, na ordem certa, começando por um
"Hello World" e terminando num projeto idêntico ao que já está pronto na pasta `driverent-api/`
(este mesmo projeto). Ele é o complemento do `README.md` — o README explica como **rodar** o
projeto já pronto; este guia explica como **chegar** até ele, arquivo por arquivo, comando por
comando.

> 💡 **Dica para praticar sem estragar o projeto pronto:** crie uma pasta irmã, por exemplo
> `driverent-api-treino`, ao lado desta (`driverent-api`), e siga o guia lá. Assim, sempre que
> tiver dúvida se o seu código está certo, pode comparar diretamente com o arquivo já pronto e
> comentado em `../driverent-api/src/...`.
>
> ```bash
> cd /Users/nathan/Projetos/senai/driverent
> mkdir driverent-api-treino
> cd driverent-api-treino
> ```

Cada etapa abaixo diz **o que instalar**, **o que criar/editar em cada arquivo** e **como testar**
antes de seguir para a próxima. Não pule etapas — cada uma depende da anterior.

---

## Índice

0. [Preparando o ambiente](#etapa-0--preparando-o-ambiente)
1. [Hello World (Express + TypeScript)](#etapa-1--hello-world-express--typescript)
2. [Organizando em app.ts + server.ts, e CORS](#etapa-2--organizando-em-appts--serverts-e-cors)
3. [Iniciando o Prisma](#etapa-3--iniciando-o-prisma)
4. [Primeiro model: Cliente](#etapa-4--primeiro-model-cliente)
5. [Tratamento de erros centralizado](#etapa-5--tratamento-de-erros-centralizado)
6. [CRUD de Cliente (o padrão a repetir)](#etapa-6--crud-de-cliente-o-padrão-a-repetir)
7. [Login com JWT](#etapa-7--login-com-jwt)
8. [Protegendo rotas com o authMiddleware](#etapa-8--protegendo-rotas-com-o-authmiddleware)
9. [Categorias e Veículos](#etapa-9--categorias-e-veículos)
10. [Povoando o banco (seed)](#etapa-10--povoando-o-banco-seed)
11. [Locações — RN01 e RN02](#etapa-11--locações--rn01-e-rn02)
12. [Manutenções — RN03](#etapa-12--manutenções--rn03)
13. [Build de produção e checklist final](#etapa-13--build-de-produção-e-checklist-final)

---

## Etapa 0 — Preparando o ambiente

**Objetivo:** ter uma pasta vazia, pronta para receber o projeto.

```bash
mkdir driverent-api-treino
cd driverent-api-treino
git init          # opcional, mas recomendado
```

Crie já o arquivo `.gitignore` (evita versionar coisas que não deveriam ir para o Git):

**Arquivo: `.gitignore`**
```
node_modules/
dist/
.env
prisma/dev.db
prisma/dev.db-journal
*.log
.DS_Store
```

---

## Etapa 1 — Hello World (Express + TypeScript)

**Objetivo:** ter o menor servidor possível de pé, respondendo numa rota, só para se ambientar com
o ciclo "escrever código → rodar → testar no navegador/curl".

### Comandos

```bash
npm init -y
npm install express@^4.19.2
npm install -D typescript@^5.5.4 tsx@^4.23.12 @types/node@^20.14.15 @types/express@^4.17.21
```

> ⚠️ **Importante:** fixe as versões exatamente como acima (com `@versao`). Sem isso, o `npm
> install express` pode instalar o **Express 5** (uma versão mais nova, com diferenças de
> comportamento) em vez do Express 4 usado e testado neste guia — e o resto do projeto foi
> verificado especificamente contra estas versões.

- `express` — o framework web que vai receber as requisições HTTP.
- `typescript` — o compilador que verifica os tipos e transforma `.ts` em `.js`.
- `tsx` — roda arquivos `.ts` diretamente (sem precisar compilar manualmente), usando o `esbuild`
  por baixo dos panos. Com a flag `watch`, ele também reinicia o servidor sozinho a cada alteração
  salva. Se você já teve problemas para rodar `ts-node` em alguma máquina (é comum em ambientes com
  Node mais recente, Windows, ou setups de ESM/CJS conflitantes), `tsx` costuma ser mais estável e
  rápido — é a alternativa usada neste guia.
- `@types/node` e `@types/express` — as "definições de tipos" dessas bibliotecas, para o
  TypeScript saber o formato de cada função que elas exportam.

### Arquivo: `tsconfig.json`

Este é o arquivo de configuração do compilador TypeScript. Já criamos aqui a versão final e
estrita que o projeto todo vai usar — ela não muda mais nas próximas etapas.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",

    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": false,
    "noImplicitReturns": true,

    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,

    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,

    "sourceMap": true,
    "declaration": false,

    "typeRoots": ["./node_modules/@types", "./src/@types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`strict: true` liga todas as checagens rígidas de tipo — é o que faz o TypeScript "puxar a sua
orelha" quando algo pode dar errado em tempo de execução. `rootDir`/`include` dizem ao compilador
que só o que estiver dentro de `src/**/*.ts` faz parte do projeto principal (isso vale para o
`tsc --noEmit`/`npm run build`; o script de seed, mais tarde, roda fora dessa pasta, mas o `tsx`
não se importa com `rootDir` — só transpila o arquivo, sem checagem de tipo de projeto inteiro).

### Arquivo: `src/server.ts`

```typescript
import express from 'express';

// Cria a aplicação Express — o "coração" do servidor HTTP.
const app = express();

const PORT = 3333;

// Uma rota é a combinação de um MÉTODO HTTP (aqui, GET) com um CAMINHO (aqui, "/").
// A função passada como segundo argumento roda toda vez que alguém acessa essa rota,
// recebendo "req" (a requisição recebida) e "res" (a resposta que vamos construir).
app.get('/', (req, res) => {
  res.json({ mensagem: 'Hello, DriveRent!' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
```

### Editando `package.json`

Adicione o campo `"scripts"` (o `npm init -y` já criou o restante do arquivo):

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts"
  }
}
```

### Testando

```bash
npm run dev
```

Em outro terminal:

```bash
curl http://localhost:3333
```

**Checkpoint:** deve aparecer `{"mensagem":"Hello, DriveRent!"}`. Se chegou até aqui, o ambiente
está pronto — a partir de agora vamos transformar este Hello World na API completa.

---

## Etapa 2 — Organizando em app.ts + server.ts, e CORS

**Objetivo:** separar "montar o Express" (`app.ts`) de "ligar o servidor numa porta" (`server.ts`).
Essa separação é a base da arquitetura em camadas que usaremos no resto do projeto.

### Comandos

```bash
npm install cors@^2.8.5
npm install -D @types/cors@^2.8.17
```

`cors` é o middleware que permite que um front-end rodando noutra origem (outro domínio/porta,
como `http://localhost:5173`) consiga chamar esta API sem ser bloqueado pelo navegador.

### Arquivo: `src/app.ts` (novo)

```typescript
import express from 'express';
import cors from 'cors';

const app = express();

// Permite requisições vindas de outras origens (front-ends em outra porta/domínio).
app.use(cors());

// Faz o parsing automático de corpos de requisição em JSON, disponibilizando o
// resultado em req.body dentro dos controllers/rotas.
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensagem: 'DriveRent API está no ar!' });
});

export { app };
```

### Arquivo: `src/server.ts` (substitua o conteúdo)

```typescript
import { app } from './app';

const PORT = 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
```

### Testando

```bash
npm run dev
curl http://localhost:3333
```

**Checkpoint:** mesma resposta de antes, só que agora vinda de dois arquivos com responsabilidades
separadas. Essa separação vai facilitar tudo o que vem a seguir — a partir daqui, quase todo o
resto do projeto entra dentro de `app.ts` (rotas, middlewares), nunca dentro de `server.ts`.

---

## Etapa 3 — Iniciando o Prisma

**Objetivo:** preparar a base de dados (SQLite, sem precisar instalar nada extra) e o Prisma, o ORM
que vamos usar para conversar com ela.

### Comandos

```bash
npm install -D prisma@^5.19.1
npm install @prisma/client@^5.19.1 dotenv@^16.4.5
mkdir prisma
```

> Você pode encontrar tutoriais que mandam rodar `npx prisma init` aqui. Neste guia criamos os
> arquivos manualmente em vez disso — é igualmente rápido, deixa claro exatamente o que cada
> arquivo contém, e evita depender do comportamento de scaffolding do `prisma init` (que muda
> bastante entre versões do Prisma).

### Arquivo: `prisma/schema.prisma` (novo, ainda sem nenhum model)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### Arquivo: `.env` (novo)

```dotenv
PORT=3333
DATABASE_URL="file:./dev.db"
```

### Arquivo: `.env.example` (novo — cópia do `.env`, sem segredos reais, para versionar no Git)

```dotenv
PORT=3333
DATABASE_URL="file:./dev.db"
```

### Editando `src/server.ts`

Agora que temos variáveis de ambiente, o servidor precisa carregá-las **antes** de qualquer outra
coisa (o Prisma, mais adiante, vai precisar de `DATABASE_URL` assim que for importado):

```typescript
import 'dotenv/config';

import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
```

### Editando `package.json`

Acrescente estes scripts (mantendo o `"dev"` que já existia):

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```

**Checkpoint:** rode `npm run dev` de novo — nada deve ter mudado na resposta do `curl`, mas agora
o projeto já sabe ler variáveis de ambiente e já tem o Prisma instalado, pronto para o primeiro
model.

---

## Etapa 4 — Primeiro model: Cliente

**Objetivo:** criar a primeira tabela do banco de dados e o "cliente" (no sentido de biblioteca)
que vai nos permitir consultá-la a partir do TypeScript.

### Arquivo: `prisma/schema.prisma` (adicione o model ao final do arquivo criado na Etapa 3)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Cliente {
  id       Int    @id @default(autoincrement())
  nome     String
  cpf      String @unique
  email    String @unique
  senha    String
  telefone String

  criadoEm DateTime @default(now())

  @@map("clientes")
}
```

- `@id @default(autoincrement())` — chave primária, gerada automaticamente (1, 2, 3...).
- `@unique` em `cpf` e `email` — o banco recusa duas linhas com o mesmo valor nesses campos.
- `@@map("clientes")` — o nome da tabela no banco fica `clientes` (minúsculo), mesmo o model se
  chamando `Cliente` no código TypeScript.

> Repare que **não** colocámos ainda um campo `locacoes` aqui. Isso porque uma relação no Prisma
> precisa que os DOIS lados existam no schema — e o model `Locacao` só vai ser criado na Etapa 11.
> Voltaremos a este arquivo para adicionar essa ligação quando chegar a hora.

### Comandos

```bash
npx prisma migrate dev --name create_cliente
```

Este comando lê o schema, cria a tabela `clientes` de verdade no arquivo `prisma/dev.db`, e gera o
**Prisma Client** — a biblioteca TypeScript tipada que vamos importar no código.

### Arquivo: `src/config/prisma.ts` (novo)

```typescript
import { PrismaClient } from '@prisma/client';

// Instância ÚNICA (singleton) do Prisma Client, reutilizada em todo o projeto.
// Se cada arquivo criasse o seu próprio "new PrismaClient()", esgotaríamos
// rapidamente o número de conexões simultâneas permitidas pelo banco de dados.
export const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});
```

A partir de agora, qualquer arquivo que precisar falar com o banco importa assim:
`import { prisma } from '../config/prisma';`.

### Testando

```bash
npx prisma studio
```

Isto abre uma interface visual no navegador (`http://localhost:5555`) onde já é possível ver a
tabela `Cliente`, vazia, mas pronta para receber dados.

**Checkpoint:** você já tem uma base de dados real, com uma tabela criada a partir do schema. A
partir daqui vamos construir a API que lê/escreve nela.

---

## Etapa 5 — Tratamento de erros centralizado

**Objetivo:** antes de escrever qualquer rota que acesse o banco, preparar UM único lugar que trata
todos os erros da aplicação — assim nenhuma rota que formos criar depois vai precisar de
try/catch repetido.

### Comandos

```bash
npm install express-async-errors@^3.1.1
```

Esta biblioteca faz o Express capturar automaticamente qualquer erro lançado (`throw`) dentro de
uma função `async`, sem precisarmos escrever `try/catch` em cada rota.

### Arquivo: `src/middlewares/error.middleware.ts` (novo)

```typescript
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

// AppError representa um erro "esperado" da aplicação (regra de negócio violada,
// recurso não encontrado, credenciais inválidas...). Em vez de cada service
// responder diretamente pelo "res" do Express (o que misturaria as camadas), ele
// apenas lança (throw) um AppError com a mensagem e o código HTTP certos.
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

// Middleware de erro do Express: repare que tem EXATAMENTE 4 parâmetros
// (err, req, res, next) — é essa assinatura que o Express usa para reconhecer
// que esta função trata erros, e não uma rota normal.
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Caso 1: erro "esperado", lançado por nós mesmos com "throw new AppError(...)".
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message });
    return;
  }

  // Caso 2: erro conhecido do Prisma (ex.: violação de campo @unique).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        erro: 'Já existe um registo com um valor único em conflito (ex.: CPF, e-mail ou placa duplicados).',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ erro: 'Registo não encontrado.' });
      return;
    }
  }

  // Caso 3: qualquer erro inesperado (bug, falha de infraestrutura...).
  // Registamos o erro completo no terminal do servidor (para depurar), mas
  // NUNCA expomos err.message/err.stack ao cliente da API — isso vazaria
  // detalhes internos que poderiam ajudar um atacante.
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
}
```

### Editando `src/app.ts`

`express-async-errors` precisa ser o **primeiro** import do arquivo, e `errorHandler` precisa ser o
**último** `app.use()` registado:

```typescript
import 'express-async-errors';

import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensagem: 'DriveRent API está no ar!' });
});

app.use(errorHandler);

export { app };
```

**Checkpoint:** o servidor continua a responder normalmente (`npm run dev` + `curl`). Ainda não há
nenhuma rota que gere erros de propósito, mas a partir de agora, sempre que um service lançar
`throw new AppError(...)`, a resposta HTTP correta sai automaticamente daqui.

---

## Etapa 6 — CRUD de Cliente (o padrão a repetir)

**Objetivo:** implementar o primeiro recurso completo (Service → Controller → Rotas). Este é o
"molde" que todos os outros recursos do projeto (Veículo, Locação, Manutenção) vão seguir.

### Comandos

```bash
npm install bcryptjs@^2.4.3
npm install -D @types/bcryptjs@^2.4.6
```

`bcryptjs` é usado para transformar a senha em texto puro num **hash** irreversível antes de
gravá-la no banco — nunca guardamos senhas em texto puro.

### Arquivo: `src/services/cliente.service.ts` (novo)

```typescript
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// Lista de campos "públicos" de um Cliente — usada em toda consulta, para o
// campo "senha" nunca sequer sair da base de dados. Preferimos isto a buscar
// o registo inteiro e "desestruturar para remover a senha", porque essa
// segunda abordagem criaria uma variável nunca usada (e o tsconfig deste
// projeto tem "noUnusedLocals": true, o que quebraria a compilação).
const SELECT_CLIENTE_PUBLICO = {
  id: true,
  nome: true,
  cpf: true,
  email: true,
  telefone: true,
  criadoEm: true,
} as const;

interface CriarClienteInput {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  telefone: string;
}

export async function criarCliente(dados: CriarClienteInput) {
  // bcrypt.hash(senha, 10) gera um hash irreversível. O "10" é o número de
  // "salt rounds": quanto maior, mais lento e mais seguro contra força bruta.
  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const clienteCriado = await prisma.cliente.create({
    data: { ...dados, senha: senhaHash },
    select: SELECT_CLIENTE_PUBLICO,
  });

  return clienteCriado;
}

export async function listarClientes() {
  return prisma.cliente.findMany({
    select: SELECT_CLIENTE_PUBLICO,
    orderBy: { id: 'asc' },
  });
}

export async function buscarClientePorId(id: number) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: SELECT_CLIENTE_PUBLICO,
  });

  if (!cliente) {
    throw new AppError('Cliente não encontrado.', 404);
  }

  return cliente;
}
```

### Arquivo: `src/controllers/cliente.controller.ts` (novo)

```typescript
import { Request, Response } from 'express';
import * as clienteService from '../services/cliente.service';

// req.body: dados enviados no CORPO da requisição (já convertido de JSON para
// objeto JS pelo middleware express.json(), registado em app.ts).
export async function criar(req: Request, res: Response): Promise<void> {
  const { nome, cpf, email, senha, telefone } = req.body;

  const cliente = await clienteService.criarCliente({ nome, cpf, email, senha, telefone });

  // res.status(codigo).json(objeto): define o status HTTP da resposta e a
  // serializa como JSON. 201 = "Created", um novo recurso foi criado.
  res.status(201).json(cliente);
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const clientes = await clienteService.listarClientes();
  res.status(200).json(clientes);
}

export async function buscarPorId(req: Request, res: Response): Promise<void> {
  // req.params: parâmetros dinâmicos da URL (ex.: a rota "/clientes/:id" faz
  // o Express popular req.params.id). Chega sempre como string — por isso o
  // Number(...) explícito.
  const id = Number(req.params.id);

  const cliente = await clienteService.buscarClientePorId(id);

  res.status(200).json(cliente);
}
```

### Arquivo: `src/routes/cliente.routes.ts` (novo)

```typescript
import { Router } from 'express';
import * as clienteController from '../controllers/cliente.controller';

const router = Router();

// Por enquanto, TODAS as rotas de cliente são públicas — vamos proteger
// GET / e GET /:id na Etapa 8, quando o authMiddleware existir.
router.post('/', clienteController.criar);
router.get('/', clienteController.listar);
router.get('/:id', clienteController.buscarPorId);

export default router;
```

### Arquivo: `src/routes/index.ts` (novo)

```typescript
import { Router } from 'express';
import clienteRoutes from './cliente.routes';

const routes = Router();

routes.use('/clientes', clienteRoutes);

export { routes };
```

### Editando `src/app.ts`

```typescript
import 'express-async-errors';

import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ mensagem: 'DriveRent API está no ar!' });
});

app.use(errorHandler);

export { app };
```

### Testando

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3333/api/clientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Cliente Teste","cpf":"12345678900","email":"cliente@teste.com","senha":"123456","telefone":"11999999999"}'

curl http://localhost:3333/api/clientes
```

**Checkpoint:** o primeiro cliente deve ser criado (sem a senha aparecer na resposta) e listado.
Este é o padrão **Service → Controller → Rota** que vamos repetir para Veículo, Locação e
Manutenção — a partir daqui, as próximas etapas vão ser mais rápidas.

---

## Etapa 7 — Login com JWT

**Objetivo:** permitir que um Cliente já cadastrado troque e-mail + senha por um token JWT.

### Comandos

```bash
npm install jsonwebtoken@^9.0.2
npm install -D @types/jsonwebtoken@^9.0.6
```

### Editando `.env` e `.env.example`

```dotenv
PORT=3333
DATABASE_URL="file:./dev.db"
JWT_SECRET="driverent_super_secreto_troque_em_producao"
JWT_EXPIRES_IN="1d"
```

### Arquivo: `src/services/auth.service.ts` (novo)

```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

interface LoginInput {
  email: string;
  senha: string;
}

export async function login(dados: LoginInput) {
  const cliente = await prisma.cliente.findUnique({ where: { email: dados.email } });

  // bcrypt.compare NUNCA "descriptografa" o hash — ele recalcula o hash da
  // senha recebida e compara os dois hashes entre si. Se "cliente" não
  // existir, ainda comparamos contra uma string vazia, só para não deixar o
  // tempo de resposta óbvio demais (evita "enumeração de utilizadores").
  const senhaConfere = await bcrypt.compare(dados.senha, cliente?.senha ?? '');

  // Mesma mensagem de erro para "não existe" e "senha errada" — de propósito,
  // por segurança: não revelamos qual dos dois motivos causou a falha.
  if (!cliente || !senhaConfere) {
    throw new AppError('E-mail ou senha inválidos.', 401);
  }

  const token = jwt.sign(
    { id: cliente.id, email: cliente.email },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as jwt.SignOptions['expiresIn'] }
  );

  return {
    token,
    cliente: { id: cliente.id, nome: cliente.nome, email: cliente.email },
  };
}
```

### Arquivo: `src/controllers/auth.controller.ts` (novo)

```typescript
import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export async function login(req: Request, res: Response): Promise<Response> {
  const { email, senha } = req.body;
  const resultado = await authService.login({ email, senha });
  return res.status(200).json(resultado);
}
```

### Arquivo: `src/routes/auth.routes.ts` (novo)

```typescript
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/login', authController.login);

export default router;
```

### Editando `src/routes/index.ts`

```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import clienteRoutes from './cliente.routes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/clientes', clienteRoutes);

export { routes };
```

### Testando

```bash
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@teste.com","senha":"123456"}'
```

**Checkpoint:** deve voltar `{ "token": "...", "cliente": {...} }`. Guarde esse token — vamos usá-lo
na próxima etapa.

---

## Etapa 8 — Protegendo rotas com o authMiddleware

**Objetivo:** criar o middleware que valida o token JWT e passa a exigi-lo em rotas sensíveis.

### Arquivo: `src/@types/express.d.ts` (novo)

```typescript
// Arquivo de DECLARAÇÃO de tipos (não gera código em tempo de execução).
// Ensina o TypeScript que req.user pode existir no objeto Request do Express.
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
      };
    }
  }
}
```

### Arquivo: `src/middlewares/auth.middleware.ts` (novo)

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

interface TokenPayload {
  id: number;
  email: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Cabeçalho no formato: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Token não fornecido.', 401);
  }

  // "Bearer eyJhbGci..." -> ["Bearer", "eyJhbGci..."]
  const partes = authHeader.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    throw new AppError('Token mal formatado. Utilize o formato: Bearer <token>.', 401);
  }

  const token = partes[1];

  try {
    // jwt.verify confere a assinatura (usando o mesmo segredo do login) e a
    // validade do token. Se passar, devolve o payload assinado no login.
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
    req.user = { id: payload.id, email: payload.email };
  } catch {
    throw new AppError('Token inválido ou expirado.', 401);
  }

  next();
}
```

### Editando `src/routes/cliente.routes.ts`

Agora protegemos as rotas de leitura (deixamos o cadastro público, senão ninguém conseguiria criar
a primeira conta):

```typescript
import { Router } from 'express';
import * as clienteController from '../controllers/cliente.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', clienteController.criar); // PÚBLICA — cadastro
router.get('/', authMiddleware, clienteController.listar); // PROTEGIDA
router.get('/:id', authMiddleware, clienteController.buscarPorId); // PROTEGIDA

export default router;
```

### Testando

```bash
# Sem token -> 401
curl -i http://localhost:3333/api/clientes

# Com token -> 200
TOKEN="cole_aqui_o_token_da_etapa_7"
curl http://localhost:3333/api/clientes -H "Authorization: Bearer $TOKEN"
```

**Checkpoint:** sem token, `401 { "erro": "Token não fornecido." }`. Com token válido, a lista de
clientes volta normalmente. A partir daqui, qualquer rota nova que exigir login só precisa de
`authMiddleware` como segundo argumento da rota (ou `router.use(authMiddleware)` no topo do
arquivo, como faremos em Locação e Manutenção).

---

## Etapa 9 — Categorias e Veículos

**Objetivo:** adicionar o catálogo de veículos (público para leitura, protegido para escrita).

### Editando `prisma/schema.prisma` (adicione estes dois models ao final do arquivo)

```prisma
model CategoriaVeiculo {
  id            Int   @id @default(autoincrement())
  nomeCategoria String
  valorDiaria   Float
  valorCaucao   Float

  veiculos Veiculo[]

  @@map("categorias_veiculos")
}

model Veiculo {
  id          Int @id @default(autoincrement())
  categoriaId Int

  categoria CategoriaVeiculo @relation(fields: [categoriaId], references: [id])

  placa  String @unique
  modelo String
  ano    Int

  statusDisponibilidade String @default("Disponivel")

  @@map("veiculos")
}
```

### Comandos

```bash
npx prisma migrate dev --name create_categoria_e_veiculo
```

### Arquivo: `src/services/veiculo.service.ts` (novo)

```typescript
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

interface CriarVeiculoInput {
  categoriaId: number;
  placa: string;
  modelo: string;
  ano: number;
}

interface AtualizarVeiculoInput {
  categoriaId?: number;
  placa?: string;
  modelo?: string;
  ano?: number;
  statusDisponibilidade?: string;
}

export async function criarVeiculo(dados: CriarVeiculoInput) {
  // Validamos que a categoria existe ANTES de criar o veículo, para não
  // deixar um veículo "órfão" apontando para uma categoria inexistente.
  const categoria = await prisma.categoriaVeiculo.findUnique({
    where: { id: dados.categoriaId },
  });

  if (!categoria) {
    throw new AppError('Categoria de veículo não encontrada.', 404);
  }

  // statusDisponibilidade não é informado: o schema já define o valor padrão
  // 'Disponivel' para todo veículo novo (@default("Disponivel")).
  const veiculo = await prisma.veiculo.create({
    data: dados,
    include: { categoria: true },
  });

  return veiculo;
}

export async function listarVeiculos(statusDisponibilidade?: string) {
  // "include" traz os dados da relação (a categoria inteira); "select" seria
  // usado quando quiséssemos restringir CAMPOS específicos, não relações.
  return prisma.veiculo.findMany({
    where: statusDisponibilidade ? { statusDisponibilidade } : undefined,
    include: { categoria: true },
    orderBy: { id: 'asc' },
  });
}

export async function buscarVeiculoPorId(id: number) {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id },
    include: { categoria: true },
  });

  if (!veiculo) {
    throw new AppError('Veículo não encontrado.', 404);
  }

  return veiculo;
}

export async function atualizarVeiculo(id: number, dados: AtualizarVeiculoInput) {
  // Reaproveita a validação de existência (já lança 404 se não encontrar).
  await buscarVeiculoPorId(id);

  return prisma.veiculo.update({
    where: { id },
    data: dados,
    include: { categoria: true },
  });
}
```

### Arquivo: `src/controllers/veiculo.controller.ts` (novo)

```typescript
import { Request, Response } from 'express';
import * as veiculoService from '../services/veiculo.service';

export async function criar(req: Request, res: Response): Promise<void> {
  const { categoriaId, placa, modelo, ano } = req.body;
  const veiculoCriado = await veiculoService.criarVeiculo({ categoriaId, placa, modelo, ano });
  res.status(201).json(veiculoCriado);
}

export async function listar(req: Request, res: Response): Promise<void> {
  // req.query: parâmetros de query string (o que vem depois do "?" na URL),
  // ex.: /veiculos?disponibilidade=Disponivel.
  const disponibilidade = req.query.disponibilidade as string | undefined;
  const veiculos = await veiculoService.listarVeiculos(disponibilidade);
  res.status(200).json(veiculos);
}

export async function buscarPorId(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const veiculo = await veiculoService.buscarVeiculoPorId(id);
  res.status(200).json(veiculo);
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const veiculoAtualizado = await veiculoService.atualizarVeiculo(id, req.body);
  res.status(200).json(veiculoAtualizado);
}
```

### Arquivo: `src/routes/veiculo.routes.ts` (novo)

```typescript
import { Router } from 'express';
import * as veiculoController from '../controllers/veiculo.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', veiculoController.listar); // PÚBLICA — catálogo
router.get('/:id', veiculoController.buscarPorId); // PÚBLICA — catálogo
router.post('/', authMiddleware, veiculoController.criar); // PROTEGIDA
router.put('/:id', authMiddleware, veiculoController.atualizar); // PROTEGIDA

export default router;
```

### Editando `src/routes/index.ts`

```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import clienteRoutes from './cliente.routes';
import veiculoRoutes from './veiculo.routes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/clientes', clienteRoutes);
routes.use('/veiculos', veiculoRoutes);

export { routes };
```

### Testando

```bash
# Ainda não há categorias nem veículos — crie uma categoria pelo Prisma Studio
# (npx prisma studio) ou espere a Etapa 10, que povoa tudo de uma vez.
curl http://localhost:3333/api/veiculos
```

**Checkpoint:** a rota responde `[]` (lista vazia) sem exigir token. Na próxima etapa vamos povoar
o banco com categorias e veículos de verdade.

---

## Etapa 10 — Povoando o banco (seed)

**Objetivo:** criar um script que insere dados de exemplo automaticamente, para não ter que
cadastrar tudo manualmente antes de testar.

Não é preciso instalar mais nada aqui — o `tsx`, instalado na Etapa 1, também serve para rodar
este script de seed (não só o modo `watch` do servidor). O comando `prisma db seed` (configurado
mais abaixo) vai chamar `tsx prisma/seed.ts` para executar este arquivo uma única vez.

### Arquivo: `prisma/seed.ts` (novo)

```typescript
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';

async function main() {
  console.log('Iniciando o seed da base de dados do DriveRent...');

  const popular = await prisma.categoriaVeiculo.create({
    data: { nomeCategoria: 'Popular', valorDiaria: 120, valorCaucao: 500 },
  });
  const sedan = await prisma.categoriaVeiculo.create({
    data: { nomeCategoria: 'Sedan', valorDiaria: 180, valorCaucao: 800 },
  });
  const suv = await prisma.categoriaVeiculo.create({
    data: { nomeCategoria: 'SUV', valorDiaria: 250, valorCaucao: 1200 },
  });
  console.log('Categorias criadas: Popular, Sedan, SUV.');

  await prisma.veiculo.createMany({
    data: [
      { categoriaId: popular.id, placa: 'ABC1D23', modelo: 'Fiat Mobi', ano: 2022, statusDisponibilidade: 'Disponivel' },
      { categoriaId: popular.id, placa: 'ABC2D34', modelo: 'Chevrolet Onix', ano: 2023, statusDisponibilidade: 'Disponivel' },
      { categoriaId: sedan.id, placa: 'DEF3E45', modelo: 'Toyota Corolla', ano: 2023, statusDisponibilidade: 'Disponivel' },
      { categoriaId: sedan.id, placa: 'DEF4E56', modelo: 'Honda Civic', ano: 2022, statusDisponibilidade: 'Manutencao' },
      { categoriaId: suv.id, placa: 'GHI5F67', modelo: 'Jeep Compass', ano: 2023, statusDisponibilidade: 'Disponivel' },
    ],
  });
  console.log('5 veículos criados (4 disponíveis, 1 em manutenção).');

  const senhaHash = await bcrypt.hash('123456', 10);
  await prisma.cliente.create({
    data: {
      nome: 'Cliente Teste',
      cpf: '12345678900',
      email: 'cliente@teste.com',
      senha: senhaHash,
      telefone: '11999999999',
    },
  });
  console.log('Cliente de teste criado (email: cliente@teste.com, senha: 123456).');

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((erro) => {
    console.error('Erro ao executar o seed:', erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Editando `package.json`

O Prisma CLI precisa saber como rodar este script — adicione o campo `"prisma"` e o script
`"seed"`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "seed": "prisma db seed"
  }
}
```

> 💡 Se estivesse a usar `ts-node` em vez de `tsx` aqui, precisaria de um bloco extra em
> `package.json` (`"ts-node": { "compilerOptions": { "rootDir": "." } }`) para contornar o erro
> `TS6059: File '.../prisma/seed.ts' is not under 'rootDir'` — porque `prisma/seed.ts` fica
> **fora** da pasta `src` (o `rootDir` do `tsconfig.json`). O `tsx` não faz essa checagem de
> `rootDir` (ele só transpila o arquivo pedido, sem validar o projeto inteiro), por isso não
> precisamos de nenhum ajuste extra — mais um motivo para preferi-lo aqui.

### Comandos

```bash
npx prisma db seed
```

### Testando

```bash
curl http://localhost:3333/api/veiculos
```

**Checkpoint:** agora a lista traz os 5 veículos do seed. Se rodar `npx prisma db seed` de novo, vai
dar erro de CPF/placa duplicados (as colunas são `@unique`) — nesse caso, apague `prisma/dev.db` e
rode `npx prisma migrate dev` + `npx prisma db seed` de novo para recomeçar do zero.

---

## Etapa 11 — Locações — RN01 e RN02

**Objetivo:** o coração do sistema: abrir uma locação (RN01: só se o veículo estiver
`'Disponivel'`) e devolvê-la (RN02: libera o veículo de novo).

### Editando `prisma/schema.prisma`

Primeiro, volte ao model `Cliente` e ao model `Veiculo` e adicione o lado que faltava da relação
(agora que `Locacao` está prestes a existir):

```prisma
model Cliente {
  id       Int    @id @default(autoincrement())
  nome     String
  cpf      String @unique
  email    String @unique
  senha    String
  telefone String

  criadoEm DateTime @default(now())

  locacoes Locacao[]   // <-- ADICIONE ESTA LINHA

  @@map("clientes")
}
```

```prisma
model Veiculo {
  id          Int @id @default(autoincrement())
  categoriaId Int

  categoria CategoriaVeiculo @relation(fields: [categoriaId], references: [id])

  placa  String @unique
  modelo String
  ano    Int

  statusDisponibilidade String @default("Disponivel")

  locacoes Locacao[]   // <-- ADICIONE ESTA LINHA

  @@map("veiculos")
}
```

Agora adicione o novo model, ao final do arquivo:

```prisma
model Locacao {
  id        Int @id @default(autoincrement())
  clienteId Int
  veiculoId Int

  cliente Cliente @relation(fields: [clienteId], references: [id])
  veiculo Veiculo @relation(fields: [veiculoId], references: [id])

  dataRetirada          DateTime  @default(now())
  dataPrevistaDevolucao DateTime
  dataDevolucaoReal     DateTime?

  valorTotal Float

  statusContrato String @default("Ativo")

  @@map("locacoes")
}
```

### Comandos

```bash
npx prisma migrate dev --name create_locacao
```

### Arquivo: `src/services/locacao.service.ts` (novo)

Este é o arquivo mais importante do projeto — preste atenção especial ao uso de
`prisma.$transaction(async (tx) => { ... })`:

```typescript
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

interface AbrirLocacaoInput {
  veiculoId: number;
  dataPrevistaDevolucao: string;
}

// RN01 — Abre uma nova locação para o cliente autenticado.
//
// Usamos uma "transação interativa" (prisma.$transaction(async (tx) => {...}))
// porque precisamos LER o status do veículo e depois ESCREVER um novo status
// baseado nessa leitura, sem que outra requisição consiga "roubar" o mesmo
// veículo no meio do caminho. Tudo dentro do callback usa "tx" (não "prisma"),
// e ou tudo é aplicado ao banco, ou nada é (rollback automático em caso de erro).
export async function abrirLocacao(clienteId: number, dados: AbrirLocacaoInput) {
  return prisma.$transaction(async (tx) => {
    const veiculo = await tx.veiculo.findUnique({
      where: { id: dados.veiculoId },
      include: { categoria: true },
    });

    if (!veiculo) {
      throw new AppError('Veículo não encontrado.', 404);
    }

    // RN01: só é possível alugar um veículo RIGOROSAMENTE 'Disponivel'.
    if (veiculo.statusDisponibilidade !== 'Disponivel') {
      throw new AppError('Este veículo não está disponível para locação no momento.', 400);
    }

    const dataRetirada = new Date();
    const dataPrevistaDevolucao = new Date(dados.dataPrevistaDevolucao);

    if (
      Number.isNaN(dataPrevistaDevolucao.getTime()) ||
      dataPrevistaDevolucao <= dataRetirada
    ) {
      throw new AppError('A data prevista de devolução deve ser uma data válida e futura.', 400);
    }

    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    const dias = Math.max(
      1,
      Math.ceil((dataPrevistaDevolucao.getTime() - dataRetirada.getTime()) / MS_POR_DIA)
    );
    const valorTotal = dias * veiculo.categoria.valorDiaria;

    // Atualizamos o veículo ANTES de criar a locação de propósito: assim, o
    // "include" logo abaixo já lê o status 'Locado' atualizado, em vez do
    // status antigo 'Disponivel' (evita devolver uma resposta desatualizada).
    await tx.veiculo.update({
      where: { id: veiculo.id },
      data: { statusDisponibilidade: 'Locado' },
    });

    const locacao = await tx.locacao.create({
      data: {
        clienteId,
        veiculoId: veiculo.id,
        dataRetirada,
        dataPrevistaDevolucao,
        valorTotal,
        statusContrato: 'Ativo',
      },
      include: { veiculo: { include: { categoria: true } } },
    });

    return locacao;
  });
}

export async function listarLocacoesDoCliente(clienteId: number) {
  return prisma.locacao.findMany({
    where: { clienteId },
    include: { veiculo: { include: { categoria: true } } },
    orderBy: { id: 'desc' },
  });
}

export async function buscarLocacaoPorId(id: number, clienteId: number) {
  const locacao = await prisma.locacao.findUnique({
    where: { id },
    include: { veiculo: { include: { categoria: true } } },
  });

  if (!locacao) {
    throw new AppError('Locação não encontrada.', 404);
  }

  // 401 = "não sei quem você é" (tratado no authMiddleware, antes de chegar aqui).
  // 403 = "sei quem você é, mas não pode acessar ESTE recurso" — é o caso aqui.
  if (locacao.clienteId !== clienteId) {
    throw new AppError('Esta locação não pertence ao cliente autenticado.', 403);
  }

  return locacao;
}

// RN02 — Registra a devolução, finaliza o contrato e libera o veículo.
export async function devolverVeiculo(id: number, clienteId: number) {
  return prisma.$transaction(async (tx) => {
    const locacao = await tx.locacao.findUnique({ where: { id } });

    if (!locacao) {
      throw new AppError('Locação não encontrada.', 404);
    }
    if (locacao.clienteId !== clienteId) {
      throw new AppError('Esta locação não pertence ao cliente autenticado.', 403);
    }
    if (locacao.statusContrato !== 'Ativo') {
      throw new AppError('Esta locação já foi finalizada ou cancelada, não é possível devolvê-la novamente.', 400);
    }

    await tx.veiculo.update({
      where: { id: locacao.veiculoId },
      data: { statusDisponibilidade: 'Disponivel' },
    });

    const locacaoAtualizada = await tx.locacao.update({
      where: { id },
      data: { dataDevolucaoReal: new Date(), statusContrato: 'Finalizado' },
      include: { veiculo: { include: { categoria: true } } },
    });

    return locacaoAtualizada;
  });
}

// Extensão simétrica de RN02: cancelar uma locação ainda ativa (sem
// preencher dataDevolucaoReal, pois o veículo não chegou a ser usado).
export async function cancelarLocacao(id: number, clienteId: number) {
  return prisma.$transaction(async (tx) => {
    const locacao = await tx.locacao.findUnique({ where: { id } });

    if (!locacao) {
      throw new AppError('Locação não encontrada.', 404);
    }
    if (locacao.clienteId !== clienteId) {
      throw new AppError('Esta locação não pertence ao cliente autenticado.', 403);
    }
    if (locacao.statusContrato !== 'Ativo') {
      throw new AppError('Esta locação não pode mais ser cancelada.', 400);
    }

    await tx.veiculo.update({
      where: { id: locacao.veiculoId },
      data: { statusDisponibilidade: 'Disponivel' },
    });

    const locacaoAtualizada = await tx.locacao.update({
      where: { id },
      data: { statusContrato: 'Cancelado' },
      include: { veiculo: { include: { categoria: true } } },
    });

    return locacaoAtualizada;
  });
}
```

### Arquivo: `src/controllers/locacao.controller.ts` (novo)

```typescript
import { Request, Response } from 'express';
import * as locacaoService from '../services/locacao.service';

// Todas as rotas de locação passam pelo authMiddleware antes de chegar aqui
// (ver locacao.routes.ts), por isso "req.user!.id" é seguro: se não houvesse
// um cliente autenticado, o próprio authMiddleware já teria barrado com 401.
export async function abrir(req: Request, res: Response): Promise<void> {
  const clienteId = req.user!.id;
  const { veiculoId, dataPrevistaDevolucao } = req.body;

  const novaLocacao = await locacaoService.abrirLocacao(clienteId, { veiculoId, dataPrevistaDevolucao });

  res.status(201).json(novaLocacao);
}

export async function listar(req: Request, res: Response): Promise<void> {
  const clienteId = req.user!.id;
  const locacoes = await locacaoService.listarLocacoesDoCliente(clienteId);
  res.status(200).json(locacoes);
}

export async function buscarPorId(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const clienteId = req.user!.id;
  const locacao = await locacaoService.buscarLocacaoPorId(id, clienteId);
  res.status(200).json(locacao);
}

export async function devolver(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const clienteId = req.user!.id;
  const resultado = await locacaoService.devolverVeiculo(id, clienteId);
  res.status(200).json({ mensagem: 'Veículo devolvido com sucesso.', locacao: resultado });
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const clienteId = req.user!.id;
  const resultado = await locacaoService.cancelarLocacao(id, clienteId);
  res.status(200).json({ mensagem: 'Locação cancelada com sucesso.', locacao: resultado });
}
```

### Arquivo: `src/routes/locacao.routes.ts` (novo)

```typescript
import { Router } from 'express';
import * as locacaoController from '../controllers/locacao.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// RN04: TODAS as rotas de locação exigem autenticação. Em vez de repetir
// authMiddleware em cada rota, aplicamos uma única vez com router.use(...).
router.use(authMiddleware);

router.post('/', locacaoController.abrir);
router.get('/', locacaoController.listar);
router.get('/:id', locacaoController.buscarPorId);
router.patch('/:id/devolver', locacaoController.devolver);
router.patch('/:id/cancelar', locacaoController.cancelar);

export default router;
```

### Editando `src/routes/index.ts`

```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import clienteRoutes from './cliente.routes';
import veiculoRoutes from './veiculo.routes';
import locacaoRoutes from './locacao.routes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/clientes', clienteRoutes);
routes.use('/veiculos', veiculoRoutes);
routes.use('/locacoes', locacaoRoutes);

export { routes };
```

### Testando

```bash
TOKEN="cole_aqui_o_token_do_login"

# Alugar o veículo id=1 (deve estar Disponivel, vindo do seed)
curl -X POST http://localhost:3333/api/locacoes \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"veiculoId":1,"dataPrevistaDevolucao":"2026-09-01T12:00:00.000Z"}'

# Tentar alugar de novo -> RN01 barra com 400
curl -i -X POST http://localhost:3333/api/locacoes \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"veiculoId":1,"dataPrevistaDevolucao":"2026-09-01T12:00:00.000Z"}'

# Devolver (troque "1" pelo id da locação criada acima)
curl -X PATCH http://localhost:3333/api/locacoes/1/devolver -H "Authorization: Bearer $TOKEN"
```

**Checkpoint:** a segunda tentativa de aluguer do mesmo carro deve falhar com
`{"erro":"Este veículo não está disponível para locação no momento."}`, e depois de devolvido, o
veículo deve voltar a aparecer como `'Disponivel'` em `GET /api/veiculos`.

---

## Etapa 12 — Manutenções — RN03

**Objetivo:** completar o ciclo de vida do veículo: registar manutenção (só se ele não estiver
`'Locado'`) e concluir a manutenção (libera o veículo de novo).

### Editando `prisma/schema.prisma`

Adicione o lado que faltava da relação no model `Veiculo`:

```prisma
model Veiculo {
  id          Int @id @default(autoincrement())
  categoriaId Int

  categoria CategoriaVeiculo @relation(fields: [categoriaId], references: [id])

  placa  String @unique
  modelo String
  ano    Int

  statusDisponibilidade String @default("Disponivel")

  locacoes    Locacao[]
  manutencoes Manutencao[]   // <-- ADICIONE ESTA LINHA

  @@map("veiculos")
}
```

E o novo model, ao final do arquivo:

```prisma
model Manutencao {
  id        Int @id @default(autoincrement())
  veiculoId Int

  veiculo Veiculo @relation(fields: [veiculoId], references: [id])

  descricaoServico String
  dataManutencao   DateTime @default(now())
  valorCusto       Float

  @@map("manutencoes")
}
```

### Comandos

```bash
npx prisma migrate dev --name create_manutencao
```

### Arquivo: `src/services/manutencao.service.ts` (novo)

```typescript
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

interface RegistrarManutencaoInput {
  veiculoId: number;
  descricaoServico: string;
  valorCusto: number;
}

// RN03 — não é permitido registar manutenção em veículo 'Locado'. Ao
// registar, o veículo passa (ou permanece) com status 'Manutencao'.
export async function registrarManutencao(dados: RegistrarManutencaoInput) {
  return prisma.$transaction(async (tx) => {
    const veiculo = await tx.veiculo.findUnique({ where: { id: dados.veiculoId } });

    if (!veiculo) {
      throw new AppError('Veículo não encontrado.', 404);
    }
    if (veiculo.statusDisponibilidade === 'Locado') {
      throw new AppError('Não é possível registar manutenção em um veículo que está atualmente locado.', 400);
    }

    // Atualizamos o veículo ANTES de criar a manutenção, pelo mesmo motivo
    // da Etapa 11: o "include" abaixo já lê o status atualizado.
    await tx.veiculo.update({
      where: { id: dados.veiculoId },
      data: { statusDisponibilidade: 'Manutencao' },
    });

    const manutencao = await tx.manutencao.create({
      data: dados,
      include: { veiculo: true },
    });

    return manutencao;
  });
}

export async function listarManutencoes() {
  return prisma.manutencao.findMany({
    include: { veiculo: true },
    orderBy: { id: 'desc' },
  });
}

// Extensão necessária: sem isto, um veículo em manutenção ficaria preso
// nesse status para sempre, nunca mais podendo ser locado.
export async function concluirManutencao(id: number) {
  return prisma.$transaction(async (tx) => {
    const manutencao = await tx.manutencao.findUnique({
      where: { id },
      include: { veiculo: true },
    });

    if (!manutencao) {
      throw new AppError('Registo de manutenção não encontrado.', 404);
    }
    if (manutencao.veiculo.statusDisponibilidade !== 'Manutencao') {
      throw new AppError('Este veículo não está atualmente em manutenção.', 400);
    }

    const veiculoAtualizado = await tx.veiculo.update({
      where: { id: manutencao.veiculoId },
      data: { statusDisponibilidade: 'Disponivel' },
    });

    return veiculoAtualizado;
  });
}
```

### Arquivo: `src/controllers/manutencao.controller.ts` (novo)

```typescript
import { Request, Response } from 'express';
import * as manutencaoService from '../services/manutencao.service';

export async function registrar(req: Request, res: Response): Promise<void> {
  const { veiculoId, descricaoServico, valorCusto } = req.body;
  const manutencao = await manutencaoService.registrarManutencao({ veiculoId, descricaoServico, valorCusto });
  res.status(201).json(manutencao);
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const manutencoes = await manutencaoService.listarManutencoes();
  res.status(200).json(manutencoes);
}

export async function concluir(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const veiculo = await manutencaoService.concluirManutencao(id);
  res.status(200).json({ mensagem: 'Manutenção concluída, veículo disponível novamente.', veiculo });
}
```

### Arquivo: `src/routes/manutencao.routes.ts` (novo)

```typescript
import { Router } from 'express';
import * as manutencaoController from '../controllers/manutencao.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware); // RN04: todas as rotas exigem autenticação

router.post('/', manutencaoController.registrar);
router.get('/', manutencaoController.listar);
router.patch('/:id/concluir', manutencaoController.concluir);

export default router;
```

### Editando `src/routes/index.ts` (versão final)

```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import clienteRoutes from './cliente.routes';
import veiculoRoutes from './veiculo.routes';
import locacaoRoutes from './locacao.routes';
import manutencaoRoutes from './manutencao.routes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/clientes', clienteRoutes);
routes.use('/veiculos', veiculoRoutes);
routes.use('/locacoes', locacaoRoutes);
routes.use('/manutencoes', manutencaoRoutes);

export { routes };
```

### Testando

```bash
TOKEN="cole_aqui_o_token_do_login"

# Veículo 3 está Disponivel (vindo do seed) -> deve funcionar
curl -X POST http://localhost:3333/api/manutencoes \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"veiculoId":3,"descricaoServico":"Troca de óleo","valorCusto":150}'

# Concluir (troque "1" pelo id retornado acima)
curl -X PATCH http://localhost:3333/api/manutencoes/1/concluir -H "Authorization: Bearer $TOKEN"
```

**Checkpoint:** o veículo 3 deve mudar para `'Manutencao'` e depois voltar a `'Disponivel'` após
concluir. **Neste ponto, o projeto tem todas as regras de negócio (RN01–RN04) funcionando.**

---

## Etapa 13 — Build de produção e checklist final

**Objetivo:** confirmar que o projeto compila para produção e revisar tudo o que foi construído.

### Comandos

```bash
npx tsc --noEmit      # confere que não há nenhum erro de tipo em todo o projeto
npm run build         # compila TypeScript -> JavaScript, gera a pasta dist/
npm start             # roda a versão compilada (dist/server.js)
```

### Checklist final — o que o projeto deve ter, nesta ordem de dependência

- [ ] `package.json`, `tsconfig.json`, `.env`, `.env.example`, `.gitignore`
- [ ] `prisma/schema.prisma` com os 5 models (`Cliente`, `CategoriaVeiculo`, `Veiculo`, `Locacao`,
      `Manutencao`) e todas as relações dos dois lados
- [ ] `prisma/seed.ts`
- [ ] `src/config/prisma.ts` (singleton do Prisma Client)
- [ ] `src/@types/express.d.ts` (tipo de `req.user`)
- [ ] `src/middlewares/error.middleware.ts` (`AppError` + `errorHandler`)
- [ ] `src/middlewares/auth.middleware.ts`
- [ ] `src/services/*.service.ts` (auth, cliente, veiculo, locacao, manutencao)
- [ ] `src/controllers/*.controller.ts` (um para cada service)
- [ ] `src/routes/*.routes.ts` + `src/routes/index.ts`
- [ ] `src/app.ts` (monta tudo) e `src/server.ts` (liga o servidor)

### Regras de negócio para revisar mentalmente

| Regra | Onde vive | Como testar |
|---|---|---|
| RN01 — só aluga veículo `'Disponivel'` | `locacao.service.ts` → `abrirLocacao` | Alugar o mesmo carro duas vezes seguidas |
| RN02 — devolução libera o veículo | `locacao.service.ts` → `devolverVeiculo` | `PATCH /locacoes/:id/devolver` |
| RN03 — sem manutenção em veículo locado | `manutencao.service.ts` → `registrarManutencao` | Tentar registar manutenção num carro alugado |
| RN04 — rotas de escrita exigem login | `*.routes.ts` (uso de `authMiddleware`) | Chamar sem header `Authorization` |

**Parabéns — se chegou até aqui seguindo cada etapa, o seu projeto agora tem exatamente a mesma
funcionalidade do DriveRent API pronto.** A partir daqui, consulte o `README.md` para o roteiro
completo de testes em aula e a tabela final de endpoints.
