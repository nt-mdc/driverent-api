# 📖 Guia de Documentação — Swagger/OpenAPI no DriveRent API

Este guia ensina a **documentar** a DriveRent API com Swagger, passo a passo, na ordem certa.
Ele é o terceiro da série: o `README.md` explica como **rodar** o projeto, o
`GUIA_DE_DESENVOLVIMENTO.md` explica como **construir** — e este explica como **documentar**,
cobrindo o conhecimento *"Habilitar a documentação com Swagger"* do plano de curso da UC
Desenvolvimento de API RESTful.

Ao final, a API terá:

- Uma **interface interativa** em `http://localhost:3333/api-docs` onde qualquer pessoa vê todos
  os endpoints, os formatos de entrada/saída, e pode **testar cada rota direto do navegador**
  (inclusive as protegidas por JWT, com o botão Authorize);
- O **documento OpenAPI cru** em `http://localhost:3333/api-docs.json`, pronto para importar no
  Insomnia/Postman ou entregar a um time de front-end.

> ✅ **Todo comando e todo arquivo deste guia foram executados e verificados** contra o projeto
> DriveRent real (as versões exatas instaladas foram `swagger-ui-express 5.0.1` e
> `swagger-jsdoc 6.3.0`).

---

## Índice

0. [Conceitos: OpenAPI vs. Swagger](#etapa-0--conceitos-openapi-vs-swagger)
1. [Instalando e criando a definição base](#etapa-1--instalando-e-criando-a-definição-base)
2. [Ligando o Swagger UI no app.ts](#etapa-2--ligando-o-swagger-ui-no-appts)
3. [Documentando o primeiro endpoint](#etapa-3--documentando-o-primeiro-endpoint)
4. [Rotas protegidas: security + o botão Authorize](#etapa-4--rotas-protegidas-security--o-botão-authorize)
5. [Documentando o login](#etapa-5--documentando-o-login)
6. [Parâmetros de query](#etapa-6--parâmetros-de-query)
7. [Documentando o restante da API (o padrão a repetir)](#etapa-7--documentando-o-restante-da-api-o-padrão-a-repetir)
8. [Testando tudo pelo navegador e exportando](#etapa-8--testando-tudo-pelo-navegador-e-exportando)
9. [Erros comuns e checklist final](#etapa-9--erros-comuns-e-checklist-final)

---

## Etapa 0 — Conceitos: OpenAPI vs. Swagger

Antes de escrever qualquer código, dois nomes que todo mundo confunde:

- **OpenAPI** é o **padrão** (a "gramática"): um formato de documento, em JSON ou YAML, que
  descreve uma API inteira — cada rota, cada parâmetro, cada formato de resposta, cada código de
  status. É como uma **planta baixa da API**: quem lê a planta sabe usar o prédio sem nunca ter
  entrado nele.
- **Swagger** é o **conjunto de ferramentas** que trabalha com esse padrão. A que vamos usar é o
  **Swagger UI**: uma página web que lê o documento OpenAPI e o transforma numa interface bonita
  e navegável, com botão de "experimentar" em cada rota.

E por que documentar, se a API "já funciona"?

1. **O front-end é seu cliente.** Sem documentação, cada dúvida ("que campos o POST espera?",
   "o que volta no 400?") vira uma interrupção. Com ela, a resposta está na tela.
2. **A documentação é um contrato.** Ela fixa o que a API promete — os mesmos métodos, status e
   formatos que estudamos na UC.
3. **É testável.** O Swagger UI substitui uma coleção de curls decorados: dá para exercitar a API
   inteira pelo navegador, inclusive o fluxo de login.

Vamos gerar o documento OpenAPI com **duas bibliotecas**:

| Biblioteca | Papel |
|---|---|
| `swagger-jsdoc` | Lê comentários especiais (`@openapi`) escritos **em cima de cada rota** e monta o documento OpenAPI |
| `swagger-ui-express` | Serve a interface Swagger UI dentro do próprio Express, numa rota (`/api-docs`) |

A escolha do `swagger-jsdoc` é pedagógica de propósito: **a documentação de cada rota mora no
mesmo arquivo da rota**. Quem altera a rota está olhando para a doc dela — fica mais difícil as
duas saírem de sincronia.

---

## Etapa 1 — Instalando e criando a definição base

**Objetivo:** instalar as bibliotecas e criar o "esqueleto" do documento OpenAPI — a parte que
não depende de nenhuma rota específica.

### Comandos

```bash
npm install swagger-ui-express@^5.0.1 swagger-jsdoc@^6.2.8
npm install -D @types/swagger-ui-express@^4.1.6 @types/swagger-jsdoc@^6.0.4
```

> ⚠️ Como sempre neste projeto: **fixe as versões**. Estas foram as testadas contra o restante da
> stack (Express 4 + TypeScript 5.5).

### Arquivo: `src/config/swagger.ts` (novo)

Este arquivo concentra tudo o que é **global** na documentação: título, servidores, o esquema de
segurança JWT e os **schemas reutilizáveis** (o formato de um Cliente, de um Veículo...). As
rotas vão apenas *referenciar* esses schemas — nunca copiá-los.

```typescript
import swaggerJSDoc from 'swagger-jsdoc';

// Este arquivo monta o DOCUMENTO OpenAPI da API inteira.
//
// A "definition" abaixo é a parte central e fixa do documento (título, versão,
// servidores, segurança e schemas reutilizáveis). A documentação de cada
// endpoint fica escrita em comentários "@openapi" dentro dos próprios arquivos
// de rota (src/routes/*.ts) — o swagger-jsdoc varre esses arquivos (campo
// "apis" lá no final) e junta tudo num único JSON.
export const swaggerSpec = swaggerJSDoc({
  definition: {
    // Versão da ESPECIFICAÇÃO OpenAPI (a "gramática" do documento),
    // não confundir com a versão da nossa API (que fica em info.version).
    openapi: '3.0.3',

    info: {
      title: 'DriveRent API',
      version: '1.0.0',
      description:
        'API RESTful do sistema de aluguel de veículos DriveRent. ' +
        'Fluxo típico: cadastre um cliente, faça login para obter um token JWT ' +
        'e use o botão **Authorize** acima para testar as rotas protegidas.',
    },

    servers: [
      { url: 'http://localhost:3333', description: 'Ambiente de desenvolvimento' },
    ],

    // As tags agrupam os endpoints em "seções" na interface do Swagger.
    tags: [
      { name: 'Autenticação', description: 'Login e emissão de token JWT' },
      { name: 'Clientes', description: 'Cadastro e consulta de clientes' },
      { name: 'Veículos', description: 'Catálogo e gestão da frota' },
      { name: 'Locações', description: 'Abertura, devolução e cancelamento (RN01/RN02)' },
      { name: 'Manutenções', description: 'Registro e conclusão de manutenções (RN03)' },
    ],

    components: {
      // Declara COMO a API autentica. "bearerAuth" é o nome que as rotas
      // protegidas vão referenciar com "security: [{ bearerAuth: [] }]".
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Cole aqui o token devolvido pelo POST /api/auth/login (sem o prefixo "Bearer").',
        },
      },

      // Schemas reutilizáveis: cada um descreve o FORMATO de um objeto que a
      // API recebe ou devolve. As rotas referenciam com:
      //   $ref: '#/components/schemas/NomeDoSchema'
      schemas: {
        RespostaErro: {
          type: 'object',
          properties: {
            erro: { type: 'string', example: 'Mensagem explicando o que deu errado.' },
          },
        },

        Cliente: {
          type: 'object',
          description: 'Cliente SEM o campo senha (a senha nunca sai do banco).',
          properties: {
            id: { type: 'integer', example: 1 },
            nome: { type: 'string', example: 'Cliente Teste' },
            cpf: { type: 'string', example: '12345678900' },
            email: { type: 'string', format: 'email', example: 'cliente@teste.com' },
            telefone: { type: 'string', example: '11999999999' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },

        CategoriaVeiculo: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nomeCategoria: { type: 'string', example: 'Popular' },
            valorDiaria: { type: 'number', example: 120 },
            valorCaucao: { type: 'number', example: 500 },
          },
        },

        Veiculo: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            categoriaId: { type: 'integer', example: 1 },
            placa: { type: 'string', example: 'ABC1D23' },
            modelo: { type: 'string', example: 'Fiat Mobi' },
            ano: { type: 'integer', example: 2022 },
            statusDisponibilidade: {
              type: 'string',
              enum: ['Disponivel', 'Locado', 'Manutencao'],
              example: 'Disponivel',
            },
            categoria: { $ref: '#/components/schemas/CategoriaVeiculo' },
          },
        },

        Locacao: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            clienteId: { type: 'integer', example: 1 },
            veiculoId: { type: 'integer', example: 1 },
            dataRetirada: { type: 'string', format: 'date-time' },
            dataPrevistaDevolucao: { type: 'string', format: 'date-time' },
            dataDevolucaoReal: { type: 'string', format: 'date-time', nullable: true },
            valorTotal: { type: 'number', example: 360 },
            statusContrato: {
              type: 'string',
              enum: ['Ativo', 'Finalizado', 'Cancelado'],
              example: 'Ativo',
            },
            veiculo: { $ref: '#/components/schemas/Veiculo' },
          },
        },

        Manutencao: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            veiculoId: { type: 'integer', example: 3 },
            descricaoServico: { type: 'string', example: 'Troca de óleo' },
            dataManutencao: { type: 'string', format: 'date-time' },
            valorCusto: { type: 'number', example: 150 },
            veiculo: { $ref: '#/components/schemas/Veiculo' },
          },
        },
      },
    },
  },

  // Onde o swagger-jsdoc procura os comentários "@openapi".
  // O segundo padrão cobre a versão COMPILADA (npm run build + npm start):
  // o tsc mantém os comentários no .js gerado, então a documentação
  // continua funcionando em produção.
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
});
```

Repare em três decisões que vão economizar trabalho:

- **`RespostaErro`** existe porque *todos* os erros da API têm o mesmo formato
  (`{ "erro": "..." }` — vindo do `errorHandler`). Um schema, dezenas de reusos.
- **`enum`** em `statusDisponibilidade` e `statusContrato`: o Swagger mostra os valores
  possíveis como uma lista fechada — exatamente as regras de negócio da API.
- **`example`** em quase todo campo: os exemplos aparecem pré-preenchidos no "Try it out", então
  escolha valores que **funcionam de verdade** com o seed do projeto.

**Checkpoint:** `npx tsc --noEmit` deve passar sem erros.

---

## Etapa 2 — Ligando o Swagger UI no `app.ts`

**Objetivo:** servir a interface e o JSON cru em duas rotas novas.

### Editando `src/app.ts`

Adicione os dois imports novos e as duas rotas **antes** do `app.use('/api', routes)`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// ... (depois de app.use(express.json())):

// Interface interativa da documentação (Swagger UI): abre em /api-docs.
// swaggerUi.serve entrega os arquivos estáticos da interface;
// swaggerUi.setup(swaggerSpec) injeta o NOSSO documento OpenAPI nela.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// O documento OpenAPI cru, em JSON — útil para importar no Insomnia/Postman.
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});
```

### Testando

```bash
npm run dev
```

Abra **http://localhost:3333/api-docs** no navegador.

**Checkpoint:** a página do Swagger UI abre, com o título "DriveRent API", as 5 tags... e o aviso
**"No operations defined in spec!"**. Perfeito — o esqueleto está no ar; falta descrever as
operações, que é o que vem agora. Confira também `curl http://localhost:3333/api-docs.json`:
deve voltar um JSON com `"openapi": "3.0.3"`.

---

## Etapa 3 — Documentando o primeiro endpoint

**Objetivo:** aprender a sintaxe dos comentários `@openapi` documentando o `POST /api/clientes`.

A documentação de cada rota é um **comentário JSDoc com YAML dentro**, colocado imediatamente
acima do `router.post/get/...` correspondente. Três regras de ouro do YAML **antes** de digitar
qualquer coisa (elas causam 90% dos problemas):

1. **Indentação é significado.** Cada nível são 2 espaços a mais. Errou a indentação, a rota
   simplesmente **some** da interface, sem mensagem de erro.
2. **Nunca use TAB.** YAML proíbe; use espaços.
3. **O caminho é o completo e com chaves**: `/api/clientes/{id}` — com o prefixo `/api` (que o
   `app.ts` adiciona) e com `{id}`, não `:id` (a sintaxe `:id` é do Express; `{id}` é do OpenAPI).

### Editando `src/routes/cliente.routes.ts`

Acima da linha `router.post('/', clienteController.criar);`:

```typescript
/**
 * @openapi
 * /api/clientes:
 *   post:
 *     tags: [Clientes]
 *     summary: Cadastra um novo cliente (rota pública)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, cpf, email, senha, telefone]
 *             properties:
 *               nome: { type: string, example: "Marina Souza" }
 *               cpf: { type: string, example: "98765432100" }
 *               email: { type: string, format: email, example: "marina@teste.com" }
 *               senha: { type: string, example: "123456" }
 *               telefone: { type: string, example: "11988887777" }
 *     responses:
 *       201:
 *         description: Cliente criado (sem o campo senha)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       409:
 *         description: CPF ou e-mail já cadastrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 */
router.post('/', clienteController.criar);
```

Lendo de cima para baixo, o comentário responde às perguntas que um usuário da API faria:

- **`tags`** — em que seção da interface essa rota aparece.
- **`summary`** — a frase curta que aparece na linha fechada da rota.
- **`requestBody`** — o que a rota espera receber (`required` lista os campos obrigatórios).
- **`responses`** — um bloco por **código de status possível**, cada um com seu formato. Repare
  no `$ref`: o formato do Cliente criado e o formato do erro vêm dos schemas da Etapa 1.

### Testando

Salve (o `tsx watch`/`ts-node-dev` reinicia sozinho) e recarregue `/api-docs`.

**Checkpoint:** a seção **Clientes** apareceu com o `POST /api/clientes`. Expanda: o corpo de
exemplo já vem preenchido. Clique em **Try it out → Execute** — deve criar a Marina de verdade e
mostrar o `201`. Execute de novo: **`409`**, CPF duplicado. Você acabou de testar dois códigos de
status sem escrever um único curl.

---

## Etapa 4 — Rotas protegidas: `security` + o botão Authorize

**Objetivo:** documentar uma rota que exige JWT e entender o cadeado 🔒.

### Editando `src/routes/cliente.routes.ts`

Acima de `router.get('/:id', authMiddleware, clienteController.buscarPorId);`:

```typescript
/**
 * @openapi
 * /api/clientes/{id}:
 *   get:
 *     tags: [Clientes]
 *     summary: Busca um cliente pelo id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       401:
 *         description: Token ausente, inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 *       404:
 *         description: Cliente não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 */
router.get('/:id', authMiddleware, clienteController.buscarPorId);
```

Duas novidades:

- **`security: - bearerAuth: []`** — liga esta rota ao esquema declarado na Etapa 1. É isso que
  faz o **cadeado** aparecer ao lado da rota e o header `Authorization: Bearer ...` ser enviado
  automaticamente pelo "Try it out" depois do Authorize.
- **`parameters` com `in: path`** — documenta o `{id}` da URL. Existe também `in: query`
  (Etapa 6) e `in: header`.

Repare no espelhamento com a aula de HTTP: a rota documenta **todos os finais possíveis** —
`200`, `401` (não autenticado) e `404` (não existe). Uma rota protegida por posse do recurso
(como as de locação) documentaria também o `403`.

**Checkpoint:** a rota aparece com o cadeado. Try it out **sem** token → `401`. O cadeado é a
documentação dizendo a verdade.

---

## Etapa 5 — Documentando o login

**Objetivo:** completar o ciclo de autenticação dentro do próprio Swagger UI.

### Editando `src/routes/auth.routes.ts`

Acima de `router.post('/login', authController.login);`:

```typescript
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Autenticação]
 *     summary: Faz login e devolve um token JWT
 *     description: >
 *       Troca e-mail + senha por um token JWT com validade de 1 dia.
 *       Use o token no botão **Authorize** para acessar as rotas protegidas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: cliente@teste.com
 *               senha:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIs...
 *                 cliente:
 *                   $ref: '#/components/schemas/Cliente'
 *       401:
 *         description: E-mail ou senha inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 */
router.post('/login', authController.login);
```

> 💡 O `example` do email é `cliente@teste.com` / `123456` **de propósito**: são as credenciais
> do seed. Documentação com exemplos que funcionam de primeira vale ouro em aula.

### O fluxo completo no navegador (memorize — é o roteiro da aula)

1. **POST /api/auth/login → Try it out → Execute** (o exemplo já está preenchido);
2. **Copie o valor de `token`** da resposta (sem aspas);
3. Clique em **Authorize** (topo da página), cole o token, **Authorize → Close**;
4. Abra qualquer rota com cadeado → **Try it out → Execute** → agora responde `200`.

**Checkpoint:** `GET /api/clientes/{id}` com `id = 1` devolve o Cliente Teste, direto do
navegador, sem nenhum curl.

---

## Etapa 6 — Parâmetros de query

**Objetivo:** documentar o filtro `?disponibilidade=` do catálogo.

### Editando `src/routes/veiculo.routes.ts`

Acima de `router.get('/', veiculoController.listar);`:

```typescript
/**
 * @openapi
 * /api/veiculos:
 *   get:
 *     tags: [Veículos]
 *     summary: Lista o catálogo de veículos (rota pública)
 *     parameters:
 *       - name: disponibilidade
 *         in: query
 *         required: false
 *         description: Filtra pelo status do veículo
 *         schema:
 *           type: string
 *           enum: [Disponivel, Locado, Manutencao]
 *         example: Disponivel
 *     responses:
 *       200:
 *         description: Lista de veículos (com a categoria incluída)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Veiculo'
 */
router.get('/', veiculoController.listar);
```

Novidades: **`in: query`** com `required: false`, o **`enum`** (o Swagger vira um dropdown com os
3 valores válidos!) e a resposta como **array** (`type: array` + `items` com `$ref`).

**Checkpoint:** no Try it out, o parâmetro aparece como lista de seleção. `Disponivel` traz só os
disponíveis.

---

## Etapa 7 — Documentando o restante da API (o padrão a repetir)

Você já conhece todas as peças: `tags`, `summary`, `requestBody`, `parameters` (path e query),
`security`, `responses` com `$ref`. O resto da API é **combinação dessas peças**. Documente
uma rota de cada vez, sempre conferindo no navegador antes de passar à próxima.

Um exemplo completo do endpoint mais rico do sistema — abre locação com **quatro** finais
possíveis — para usar de modelo (em `src/routes/locacao.routes.ts`):

```typescript
/**
 * @openapi
 * /api/locacoes:
 *   post:
 *     tags: [Locações]
 *     summary: Abre uma locação para o cliente autenticado (RN01)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [veiculoId, dataPrevistaDevolucao]
 *             properties:
 *               veiculoId: { type: integer, example: 1 }
 *               dataPrevistaDevolucao:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-09-10T12:00:00.000Z"
 *     responses:
 *       201:
 *         description: Locação criada; o veículo passa a 'Locado'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Locacao'
 *       400:
 *         description: Veículo indisponível (RN01) ou data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 *       401:
 *         description: Token ausente, inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 *       404:
 *         description: Veículo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespostaErro'
 */
router.post('/', locacaoController.abrir);
```

E a devolução (RN02) — repare no `403`, que só as rotas com **posse de recurso** têm:

```typescript
/**
 * @openapi
 * /api/locacoes/{id}/devolver:
 *   patch:
 *     tags: [Locações]
 *     summary: Devolve o veículo e finaliza o contrato (RN02)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Devolvido; o veículo volta a 'Disponivel'
 *       400:
 *         description: Locação já finalizada ou cancelada
 *       401:
 *         description: Token ausente, inválido ou expirado
 *       403:
 *         description: A locação pertence a OUTRO cliente
 *       404:
 *         description: Locação não encontrada
 */
router.patch('/:id/devolver', locacaoController.devolver);
```

> 💡 Quando a resposta de erro é sempre `RespostaErro`, você **pode** omitir o bloco `content`
> (como acima) para a doc ficar mais enxuta — mas combine um padrão com a turma e siga um só.

### Tabela de referência — o que cada endpoint restante precisa

| Endpoint | Tag | 🔒 | Status a documentar | Resposta 2xx |
|---|---|---|---|---|
| `GET /api/clientes` | Clientes | sim | 200, 401 | array de `Cliente` |
| `GET /api/veiculos/{id}` | Veículos | — | 200, 404 | `Veiculo` |
| `POST /api/veiculos` | Veículos | sim | 201, 401, 404¹, 409² | `Veiculo` |
| `PUT /api/veiculos/{id}` | Veículos | sim | 200, 401, 404 | `Veiculo` |
| `GET /api/locacoes` | Locações | sim | 200, 401 | array de `Locacao` |
| `GET /api/locacoes/{id}` | Locações | sim | 200, 401, 403, 404 | `Locacao` |
| `PATCH /api/locacoes/{id}/cancelar` | Locações | sim | 200, 400, 401, 403, 404 | mensagem + `Locacao` |
| `POST /api/manutencoes` | Manutenções | sim | 201, 400³, 401, 404 | `Manutencao` |
| `GET /api/manutencoes` | Manutenções | sim | 200, 401 | array de `Manutencao` |
| `PATCH /api/manutencoes/{id}/concluir` | Manutenções | sim | 200, 400, 401, 404 | mensagem + `Veiculo` |

¹ categoria inexistente · ² placa duplicada · ³ RN03: veículo locado

A regra para preencher a coluna "Status a documentar" é sempre a mesma: **abra o service da rota
e liste cada `throw new AppError(...)` que ele pode dar** — cada um é um status que a
documentação deve prometer. Mais os do middleware (`401`) e do `errorHandler` (`409` para
`@unique` violado).

---

## Etapa 8 — Testando tudo pelo navegador e exportando

### O roteiro de demonstração (o mesmo do README, agora 100% sem terminal)

1. `POST /api/clientes` → Try it out → cria um cliente novo;
2. `POST /api/auth/login` → pega o token → **Authorize**;
3. `GET /api/veiculos?disponibilidade=Disponivel` → escolhe um carro;
4. `POST /api/locacoes` → `201`, veículo `Locado`;
5. `POST /api/locacoes` de novo, mesmo carro → **`400`** — a RN01 na tela, com a mensagem
   exatamente como documentada;
6. `PATCH /api/locacoes/{id}/devolver` → `200`, carro `Disponivel` de novo.

### Exportando para outras ferramentas

O endpoint `/api-docs.json` é o documento OpenAPI completo. No **Insomnia**:
*Create → Import → URL → `http://localhost:3333/api-docs.json`* — todas as rotas viram uma
coleção pronta. No **Postman** é igual (*Import → Link*). Esse é o "contrato" que você entrega a
um time de front-end.

### E em produção?

O campo `apis` do `swagger.ts` já cobre isso: ele varre `./src/routes/*.ts` (desenvolvimento)
**e** `./dist/routes/*.js` (produção). O `tsc` mantém os comentários no JavaScript compilado —
verificado: após `npm run build`, os blocos `@openapi` continuam presentes em
`dist/routes/*.js`, então `npm start` serve a mesma documentação.

---

## Etapa 9 — Erros comuns e checklist final

### Erros que a turma vai cometer (e como diagnosticar)

| Sintoma | Causa provável | Correção |
|---|---|---|
| "No operations defined in spec!" com rotas anotadas | Comentário sem a linha `@openapi`, ou campo `apis` não bate com o caminho dos arquivos | Confira a 1ª linha do comentário e o glob em `swagger.ts` |
| Uma rota específica sumiu da interface | Indentação YAML errada naquele bloco (ou TAB) | Compare espaço por espaço com um bloco que funciona |
| Rota aparece mas com caminho errado/duplicado | Esqueceu o prefixo `/api`, ou usou `:id` em vez de `{id}` | O caminho no YAML é o **completo**, no padrão OpenAPI |
| Cadeado não aparece numa rota protegida | Faltou o bloco `security` naquela rota | `security: - bearerAuth: []` (o nome deve bater com o de `securitySchemes`) |
| Try it out devolve 401 mesmo após Authorize | Token colado com aspas, com o prefixo "Bearer", ou expirado | Cole só o token; refaça o login se passou 1 dia |
| `$ref` mostra erro "Could not resolve reference" | Nome do schema com typo | O caminho é `#/components/schemas/NomeExato` |

### Checklist final da documentação

- [ ] `src/config/swagger.ts` com info, servers, tags, `bearerAuth` e os 6 schemas
- [ ] `/api-docs` (interface) e `/api-docs.json` (documento cru) no ar
- [ ] **Todos os 16 endpoints** anotados, cada um com `tags`, `summary` e `responses`
- [ ] Toda rota protegida com `security` (cadeado visível) — e só elas
- [ ] Todo status que o service pode lançar está documentado (`AppError` → `responses`)
- [ ] Exemplos que funcionam com o seed (`cliente@teste.com` / `123456`, veículo 1...)
- [ ] Erros sempre via `$ref: RespostaErro` — nunca formato inventado
- [ ] Roteiro da Etapa 8 executado inteiro pelo navegador, incluindo o `400` da RN01
- [ ] `npx tsc --noEmit` e `npm run build` passando (doc funciona também em produção)

**Fechamento da UC:** com este guia, o conhecimento *"Definição, criação e documentação de
projetos"* + *"Habilitar a documentação com Swagger"* do plano de curso está coberto — e a
documentação não é um anexo: é a própria API se explicando, testável, sempre em sincronia com o
código que ela descreve.
