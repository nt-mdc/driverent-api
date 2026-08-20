// =============================================================================
// src/routes/cliente.routes.ts
// -----------------------------------------------------------------------------
// Responsabilidade desta camada (rotas): apenas mapear cada combinação de
// verbo HTTP + caminho da URL para a função de controller correspondente, e
// declarar quais rotas exigem autenticação (via authMiddleware) e quais são
// públicas. Nenhuma lógica de negócio ou acesso ao banco de dados deve
// aparecer aqui — isso fica a cargo dos controllers e, principalmente, dos
// services. Este router é montado em '/api/clientes' pelo arquivo central
// de rotas (src/routes/index.ts), que por sua vez é registado em src/app.ts.
// =============================================================================

import { Router } from 'express';
import * as clienteController from '../controllers/cliente.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

// Uma instância de Router do Express funciona como um "mini aplicativo",
// agrupando um conjunto de rotas relacionadas (neste caso, tudo relativo a
// clientes) que depois é "encaixado" (via app.use) dentro da aplicação
// principal, sob o prefixo '/api/clientes'.
const router = Router();

// PÚBLICA — cadastro de novo cliente. Não exige autenticação, pois é
// justamente a rota usada por quem ainda não tem conta para se registar.
router.post('/', clienteController.criar);

// PROTEGIDA — lista todos os clientes. Exige um token JWT válido no header
// Authorization; o authMiddleware é executado antes do controller e barra
// a requisição (lançando erro 401) caso o token esteja ausente ou inválido.
router.get('/', authMiddleware, clienteController.listar);

// PROTEGIDA — busca um cliente específico pelo id informado na URL. Também
// exige autenticação prévia via authMiddleware.
router.get('/:id', authMiddleware, clienteController.buscarPorId);

// Exportação padrão (default) do router, conforme a convenção do projeto
// para arquivos de rotas: cada arquivo de rotas exporta um único Router.
export default router;
