// ============================================================================
// Controller de Manutenção
// ----------------------------------------------------------------------------
// Nesta arquitetura em camadas (rotas -> controllers -> services -> Prisma/BD),
// o controller é a "porta de entrada" HTTP: ele só sabe ler dados da requisição
// (req) e devolver uma resposta (res). Toda a regra de negócio (validações,
// cálculos, mudanças de status do veículo, acesso ao banco de dados) vive no
// service correspondente (manutencao.service.ts), nunca aqui.
// ============================================================================

import { Request, Response } from 'express';
import * as manutencaoService from '../services/manutencao.service';

/**
 * Registra uma nova manutenção para um veículo.
 *
 * req.body: é o objeto com os dados enviados pelo cliente no corpo da
 * requisição HTTP (por exemplo, em uma requisição POST com Content-Type
 * application/json). O middleware express.json() (configurado em app.ts)
 * é responsável por transformar o JSON recebido em um objeto JavaScript
 * acessível através de req.body.
 */
export async function registrar(req: Request, res: Response): Promise<void> {
  // Extraímos do corpo da requisição os dados necessários para registrar
  // a manutenção. A validação de negócio (ex.: veículo não pode estar
  // 'Locado') fica inteiramente a cargo do service.
  const { veiculoId, descricaoServico, valorCusto } = req.body;

  const manutencao = await manutencaoService.registrarManutencao({
    veiculoId,
    descricaoServico,
    valorCusto,
  });

  // res.status(codigo): define o código de status HTTP da resposta.
  // res.json(objeto): serializa o objeto passado como JSON e o envia como
  // corpo da resposta, encerrando a requisição.
  // Usamos 201 (Created) porque um novo recurso (a manutenção) foi criado.
  res.status(201).json(manutencao);
}

/**
 * Lista todas as manutenções registradas no sistema.
 *
 * O parâmetro é nomeado "_req" (com underscore) para deixar claro, por
 * convenção, que ele não é utilizado dentro desta função — aqui não
 * precisamos ler nada da requisição, apenas devolver os dados.
 */
export async function listar(_req: Request, res: Response): Promise<void> {
  const manutencoes = await manutencaoService.listarManutencoes();

  // 200 (OK) é o código padrão para uma operação de leitura bem-sucedida.
  res.status(200).json(manutencoes);
}

/**
 * Conclui uma manutenção em andamento, devolvendo o veículo ao status
 * 'Disponivel'.
 *
 * req.params: é o objeto com os parâmetros dinâmicos capturados a partir
 * da própria URL da rota (por exemplo, em uma rota definida como
 * '/manutencoes/:id', o valor da URL correspondente à posição ":id" fica
 * disponível em req.params.id). Esse valor sempre chega como string, por
 * isso convertemos explicitamente para número com Number(...).
 */
export async function concluir(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);

  const veiculo = await manutencaoService.concluirManutencao(id);

  res.status(200).json({
    mensagem: 'Manutenção concluída, veículo disponível novamente.',
    veiculo,
  });
}
