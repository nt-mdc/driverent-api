// ============================================================================
// APP.TS - Configuração central da aplicação Express
// ============================================================================
// Este arquivo é responsável por MONTAR o Express: registar os middlewares
// globais (JSON, CORS), as rotas da API e o middleware de tratamento de
// erros. Ele NÃO inicia o servidor (não chama app.listen) — isso é feito
// em server.ts. Separar "app" de "server" facilita, por exemplo, escrever
// testes automatizados que usam o "app" sem precisar abrir uma porta real.
// ============================================================================

// "express-async-errors" precisa ser importado ANTES de criarmos as rotas.
// Ele faz um "monkey patch" no Express: qualquer erro lançado (throw) ou
// Promise rejeitada dentro de uma rota/controller assíncrona passa a ser
// automaticamente encaminhada para o nosso middleware de erros (next(err)),
// sem que precisemos escrever try/catch em todos os controllers.
import 'express-async-errors';

import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler } from './middlewares/error.middleware';

// Cria a instância principal da aplicação Express.
const app = express();

// Middleware "cors": permite que este servidor seja chamado por uma aplicação
// front-end rodando em outra origem (outro domínio/porta), como um app
// React em http://localhost:5173. Sem isso, o navegador bloquearia as
// requisições por política de segurança (Same-Origin Policy).
app.use(cors());

// Middleware "express.json()": faz o parsing automático do corpo (body) das
// requisições que chegam com "Content-Type: application/json", transformando
// o JSON recebido em um objeto JavaScript disponível em "req.body" dentro
// dos controllers.
app.use(express.json());

// Registra TODAS as rotas da API sob o prefixo "/api".
// Ex.: routes/cliente.routes.ts define a rota "/", que aqui se torna,
// na prática, "/api/clientes".
app.use('/api', routes);

// Rota simples de "health check", só para confirmar que a API está no ar.
app.get('/', (_req, res) => {
  res.json({ mensagem: 'DriveRent API está no ar! Consulte /api para os recursos disponíveis.' });
});

// O middleware de tratamento de erros DEVE ser o ÚLTIMO "app.use()" registado.
// O Express reconhece um middleware de erro pela sua assinatura com 4
// parâmetros (err, req, res, next) e só o executa quando algum erro é
// lançado/propagado (seja via next(err), seja capturado automaticamente
// pelo express-async-errors).
app.use(errorHandler);

export { app };
