// ============================================================================
// src/routes/veiculo.routes.ts
// ----------------------------------------------------------------------------
// Camada de ROTAS do módulo Veiculo. É aqui que definimos QUAIS URLs existem
// (dentro do prefixo '/api/veiculos', montado em src/routes/index.ts) e QUAL
// controller trata cada uma delas. Rotas de leitura (listar/buscar) fazem
// parte do catálogo público de veículos e não exigem autenticação; rotas que
// criam ou alteram veículos são protegidas pelo authMiddleware, pois apenas
// clientes autenticados (nesta aplicação didática) podem administrá-los.
// Nenhuma regra de negócio é implementada aqui — este arquivo apenas liga
// "método HTTP + caminho" a uma função do controller correspondente.
// ============================================================================

import { Router } from 'express';
import * as veiculoController from '../controllers/veiculo.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

// Criamos uma instância de Router do Express. Um Router funciona como um
// "mini aplicativo" Express: agrupamos aqui todas as rotas relacionadas a
// Veiculo e depois exportamos esse router para ser montado no arquivo
// central de rotas (src/routes/index.ts) sob o prefixo '/api/veiculos'.
const router = Router();

// GET /api/veiculos
// Rota PÚBLICA — faz parte do catálogo de veículos disponíveis para consulta.
// Qualquer visitante (mesmo sem estar autenticado) pode listar os veículos,
// para poder navegar no catálogo antes de decidir alugar.
router.get('/', veiculoController.listar);

// GET /api/veiculos/:id
// Rota PÚBLICA — faz parte do catálogo. Permite consultar os detalhes de um
// único veículo pelo seu id, sem exigir autenticação.
router.get('/:id', veiculoController.buscarPorId);

// POST /api/veiculos
// Rota PROTEGIDA — exige um cliente autenticado (authMiddleware valida o
// token JWT enviado no header Authorization antes de liberar o acesso ao
// controller). Usada para cadastrar um novo veículo no sistema.
router.post('/', authMiddleware, veiculoController.criar);

// PUT /api/veiculos/:id
// Rota PROTEGIDA — exige um cliente autenticado. Usada para atualizar os
// dados de um veículo já cadastrado.
router.put('/:id', authMiddleware, veiculoController.atualizar);

// Exportamos o router como export default, conforme a convenção do projeto
// para arquivos de rotas: cada arquivo de rotas expõe um único Router do
// Express, que é importado e montado no agregador central de rotas.
export default router;
