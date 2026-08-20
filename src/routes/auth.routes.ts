// Este arquivo concentra as ROTAS de autenticação da API DriveRent.
// Na arquitetura em camadas do projeto (rotas -> controllers -> services -> Prisma/banco),
// esta camada é responsável apenas por mapear um verbo HTTP + caminho para a função de
// controller correspondente. Nenhuma regra de negócio, validação ou acesso ao banco de
// dados deve aparecer aqui — isso fica a cargo de 'auth.controller' e do respetivo service.

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';

// Cada arquivo de rotas cria a sua própria instância de Router do Express.
// Este router é depois importado e agregado pelo arquivo central de rotas (src/routes/index.ts),
// que o monta sob o prefixo '/api' (definido em src/app.ts). Ou seja, o caminho completo
// de todas as rotas registadas aqui é '/api/auth/...'.
const router = Router();

// POST /api/auth/login
// Rota PÚBLICA (não passa pelo authMiddleware): é exatamente aqui que um cliente ainda
// sem token de acesso troca as suas credenciais (email + senha) por um token JWT válido,
// que passará a usar no header "Authorization: Bearer <token>" nas próximas requisições
// a rotas protegidas.
router.post('/login', authController.login);

// Exportação padrão (default export) do router, conforme a convenção do projeto: cada
// arquivo de rotas exporta o seu Router como "export default router;" para ser
// importado e agregado no arquivo central de rotas.
export default router;
