// ============================================================================
// src/@types/express.d.ts
//
// Responsabilidade deste arquivo dentro da arquitetura em camadas:
// Este arquivo NÃO contém lógica de negócio nem código executável em tempo
// de execução — ele é um arquivo de "declaração de tipos" (.d.ts) usado
// apenas pelo compilador TypeScript. Sua função é ENSINAR o TypeScript a
// entender que, a partir do nosso middleware de autenticação
// (src/middlewares/auth.middleware.ts), o objeto "req" (Request) do Express
// passa a carregar também uma propriedade "user" com os dados do cliente
// autenticado. Sem esta declaração, qualquer controller que tentasse ler
// "req.user" receberia um erro de compilação, pois o Express não conhece
// esse campo por padrão.
// ============================================================================

// Precisamos importar 'express' aqui (mesmo sem usar diretamente nenhum
// símbolo importado) para que este arquivo seja tratado pelo TypeScript
// como um MÓDULO (e não como um "script global" solto). Isso é obrigatório
// para que o bloco "declare global { ... }" abaixo funcione corretamente:
// só é possível "aumentar" (fazer "module augmentation" / "declaration
// merging") um namespace global a partir de dentro de um módulo.
import 'express';

// "declare global" nos permite adicionar/ampliar tipos que já existem
// globalmente no projeto (neste caso, os tipos do pacote 'express'),
// sem precisar editar o código-fonte da própria biblioteca Express
// (que fica dentro de node_modules e não deve ser alterado).
declare global {
  // O Express organiza seus tipos dentro do namespace "Express".
  // Ao reabrir esse mesmo namespace aqui, o TypeScript faz um "merge"
  // (mistura) da nossa interface "Request" com a interface "Request"
  // original definida pelo Express, em vez de substituí-la. Ou seja,
  // continuamos tendo todos os campos originais (req.body, req.params,
  // req.query, req.headers, etc.) e GANHAMOS também o campo "user".
  namespace Express {
    interface Request {
      // O campo é opcional (note o "?" em "user?") porque nem toda
      // requisição passa pelo authMiddleware. Rotas públicas — como o
      // cadastro de um novo cliente (POST /clientes) ou o login
      // (POST /clientes/login) — nunca preenchem req.user, pois ainda
      // não existe um cliente autenticado naquele momento. Já rotas
      // protegidas (por exemplo, criar uma locação) passam primeiro
      // pelo authMiddleware, que valida o token JWT enviado no header
      // Authorization e só então preenche req.user com os dados
      // extraídos do token, antes de chamar next() para o controller.
      //
      // Guardamos aqui exatamente o mesmo formato do payload assinado
      // no JWT no momento do login: { id: cliente.id, email: cliente.email }.
      user?: {
        id: number;
        email: string;
      };
    }
  }
}
