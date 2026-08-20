// ============================================================================
// src/middlewares/auth.middleware.ts
// ----------------------------------------------------------------------------
// Este middleware é responsável exclusivamente por PROTEGER rotas privadas da
// API, garantindo que só passam adiante (para os controllers) requisições que
// tragam um token JWT válido. Ele não conhece regras de negócio de Cliente,
// Locacao, Veiculo, etc. — a sua única responsabilidade é autenticação.
//
// Conceito de autenticação "stateless" (sem estado):
// O DriveRent API usa JWT (JSON Web Token) para autenticação. Isso significa
// que o servidor NÃO guarda nenhuma sessão em memória nem em base de dados
// dizendo "o cliente X está logado". Em vez disso, no momento do login,
// geramos um token assinado digitalmente contendo os dados necessários para
// identificar o cliente (id e email). Esse token é devolvido ao cliente
// (front-end/app), que passa a enviá-lo em toda requisição futura, dentro do
// cabeçalho HTTP "Authorization". Como o token é assinado com uma chave
// secreta (process.env.JWT_SECRET) que só o servidor conhece, é possível
// verificar, a qualquer momento e sem consultar nenhuma tabela de "sessões",
// se o token é autêntico (não foi adulterado) e ainda está dentro do prazo de
// validade. Por isso dizemos que a autenticação é "stateless": toda a
// informação necessária para validar quem está a fazer o pedido já vem
// embutida no próprio token, e o servidor não precisa de "lembrar" nada sobre
// quem fez login.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

// Formato esperado do "payload" (conteúdo) que foi codificado dentro do token
// no momento em que ele foi gerado, durante o login do cliente. É exatamente
// o mesmo formato de objeto que assinamos com jwt.sign({ id, email }, ...) no
// service de autenticação — por isso, ao decodificar o token aqui, esperamos
// receber de volta um objeto com esse mesmo formato.
interface TokenPayload {
  id: number;
  email: string;
}

/**
 * Middleware de autenticação.
 *
 * Um "middleware" no Express é simplesmente uma função que recebe a
 * requisição (req), a resposta (res) e uma função "next" que, quando chamada,
 * repassa o controlo para o próximo middleware ou controller da cadeia. Se
 * "next()" nunca for chamado, a requisição fica "presa" nesse middleware e
 * nunca chega ao controller — é exatamente isso que usamos a nosso favor
 * aqui: se o token for inválido, nós lançamos um erro (throw) em vez de
 * chamar next(), interrompendo o fluxo antes de alcançar rotas protegidas.
 *
 * Como o projeto usa a biblioteca 'express-async-errors' (importada em
 * src/app.ts), mesmo lançando exceções de forma síncrona (com "throw") dentro
 * deste middleware, o Express consegue capturá-las automaticamente e
 * encaminhá-las para o middleware global de tratamento de erros
 * (errorHandler), que devolve ao cliente uma resposta JSON no formato
 * { erro: "mensagem" } com o código HTTP apropriado.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // -----------------------------------------------------------------------
  // PASSO 1: ler o cabeçalho HTTP "Authorization".
  // -----------------------------------------------------------------------
  // Cabeçalhos HTTP (headers) são metadados enviados junto com a requisição,
  // separados do corpo (body). O cabeçalho "Authorization" é o local padrão
  // da web para transportar credenciais de autenticação. A convenção mais
  // usada para tokens é o esquema "Bearer", em que o valor do cabeçalho tem
  // o formato:
  //
  //   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  //
  // A palavra "Bearer" (em inglês, "portador") indica que quem apresenta este
  // token é considerado automaticamente autorizado a agir como o dono dele —
  // por isso o token deve ser mantido em segredo pelo cliente da API, assim
  // como uma senha.
  //
  // Se o cabeçalho Authorization simplesmente não existir na requisição,
  // significa que o cliente não tentou se autenticar, e barramos o acesso
  // imediatamente com um erro 401 (Não Autorizado).
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Token não fornecido.', 401);
  }

  // -----------------------------------------------------------------------
  // PASSO 2: validar o formato "Bearer <token>".
  // -----------------------------------------------------------------------
  // O valor do cabeçalho vem como uma única string, por exemplo:
  //   "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  //
  // Usamos o método split(' ') para dividir essa string em partes, usando o
  // espaço em branco como separador. O resultado é um array com (esperamos)
  // exatamente dois elementos:
  //   ['Bearer', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...']
  //
  // Se o cabeçalho não seguir esse formato — por exemplo, vier apenas o
  // token sem a palavra "Bearer", ou vier com espaços extras/faltando —,
  // consideramos que o token está "mal formatado" e recusamos a requisição.
  const partes = authHeader.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    throw new AppError('Token mal formatado. Utilize o formato: Bearer <token>.', 401);
  }

  // -----------------------------------------------------------------------
  // PASSO 3: extrair o token propriamente dito (a segunda parte do array).
  // -----------------------------------------------------------------------
  const token = partes[1];

  // -----------------------------------------------------------------------
  // PASSO 4 e 5: verificar a assinatura e validade do token.
  // -----------------------------------------------------------------------
  // jwt.verify(token, segredo) faz duas coisas ao mesmo tempo:
  //   1) Recalcula a assinatura criptográfica do token usando o segredo
  //      informado (process.env.JWT_SECRET) e confere se ela bate com a
  //      assinatura que veio dentro do próprio token. Esse é o mesmo segredo
  //      usado para ASSINAR o token no momento do login (jwt.sign). Se
  //      alguém tentar adulterar o conteúdo do token (por exemplo, trocar o
  //      "id" do cliente manualmente) sem conhecer o segredo, a assinatura
  //      deixa de bater e a verificação falha.
  //   2) Confere se o token já não expirou, comparando a data atual com o
  //      tempo de expiração que foi definido no momento em que o token foi
  //      assinado (process.env.JWT_EXPIRES_IN, com fallback '1d').
  //
  // Se qualquer uma dessas verificações falhar, jwt.verify lança uma exceção
  // (por isso colocamos a chamada dentro de um bloco try/catch). Se tudo
  // estiver correto, jwt.verify devolve o "payload" — ou seja, os dados que
  // foram colocados dentro do token no momento em que ele foi assinado
  // durante o login: exatamente { id: cliente.id, email: cliente.email }.
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;

    // Injetamos os dados do cliente autenticado diretamente no objeto "req"
    // (a requisição), na propriedade "user". Isso permite que, mais adiante
    // na cadeia de middlewares/controllers, qualquer código tenha acesso a
    // "req.user.id" e "req.user.email" sem precisar decodificar o token de
    // novo. O tipo de "req.user" é declarado globalmente em
    // 'src/@types/express.d.ts', estendendo a interface Request do Express.
    req.user = { id: payload.id, email: payload.email };
  } catch {
    // Qualquer falha na verificação (assinatura inválida, token expirado,
    // token corrompido, etc.) cai aqui. Não expomos ao cliente o motivo
    // técnico exato da falha — apenas informamos que o token é inválido ou
    // expirado, com o código HTTP 401 (Não Autorizado).
    throw new AppError('Token inválido ou expirado.', 401);
  }

  // -----------------------------------------------------------------------
  // PASSO 6: tudo certo — repassa o controlo para o próximo middleware ou
  // para o controller da rota protegida.
  // -----------------------------------------------------------------------
  next();
}
