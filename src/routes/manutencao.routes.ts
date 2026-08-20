// ============================================================================
// src/routes/manutencao.routes.ts
// ----------------------------------------------------------------------------
// Este arquivo pertence à camada de ROTAS da arquitetura em camadas do
// projeto (routes -> controllers -> services -> Prisma/banco de dados).
// A responsabilidade de um arquivo de rotas é APENAS mapear um verbo HTTP +
// um caminho (endpoint) para a função de controller correspondente, além de
// declarar quais middlewares (como autenticação) protegem cada rota. Nenhuma
// regra de negócio, validação ou acesso ao banco deve aparecer aqui — isso
// fica a cargo dos controllers e, principalmente, dos services.
// ============================================================================

import { Router } from 'express';

// Importamos TODAS as funções exportadas pelo controller de manutenção de
// uma só vez, usando "* as manutencaoController". Assim, cada rota abaixo
// referencia a função pelo nome (ex.: manutencaoController.registrar), o que
// deixa claro, só de olhar para este arquivo, qual controller é responsável
// por cada endpoint.
import * as manutencaoController from '../controllers/manutencao.controller';

// authMiddleware é o middleware responsável por verificar se a requisição
// possui um token JWT válido no cabeçalho Authorization (formato
// "Bearer <token>"). Caso o token seja válido, ele injeta os dados do
// cliente autenticado em req.user (ver src/@types/express.d.ts). Caso não
// seja válido (ou não exista), o middleware lança um AppError com status
// 401, interrompendo a requisição antes que ela chegue ao controller.
import { authMiddleware } from '../middlewares/auth.middleware';

// Router() cria uma "mini aplicação" Express dedicada exclusivamente às
// rotas de manutenção. Ela será importada pelo agregador central de rotas
// (src/routes/index.ts) e montada sob o prefixo '/api/manutencoes' em
// src/app.ts, de modo que as rotas abaixo ficam acessíveis, por exemplo, em
// POST /api/manutencoes.
const router = Router();

// RN04: todas as rotas de manutenção exigem um cliente autenticado.
// router.use(authMiddleware) aplica o middleware a TODAS as rotas
// declaradas neste arquivo, sem precisar repeti-lo em cada uma delas
// individualmente. Assim, qualquer requisição que chegue às rotas abaixo já
// passou pela validação do token JWT antes de chegar ao controller.
router.use(authMiddleware);

// POST /api/manutencoes
// Registra uma nova manutenção para um veículo. Segundo a RN03, só é
// possível registrar manutenção se o veículo NÃO estiver com
// statusDisponibilidade igual a 'Locado'. Ao ser registrada, o veículo
// passa (ou permanece) com statusDisponibilidade 'Manutencao'. Toda essa
// regra é validada dentro do service, não aqui.
router.post('/', manutencaoController.registrar);

// GET /api/manutencoes
// Lista as manutenções cadastradas (podendo aceitar filtros via
// query string, como veiculoId, tratados dentro do controller/service).
router.get('/', manutencaoController.listar);

// PATCH /api/manutencoes/:id/concluir
// Marca uma manutenção como concluída. Como extensão simétrica das regras
// de negócio do domínio, concluir uma manutenção devolve o veículo ao
// status 'Disponivel', liberando-o novamente para novas locações.
router.patch('/:id/concluir', manutencaoController.concluir);

// Exportação padrão (default) do router, conforme a convenção do projeto
// para arquivos de rotas: cada arquivo de rotas exporta um único Router do
// Express como "export default router".
export default router;
