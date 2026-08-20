// ============================================================================
// veiculo.controller.ts
// ----------------------------------------------------------------------------
// Camada de CONTROLLER da entidade Veiculo, dentro da arquitetura em camadas
// do DriveRent API (Rotas -> Controllers -> Services -> Prisma/Banco de Dados).
// Um controller NUNCA contém regra de negócio nem acesso direto ao Prisma:
// a única responsabilidade dele é (1) ler os dados que chegaram na requisição
// HTTP (body, params, query), (2) repassar esses dados ao service adequado,
// e (3) devolver a resposta HTTP (status + JSON) com o resultado. Toda a
// lógica de validação, regras de negócio (RN01, RN03 etc.) e chamadas ao
// Prisma ficam concentradas em 'src/services/veiculo.service.ts'.
// ============================================================================

import { Request, Response } from 'express';
import * as veiculoService from '../services/veiculo.service';

/**
 * POST /api/veiculos
 * Rota PROTEGIDA (passa antes pelo authMiddleware) — cadastra um novo veículo
 * na frota do DriveRent.
 *
 * 'req' (Request) representa a requisição HTTP recebida pelo Express, e 'res'
 * (Response) representa a resposta que este controller vai construir e enviar
 * de volta ao cliente (navegador, app mobile, Postman etc.).
 *
 * 'req.body' é o corpo (payload) da requisição HTTP, já convertido de JSON
 * para um objeto JavaScript pelo middleware 'express.json()' (registado em
 * src/app.ts). É nele que o cliente da API envia os dados do novo veículo.
 */
export async function criar(req: Request, res: Response): Promise<void> {
  // Desestruturamos do corpo da requisição exatamente os campos que o
  // cliente da API deve enviar para criar um veículo.
  const { categoriaId, placa, modelo, ano } = req.body;

  // Toda a validação (categoria existe? placa já está em uso? tipos corretos?)
  // e a chamada ao Prisma acontecem dentro do service — o controller apenas
  // repassa os dados recebidos.
  const veiculoCriado = await veiculoService.criarVeiculo({
    categoriaId,
    placa,
    modelo,
    ano,
  });

  // 'res.status(codigo)' define o código de status HTTP da resposta, e
  // '.json(objeto)' serializa o objeto JavaScript recebido como JSON e o
  // envia como corpo da resposta. Usamos 201 (Created) porque um novo
  // recurso (o veículo) acabou de ser criado com sucesso no banco de dados.
  res.status(201).json(veiculoCriado);
}

/**
 * GET /api/veiculos
 * Rota PÚBLICA — lista o catálogo de veículos, com filtro opcional por
 * disponibilidade (ex.: GET /api/veiculos?disponibilidade=Disponivel).
 */
export async function listar(req: Request, res: Response): Promise<void> {
  // 'req.query' contém os parâmetros de query string da URL da requisição,
  // ou seja, tudo o que vem depois do "?" no endereço (ex.: na URL
  // "/api/veiculos?disponibilidade=Disponivel", req.query seria o objeto
  // { disponibilidade: "Disponivel" }). Como qualquer valor vindo de
  // req.query é, por padrão, do tipo "string | string[] | ParsedQs | ..."
  // (o Express não sabe qual é o formato exato), fazemos um cast explícito
  // para "string | undefined": string quando o filtro foi informado na URL,
  // e undefined quando o cliente não passou nenhum filtro de disponibilidade.
  const disponibilidade = req.query.disponibilidade as string | undefined;

  const veiculos = await veiculoService.listarVeiculos(disponibilidade);

  // 200 (OK) é o status padrão para uma leitura bem-sucedida.
  res.status(200).json(veiculos);
}

/**
 * GET /api/veiculos/:id
 * Rota PÚBLICA — busca os detalhes de um único veículo pelo seu id.
 */
export async function buscarPorId(req: Request, res: Response): Promise<void> {
  // 'req.params' contém os parâmetros dinâmicos definidos na rota (o trecho
  // ":id" na definição da rota, ex.: '/veiculos/:id'). Esses parâmetros
  // chegam sempre como texto (string), por isso convertemos explicitamente
  // para número com "Number(...)" antes de repassar ao service, já que o
  // campo "id" do model Veiculo no Prisma é do tipo Int.
  const id = Number(req.params.id);

  const veiculo = await veiculoService.buscarVeiculoPorId(id);

  res.status(200).json(veiculo);
}

/**
 * PUT /api/veiculos/:id
 * Rota PROTEGIDA — atualiza os dados de um veículo já cadastrado (ex.:
 * modelo, ano, categoria ou statusDisponibilidade).
 */
export async function atualizar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);

  // Repassamos o corpo inteiro da requisição (req.body) ao service, que é
  // quem sabe exatamente quais campos são permitidos de serem atualizados
  // e quais validações de negócio devem ser aplicadas antes de gravar no
  // banco de dados através do Prisma.
  const veiculoAtualizado = await veiculoService.atualizarVeiculo(id, req.body);

  // 200 (OK) é o status apropriado para uma atualização bem-sucedida (o
  // recurso já existia e apenas teve seus dados alterados).
  res.status(200).json(veiculoAtualizado);
}
