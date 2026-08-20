// ============================================================================
// src/routes/index.ts
//
// Este arquivo é o "índice" (arquivo agregador) de rotas da DriveRent API.
// Sua única responsabilidade é IMPORTAR os roteadores especializados de cada
// entidade do domínio (auth, clientes, veículos, locações, manutenções) e
// registrá-los sob o seu respectivo prefixo, dentro de um único Router do
// Express. Esse Router combinado é então montado em src/app.ts sob o prefixo
// comum '/api' (ex.: '/auth' aqui vira '/api/auth' na URL final).
//
// Isso mantém a arquitetura em camadas organizada: cada arquivo de rotas cuida
// apenas do "endereço" das requisições, delegando toda a lógica para os
// controllers e services correspondentes.
// ============================================================================

import { Router } from 'express';

// Importamos o Router "default" exportado por cada arquivo de rotas específico
// de cada entidade do domínio. Cada um deles já define seus próprios
// endpoints (GET, POST, PUT, DELETE) e, quando necessário, aplica o
// authMiddleware nas rotas que exigem autenticação.
import authRoutes from './auth.routes';
import clienteRoutes from './cliente.routes';
import veiculoRoutes from './veiculo.routes';
import locacaoRoutes from './locacao.routes';
import manutencaoRoutes from './manutencao.routes';

// Criamos um único Router do Express que vai agregar (combinar) todos os
// roteadores importados acima. É esse "routes" que será exportado e usado
// em src/app.ts.
const routes = Router();

// Cada chamada a "routes.use(prefixo, roteador)" diz ao Express: "toda
// requisição cujo caminho comece com este prefixo deve ser encaminhada para
// este roteador específico". Assim, por exemplo, uma requisição para
// '/api/clientes/1' primeiro passa pelo prefixo '/api' (definido em app.ts)
// e depois é entregue a clienteRoutes, que trata o restante do caminho
// ('/1') internamente.
routes.use('/auth', authRoutes);
routes.use('/clientes', clienteRoutes);
routes.use('/veiculos', veiculoRoutes);
routes.use('/locacoes', locacaoRoutes);
routes.use('/manutencoes', manutencaoRoutes);

// Exportação nomeada (não "default"), pois src/app.ts já importa este
// arquivo com "import { routes } from './routes' ".
export { routes };
