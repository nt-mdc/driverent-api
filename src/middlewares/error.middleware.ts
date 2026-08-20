// ============================================================================
// src/middlewares/error.middleware.ts
//
// Responsabilidade deste arquivo dentro da arquitetura em camadas:
// Este é o middleware de tratamento de erros GLOBAL da aplicação. Ele define
// a classe "AppError" (usada por todos os services/controllers para sinalizar
// erros de regra de negócio, "não encontrado", "conflito", etc.) e a função
// "errorHandler", que é registada por último em src/app.ts. É aqui, e SÓ
// aqui, que decidimos o formato final da resposta de erro enviada ao cliente
// da API, evitando que cada controller precise de try/catch repetido.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

/**
 * AppError representa um erro "esperado" da aplicação — ou seja, uma
 * situação que a nossa própria regra de negócio identificou como inválida
 * (ex.: "veículo já está locado", "cliente não encontrado", "credenciais
 * inválidas"). Ao invés de cada service devolver códigos de erro manualmente
 * ou fazer res.status(...).json(...) diretamente (o que violaria a separação
 * de camadas, já que services não devem conhecer o objeto "res" do Express),
 * o service simplesmente lança (throw) uma instância de AppError com a
 * mensagem e o código HTTP apropriado. Graças à biblioteca
 * 'express-async-errors' (importada uma única vez em src/app.ts), esse throw
 * — mesmo dentro de uma função async — é automaticamente capturado pelo
 * Express e encaminhado para o errorHandler abaixo.
 */
export class AppError extends Error {
  // "statusCode" é pública e somente leitura: uma vez criado o erro, o
  // código HTTP associado a ele não deve ser alterado por quem o recebe.
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    // Chama o construtor da classe nativa "Error", que atribui a mensagem
    // à propriedade "message" e monta o stack trace corretamente.
    super(message);

    this.statusCode = statusCode;

    // Ajustamos o "name" do erro para "AppError" (em vez do padrão "Error").
    // Isso ajuda muito na leitura de logs no terminal, pois deixa claro que
    // se trata de um erro "esperado" da nossa aplicação, e não uma exceção
    // inesperada (ex.: um bug ou uma falha de infraestrutura).
    this.name = 'AppError';
  }
}

/**
 * errorHandler é o middleware de tratamento de erros centralizado da API.
 *
 * Por que centralizar o tratamento de erros num único lugar?
 * 1) Evita repetir blocos try/catch em todos os controllers e services —
 *    basta lançar (throw) o erro em qualquer ponto da aplicação que ele
 *    "sobe" naturalmente até aqui.
 * 2) Evita vazar detalhes internos sensíveis (como a stack trace de um erro
 *    do banco de dados, nomes de tabelas/colunas, ou caminhos de arquivos do
 *    servidor) para quem está a consumir a API — informação que poderia ser
 *    usada de forma maliciosa por um atacante.
 * 3) Padroniza o formato de erro em toda a aplicação: não importa em que
 *    parte do sistema o erro aconteceu, o cliente da API sempre recebe o
 *    mesmo formato de resposta: { erro: "mensagem legível" }.
 *
 * Repare que esta função tem EXATAMENTE 4 parâmetros (err, req, res, next).
 * Essa é a assinatura especial que o Express usa para reconhecer uma função
 * como "middleware de tratamento de erros" — mesmo que "next" não seja
 * utilizado no corpo da função, ele precisa continuar presente na
 * assinatura, senão o Express trataria esta função como um middleware
 * comum (de rota), e ela nunca seria chamada quando um erro ocorresse.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Caso 1: o erro é um AppError, ou seja, um erro "esperado" que a nossa
  // própria aplicação identificou (regra de negócio violada, recurso não
  // encontrado, credenciais inválidas, etc.). Nesse caso, já sabemos
  // exatamente qual mensagem e qual código HTTP devolver ao cliente.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message });
    return;
  }

  // Caso 2: o erro veio do Prisma Client e é um erro "conhecido" (isto é,
  // o Prisma consegue identificar exatamente que tipo de problema ocorreu
  // ao interagir com o banco de dados — ex.: violação de uma constraint
  // única, ou tentativa de atualizar/excluir um registo que não existe).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = violação de restrição única (unique constraint). Acontece,
    // por exemplo, ao tentar cadastrar um Cliente com um CPF ou e-mail que
    // já existe, ou um Veiculo com uma placa já cadastrada.
    if (err.code === 'P2002') {
      res.status(409).json({
        erro:
          'Já existe um registo com um valor único em conflito (ex.: CPF, e-mail ou placa duplicados).',
      });
      return;
    }

    // P2025 = operação falhou porque o registo esperado não foi encontrado
    // no banco de dados (ex.: tentar atualizar ou excluir um registo cujo
    // id não existe mais).
    if (err.code === 'P2025') {
      res.status(404).json({ erro: 'Registo não encontrado.' });
      return;
    }
  }

  // Caso 3: qualquer outro erro não esperado (um bug no código, uma falha
  // de conexão com o banco, etc.). Registamos o erro completo no console do
  // servidor — isso é fundamental para que o desenvolvedor consiga
  // diagnosticar o problema real durante o desenvolvimento e em produção —,
  // mas devolvemos ao cliente da API apenas uma mensagem genérica. NUNCA
  // expomos err.message ou err.stack diretamente na resposta HTTP, pois
  // isso poderia revelar detalhes internos da nossa infraestrutura (nomes
  // de tabelas, caminhos de arquivos, versões de bibliotecas, etc.) a
  // qualquer pessoa que esteja a consumir a API.
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
}
