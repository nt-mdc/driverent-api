// ============================================================================
// src/controllers/auth.controller.ts
// ----------------------------------------------------------------------------
// Este arquivo pertence à camada de CONTROLLERS da arquitetura em camadas do
// DriveRent API. Um controller é responsável apenas por fazer a "ponte" entre
// o mundo HTTP (Express) e a camada de serviços (services): ele lê os dados
// que chegaram na requisição, delega toda a regra de negócio para o service
// correspondente e devolve a resposta ao cliente. Nenhuma lógica de negócio,
// validação de regra ou acesso direto ao Prisma deve existir aqui — isso é
// responsabilidade exclusiva de 'src/services/auth.service.ts'.
// ============================================================================

import { Request, Response } from 'express';
// Importamos todas as funções exportadas pelo service de autenticação como um
// único objeto "authService". Isso mantém o controller enxuto e deixa claro,
// na hora de ler o código, de onde vem cada função utilizada (authService.login).
import * as authService from '../services/auth.service';

/**
 * Controller responsável por autenticar um Cliente já cadastrado no sistema
 * (login). Recebe email e senha, delega a validação das credenciais e a
 * geração do token JWT para o authService, e devolve o resultado ao cliente
 * HTTP que fez a requisição.
 *
 * Rota esperada: POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<Response> {
  // "req" (request) representa a requisição HTTP recebida pelo servidor.
  // "req.body" é o CORPO da requisição — ou seja, os dados que o cliente
  // (por exemplo, um formulário de login no front-end) enviou junto do
  // pedido. Como o middleware "express.json()" já foi registado em
  // 'src/app.ts' antes das rotas, o Express converte automaticamente o JSON
  // recebido em texto puro para um objeto JavaScript comum, permitindo que
  // façamos desestruturação diretamente das propriedades que nos interessam.
  const { email, senha } = req.body;

  // Toda a lógica de negócio (buscar o cliente pelo email, comparar a senha,
  // gerar o token JWT, etc.) fica encapsulada no service. O controller apenas
  // repassa os dados de entrada e aguarda o resultado.
  const resultado = await authService.login({ email, senha });

  // "res" (response) representa a resposta HTTP que este servidor vai enviar
  // de volta ao cliente que fez a requisição.
  // "res.status(200)" define o código de status HTTP da resposta — 200
  // significa "OK", ou seja, a requisição foi processada com sucesso.
  // "res.json(resultado)" serializa o objeto JavaScript "resultado" (que
  // contém, por exemplo, o token JWT e os dados públicos do cliente) para o
  // formato JSON, envia esse JSON como corpo da resposta e define
  // automaticamente o cabeçalho HTTP "Content-Type: application/json".
  return res.status(200).json(resultado);
}
