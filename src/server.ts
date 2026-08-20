// ============================================================================
// SERVER.TS - Ponto de entrada da aplicação
// ============================================================================
// Este é o arquivo que efetivamente "liga" o servidor HTTP, colocando-o
// para escutar requisições numa porta TCP. Mantemos essa responsabilidade
// separada do app.ts para deixar a configuração do Express reutilizável
// (por exemplo, em testes automatizados que não precisam abrir uma porta).
// ============================================================================

// Carrega as variáveis definidas no arquivo ".env" para dentro de
// "process.env". Isto precisa acontecer ANTES de importarmos o "app",
// porque módulos como o Prisma Client leem "process.env.DATABASE_URL"
// assim que são carregados.
import 'dotenv/config';

import { app } from './app';

// A porta é lida da variável de ambiente PORT (definida no .env). Caso ela
// não exista, usamos 3333 como valor padrão para não quebrar a aplicação.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

app.listen(PORT, () => {
  console.log('==========================================================');
  console.log(`🚗  DriveRent API rodando em http://localhost:${PORT}`);
  console.log(`📚  Recursos disponíveis em http://localhost:${PORT}/api`);
  console.log('==========================================================');
});
