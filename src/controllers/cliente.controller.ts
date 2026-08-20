// ============================================================================
// cliente.controller.ts
// ----------------------------------------------------------------------------
// Camada de CONTROLLER da entidade Cliente. Um controller, na nossa arquitetura
// em camadas (rotas -> controllers -> services -> Prisma/banco de dados), tem
// uma responsabilidade bem limitada: ler os dados da requisição HTTP (corpo,
// parâmetros de URL, query string), repassá-los para a função de service
// correspondente (que concentra TODA a regra de negócio e o acesso ao banco de
// dados) e, por fim, devolver a resposta HTTP com o status code e o corpo (JSON)
// adequados. Nenhuma validação de regra de negócio ou chamada ao Prisma deve
// aparecer aqui.
// ============================================================================

import { Request, Response } from 'express';
import * as clienteService from '../services/cliente.service';

/**
 * criar
 * ----------------------------------------------------------------------------
 * Rota pública de cadastro de um novo Cliente (não exige autenticação, afinal
 * o usuário ainda não tem conta para se autenticar).
 *
 * req.body é o objeto com os dados enviados no CORPO da requisição HTTP (por
 * exemplo, em um POST feito com Content-Type: application/json). O Express,
 * graças ao middleware express.json() configurado em src/app.ts, já converte
 * esse corpo em um objeto JavaScript comum, que conseguimos desestruturar
 * normalmente.
 */
export async function criar(req: Request, res: Response): Promise<void> {
  // Extraímos do corpo da requisição exatamente os campos que o cliente
  // precisa enviar para se cadastrar.
  const { nome, cpf, email, senha, telefone } = req.body;

  // Toda a lógica de negócio (validar duplicidade de CPF/email, aplicar hash
  // na senha, persistir no banco através do Prisma etc.) fica no service.
  // O controller apenas repassa os dados recebidos.
  const clienteCriado = await clienteService.criarCliente({
    nome,
    cpf,
    email,
    senha,
    telefone,
  });

  // res.status() define o código de status HTTP da resposta e res.json()
  // serializa o objeto passado como argumento em JSON, enviando-o no corpo
  // da resposta. Usamos 201 (Created), o código correto para indicar que um
  // novo recurso (o Cliente) foi criado com sucesso no servidor.
  res.status(201).json(clienteCriado);
}

/**
 * listar
 * ----------------------------------------------------------------------------
 * Rota protegida (exige passar pelo authMiddleware antes de chegar aqui) que
 * devolve a lista de todos os clientes cadastrados.
 *
 * O parâmetro da requisição chama-se "_req" (com underscore) por convenção:
 * indicamos assim que o parâmetro existe (a assinatura de um controller do
 * Express sempre recebe req e res), mas que ele não é utilizado dentro desta
 * função específica, evitando avisos do linter sobre variável não usada.
 */
export async function listar(_req: Request, res: Response): Promise<void> {
  const clientes = await clienteService.listarClientes();

  // 200 (OK) é o status HTTP padrão para uma operação de leitura bem-sucedida.
  res.status(200).json(clientes);
}

/**
 * buscarPorId
 * ----------------------------------------------------------------------------
 * Rota protegida que devolve os dados de um único cliente, identificado pelo
 * id informado na própria URL (ex.: GET /api/clientes/5).
 */
export async function buscarPorId(req: Request, res: Response): Promise<void> {
  // req.params é o objeto que contém os parâmetros dinâmicos definidos na rota
  // (por exemplo, a rota "/clientes/:id" faz o Express popular req.params.id
  // com o trecho correspondente da URL requisitada). É importante lembrar que
  // TODO valor vindo de req.params chega sempre como string, mesmo quando
  // representa um número — por isso convertemos explicitamente com Number()
  // antes de usá-lo para buscar no banco de dados, que espera um id numérico.
  const id = Number(req.params.id);

  const cliente = await clienteService.buscarClientePorId(id);

  res.status(200).json(cliente);
}
