// ============================================================================
// src/services/locacao.service.ts
// Camada de SERVICE responsável por toda a lógica de negócio das Locações:
// abertura de locação (RN01), devolução de veículo (RN02), cancelamento e
// consulta. Os controllers apenas chamam estas funções; toda validação,
// cálculo de valores e acesso ao banco de dados (via Prisma) vive aqui.
// ============================================================================

import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// Interface local que descreve o formato de entrada esperado para abrir uma
// nova locação. Tipar explicitamente os parâmetros evita erros bobos (como
// esquecer um campo) e serve de documentação viva para quem lê o código.
interface AbrirLocacaoInput {
  veiculoId: number;
  dataPrevistaDevolucao: string;
}

/**
 * RN01 — Abre uma nova locação para o cliente autenticado.
 *
 * Usamos o Prisma ORM (Object-Relational Mapper) para conversar com o banco
 * de dados usando funções e objetos TypeScript em vez de escrever SQL cru.
 * Aqui usamos especificamente uma "transação interativa" do Prisma:
 * prisma.$transaction(async (tx) => { ... }). Isso significa que todas as
 * operações feitas com "tx" dentro do callback acontecem como um bloco único
 * e atômico: ou tudo é aplicado ao banco, ou nada é (se algo der errado no
 * meio do caminho, como um "throw", o Prisma desfaz — faz rollback — de
 * qualquer alteração já feita dentro da transação).
 *
 * Isso é essencial aqui porque precisamos LER o status do veículo e depois
 * ESCREVER um novo status baseado nessa leitura, sem que outra requisição
 * "concorrente" (por exemplo, dois clientes clicando em "alugar" no mesmo
 * instante) consiga fazer a mesma leitura antes da nossa escrita terminar.
 */
export async function abrirLocacao(clienteId: number, dados: AbrirLocacaoInput) {
  // prisma.$transaction com uma função callback (também chamada de
  // "transação interativa") garante que tudo o que fizermos com "tx" lá
  // dentro é tratado como uma única operação atômica no banco de dados.
  return prisma.$transaction(async (tx) => {
    // tx.veiculo.findUnique busca um único registro de Veiculo pela sua
    // chave única (aqui, o id). O "include: { categoria: true }" pede ao
    // Prisma para já trazer junto os dados da CategoriaVeiculo relacionada
    // (join automático), pois precisaremos do valorDiaria mais adiante.
    const veiculo = await tx.veiculo.findUnique({
      where: { id: dados.veiculoId },
      include: { categoria: true },
    });

    // Se não existe veículo com esse id, não há o que alugar.
    if (!veiculo) {
      throw new AppError('Veículo não encontrado.', 404);
    }

    // RN01: um veículo só pode ser alugado se estiver RIGOROSAMENTE com
    // statusDisponibilidade igual a 'Disponivel'. É crucial que esta
    // verificação seja feita lendo o dado através de "tx" (dentro da
    // transação) e não através de "prisma" (fora dela): como a transação é
    // atômica, nenhuma outra requisição consegue "enxergar" ou alterar este
    // mesmo veículo enquanto nossa transação não terminar. Isso evita a
    // condição de corrida em que duas pessoas conseguiriam alugar o mesmo
    // carro ao mesmo tempo, cada uma pensando que ele estava disponível.
    if (veiculo.statusDisponibilidade !== 'Disponivel') {
      throw new AppError('Este veículo não está disponível para locação no momento.', 400);
    }

    // A data de retirada é sempre "agora" (o momento em que a locação é
    // aberta). A data prevista de devolução vem do corpo da requisição,
    // como uma string, e precisa ser convertida para um objeto Date.
    const dataRetirada = new Date();
    const dataPrevistaDevolucao = new Date(dados.dataPrevistaDevolucao);

    // Validamos que a data recebida é uma data válida (Number.isNaN detecta
    // uma "Invalid Date") e que ela está no futuro em relação à retirada.
    if (
      Number.isNaN(dataPrevistaDevolucao.getTime()) ||
      dataPrevistaDevolucao <= dataRetirada
    ) {
      throw new AppError(
        'A data prevista de devolução deve ser uma data válida e futura.',
        400,
      );
    }

    // Calculamos quantos dias serão cobrados. Mesmo que a locação seja
    // "no mesmo dia" (diferença menor que 24h), cobramos no mínimo 1 dia.
    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    const dias = Math.max(
      1,
      Math.ceil((dataPrevistaDevolucao.getTime() - dataRetirada.getTime()) / MS_POR_DIA),
    );
    const valorTotal = dias * veiculo.categoria.valorDiaria;

    // tx.veiculo.update altera o registro do veículo, marcando-o como
    // 'Locado'. Fazemos isto ANTES de criar a locação de propósito: assim,
    // quando buscarmos o veículo "incluído" na locação logo a seguir, o
    // Prisma já vai ler o status atualizado ('Locado') em vez do status
    // antigo ('Disponivel') — evitando devolver ao cliente uma resposta com
    // dados desatualizados. Como isto acontece dentro da mesma transação da
    // criação da locação, as duas mudanças continuam sendo aplicadas juntas,
    // de forma atômica.
    await tx.veiculo.update({
      where: { id: veiculo.id },
      data: { statusDisponibilidade: 'Locado' },
    });

    // tx.locacao.create insere um novo registro de Locacao no banco de
    // dados, já com statusContrato 'Ativo'. O "include" aqui pede ao Prisma
    // para devolver, junto do registro criado, o veículo relacionado (já
    // com o status 'Locado' que acabámos de gravar) e, dentro dele, a
    // categoria relacionada — assim o controller recebe a locação já
    // "completa", sem precisar de outra consulta.
    const locacao = await tx.locacao.create({
      data: {
        clienteId,
        veiculoId: veiculo.id,
        dataRetirada,
        dataPrevistaDevolucao,
        valorTotal,
        statusContrato: 'Ativo',
      },
      include: { veiculo: { include: { categoria: true } } },
    });

    // O valor retornado pelo callback do $transaction vira o valor
    // retornado pela própria função abrirLocacao.
    return locacao;
  });
}

/**
 * Lista todas as locações pertencentes a um cliente específico, da mais
 * recente para a mais antiga.
 */
export async function listarLocacoesDoCliente(clienteId: number) {
  // prisma.locacao.findMany busca vários registros de Locacao que
  // satisfaçam a condição em "where" (aqui, pertencer ao clienteId
  // informado). "include" traz junto o veículo e, dentro dele, a categoria,
  // evitando que o front-end precise fazer múltiplas requisições.
  // "orderBy: { id: 'desc' }" ordena do id mais alto (mais recente) para o
  // mais baixo (mais antigo).
  return prisma.locacao.findMany({
    where: { clienteId },
    include: { veiculo: { include: { categoria: true } } },
    orderBy: { id: 'desc' },
  });
}

/**
 * Busca uma locação específica pelo id, garantindo que ela pertença ao
 * cliente autenticado que está fazendo a consulta.
 */
export async function buscarLocacaoPorId(id: number, clienteId: number) {
  // prisma.findUnique busca um único registro pela chave única (id).
  const locacao = await prisma.locacao.findUnique({
    where: { id },
    include: { veiculo: { include: { categoria: true } } },
  });

  if (!locacao) {
    throw new AppError('Locação não encontrada.', 404);
  }

  // Diferença importante entre os códigos HTTP 401 e 403:
  // - 401 (Unauthorized) significa "não sei quem você é" — o usuário não
  //   está autenticado (token ausente, inválido ou expirado). Isso é
  //   tratado no authMiddleware, antes de chegarmos aqui.
  // - 403 (Forbidden) significa "eu sei quem você é, mas você não tem
  //   permissão para acessar este recurso específico". É exatamente o
  //   nosso caso aqui: o cliente está autenticado (passou pelo
  //   authMiddleware), mas está tentando ver uma locação que pertence a
  //   outro cliente.
  if (locacao.clienteId !== clienteId) {
    throw new AppError('Esta locação não pertence ao cliente autenticado.', 403);
  }

  return locacao;
}

/**
 * RN02 — Registra a devolução física do veículo, finalizando o contrato de
 * locação e liberando o veículo para novas locações.
 */
export async function devolverVeiculo(id: number, clienteId: number) {
  // Novamente usamos uma transação interativa: precisamos ler o estado
  // atual da locação, validá-lo, e só então atualizar tanto a locação
  // quanto o veículo, tudo de forma atômica.
  return prisma.$transaction(async (tx) => {
    const locacao = await tx.locacao.findUnique({ where: { id } });

    if (!locacao) {
      throw new AppError('Locação não encontrada.', 404);
    }

    if (locacao.clienteId !== clienteId) {
      throw new AppError('Esta locação não pertence ao cliente autenticado.', 403);
    }

    if (locacao.statusContrato !== 'Ativo') {
      throw new AppError(
        'Esta locação já foi finalizada ou cancelada, não é possível devolvê-la novamente.',
        400,
      );
    }

    // O veículo volta a ficar disponível para novas locações. Fazemos isto
    // ANTES de reler a locação com o veículo "incluído" logo abaixo, para
    // que a resposta devolvida ao cliente já reflita o status atualizado do
    // veículo ('Disponivel'), e não o status antigo ('Locado').
    await tx.veiculo.update({
      where: { id: locacao.veiculoId },
      data: { statusDisponibilidade: 'Disponivel' },
    });

    // tx.locacao.update altera os campos informados em "data": registramos
    // o momento exato da devolução (dataDevolucaoReal) e mudamos o
    // statusContrato para 'Finalizado'. O "include" traz o veículo (já
    // atualizado) e a categoria junto da resposta.
    const locacaoAtualizada = await tx.locacao.update({
      where: { id },
      data: {
        dataDevolucaoReal: new Date(),
        statusContrato: 'Finalizado',
      },
      include: { veiculo: { include: { categoria: true } } },
    });

    return locacaoAtualizada;
  });
}

/**
 * Cancela uma locação ainda ativa (por exemplo, o cliente desistiu antes de
 * retirar o veículo ou durante o período de locação). Diferente da
 * devolução, o cancelamento NÃO marca dataDevolucaoReal, pois o veículo não
 * chegou a ser devolvido fisicamente por ter sido efetivamente usado — o
 * contrato simplesmente é encerrado como 'Cancelado'. Em ambos os casos,
 * porém, o veículo volta a ficar 'Disponivel'.
 */
export async function cancelarLocacao(id: number, clienteId: number) {
  return prisma.$transaction(async (tx) => {
    const locacao = await tx.locacao.findUnique({ where: { id } });

    if (!locacao) {
      throw new AppError('Locação não encontrada.', 404);
    }

    if (locacao.clienteId !== clienteId) {
      throw new AppError('Esta locação não pertence ao cliente autenticado.', 403);
    }

    if (locacao.statusContrato !== 'Ativo') {
      throw new AppError('Esta locação não pode mais ser cancelada.', 400);
    }

    // Mesmo cancelada, o veículo fica livre novamente para ser alugado.
    // Atualizamos o veículo ANTES de reler a locação com o veículo
    // "incluído" logo abaixo, para a resposta já refletir o status
    // atualizado ('Disponivel').
    await tx.veiculo.update({
      where: { id: locacao.veiculoId },
      data: { statusDisponibilidade: 'Disponivel' },
    });

    // Atualizamos apenas o statusContrato para 'Cancelado'. Note que NÃO
    // tocamos em dataDevolucaoReal, que permanece null.
    const locacaoAtualizada = await tx.locacao.update({
      where: { id },
      data: { statusContrato: 'Cancelado' },
      include: { veiculo: { include: { categoria: true } } },
    });

    return locacaoAtualizada;
  });
}
