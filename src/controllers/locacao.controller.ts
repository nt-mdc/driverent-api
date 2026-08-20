// ============================================================================
// Controller de Locação
// ----------------------------------------------------------------------------
// Nesta arquitetura em camadas, o controller é a "porta de entrada" HTTP:
// ele conversa com o Express (lê a requisição, devolve a resposta) mas NÃO
// contém regra de negócio nem acessa o Prisma diretamente. Toda a validação,
// os cálculos e o acesso à base de dados ficam no service (locacao.service),
// que este controller apenas invoca. Assim mantemos cada camada com uma única
// responsabilidade, o que facilita testar e dar manutenção ao código.
//
// Todas as rotas de locação (definidas em src/routes/locacao.routes.ts) passam
// pelo authMiddleware ANTES de chegar até estas funções. O authMiddleware lê o
// token JWT do header Authorization, valida e injeta "req.user = { id, email }"
// na requisição. Por isso, aqui dentro, podemos usar "req.user!.id" com
// segurança: o "!" (non-null assertion) diz ao TypeScript "eu garanto que este
// valor não é undefined neste ponto" — e essa garantia existe porque, se
// req.user não estivesse preenchido, o próprio authMiddleware já teria lançado
// um erro 401 e a requisição nunca teria chegado até aqui.
// ============================================================================

import { Request, Response } from 'express';
import * as locacaoService from '../services/locacao.service';

// ----------------------------------------------------------------------------
// abrir
// ----------------------------------------------------------------------------
// Abre (cria) uma nova locação para o cliente autenticado.
//
// - req.body: é o objeto com os dados enviados pelo cliente no corpo da
//   requisição HTTP (formato JSON, já convertido em objeto JavaScript pelo
//   middleware express.json() configurado em src/app.ts). Aqui esperamos
//   receber { veiculoId, dataPrevistaDevolucao }.
// - req.user: propriedade injetada pelo authMiddleware com os dados do
//   cliente autenticado extraídos do token JWT.
export async function abrir(req: Request, res: Response): Promise<void> {
  // O id do cliente vem do token JWT (via authMiddleware), nunca do body,
  // para impedir que um cliente abra uma locação "em nome" de outro.
  const clienteId = req.user!.id;
  const { veiculoId, dataPrevistaDevolucao } = req.body;

  const novaLocacao = await locacaoService.abrirLocacao(clienteId, {
    veiculoId,
    dataPrevistaDevolucao,
  });

  // res.status(codigo): define o código de status HTTP da resposta.
  // res.json(objeto): serializa o objeto JavaScript para JSON e o envia como
  // corpo da resposta, já definindo o header Content-Type: application/json.
  // Usamos 201 (Created) porque um novo recurso (a locação) foi criado.
  res.status(201).json(novaLocacao);
}

// ----------------------------------------------------------------------------
// listar
// ----------------------------------------------------------------------------
// Lista todas as locações do cliente autenticado.
export async function listar(req: Request, res: Response): Promise<void> {
  const clienteId = req.user!.id;

  const locacoes = await locacaoService.listarLocacoesDoCliente(clienteId);

  // 200 (OK) é o status padrão para uma leitura bem-sucedida.
  res.status(200).json(locacoes);
}

// ----------------------------------------------------------------------------
// buscarPorId
// ----------------------------------------------------------------------------
// Busca uma locação específica, pertencente ao cliente autenticado, pelo id.
//
// - req.params: são os parâmetros dinâmicos extraídos diretamente da URL da
//   rota. Por exemplo, numa rota definida como "/locacoes/:id", ao acessar
//   "/locacoes/5" o Express preenche req.params.id com a string "5".
export async function buscarPorId(req: Request, res: Response): Promise<void> {
  // req.params.id chega sempre como string, por isso convertemos para número
  // com Number() antes de usar como identificador no Prisma.
  const id = Number(req.params.id);
  const clienteId = req.user!.id;

  const locacao = await locacaoService.buscarLocacaoPorId(id, clienteId);

  res.status(200).json(locacao);
}

// ----------------------------------------------------------------------------
// devolver
// ----------------------------------------------------------------------------
// Registra a devolução do veículo associado a uma locação, encerrando o
// contrato de aluguer.
//
// - req.query: seria usado para parâmetros opcionais enviados na query string
//   da URL (ex: "/locacoes?status=Ativo" → req.query.status === "Ativo").
//   Esta função em particular não precisa de req.query, mas ele é comumente
//   usado em outras rotas deste projeto para filtros e paginação.
export async function devolver(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const clienteId = req.user!.id;

  const resultado = await locacaoService.devolverVeiculo(id, clienteId);

  res.status(200).json({
    mensagem: 'Veículo devolvido com sucesso.',
    locacao: resultado,
  });
}

// ----------------------------------------------------------------------------
// cancelar
// ----------------------------------------------------------------------------
// Cancela uma locação ativa do cliente autenticado, liberando o veículo.
export async function cancelar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const clienteId = req.user!.id;

  const resultado = await locacaoService.cancelarLocacao(id, clienteId);

  res.status(200).json({
    mensagem: 'Locação cancelada com sucesso.',
    locacao: resultado,
  });
}
