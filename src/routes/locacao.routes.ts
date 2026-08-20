// ============================================================================
// src/routes/locacao.routes.ts
//
// Este arquivo pertence à camada de ROTEAMENTO (routing) da arquitetura em
// camadas do DriveRent API. Sua única responsabilidade é mapear cada
// combinação de verbo HTTP + caminho de URL para a função do controller
// correspondente (src/controllers/locacao.controller.ts). Nenhuma regra de
// negócio, validação de dados ou acesso ao banco (Prisma) deve aparecer
// aqui — isso é responsabilidade exclusiva dos services, chamados pelos
// controllers.
// ============================================================================

import { Router } from 'express';
import * as locacaoController from '../controllers/locacao.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

// Router é uma funcionalidade do Express que funciona como um "mini
// aplicativo": permite agrupar um conjunto de rotas relacionadas (aqui,
// todas as rotas de /api/locacoes) em um único arquivo isolado, que depois
// é montado no roteador principal do projeto (src/routes/index.ts).
const router = Router();

// RN04: TODAS as rotas deste arquivo exigem que o cliente esteja
// autenticado — não é possível abrir, listar, consultar, devolver ou
// cancelar uma locação sem um token JWT válido. Em vez de repetir
// "authMiddleware" como segundo argumento em cada uma das rotas abaixo,
// registamos o middleware uma única vez a nível de router com
// "router.use(...)". Assim, qualquer requisição que chegue a qualquer rota
// definida neste arquivo passa primeiro pelo authMiddleware, que valida o
// header Authorization e popula "req.user" (ou lança um erro 401 antes de a
// requisição sequer chegar ao controller).
router.use(authMiddleware);

// POST /api/locacoes
// Abre uma nova locação: valida se o veículo está 'Disponivel' e, em caso
// afirmativo, cria o contrato de locação e muda o veículo para 'Locado'
// (RN01), tudo dentro de uma transação no service.
router.post('/', locacaoController.abrir);

// GET /api/locacoes
// Lista as locações existentes (do cliente autenticado, conforme regra
// implementada no service/controller).
router.get('/', locacaoController.listar);

// GET /api/locacoes/:id
// Busca uma única locação pelo seu id, informado como parâmetro de rota.
router.get('/:id', locacaoController.buscarPorId);

// PATCH /api/locacoes/:id/devolver
// Registra a devolução do veículo: preenche dataDevolucaoReal, muda o
// statusContrato para 'Finalizado' e devolve o veículo ao status
// 'Disponivel' (RN02), tudo dentro de uma transação no service.
router.patch('/:id/devolver', locacaoController.devolver);

// PATCH /api/locacoes/:id/cancelar
// Cancela uma locação ativa: muda o statusContrato para 'Cancelado' e
// devolve o veículo ao status 'Disponivel' (extensão simétrica das regras
// de negócio), também dentro de uma transação no service.
router.patch('/:id/cancelar', locacaoController.cancelar);

// Exportação padrão (default export): o roteador principal do projeto
// (src/routes/index.ts) importa este "router" e o monta sob o prefixo
// '/api/locacoes', tornando todas as rotas acima acessíveis nesse caminho.
export default router;
