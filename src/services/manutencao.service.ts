// ============================================================================
// src/services/manutencao.service.ts
// ----------------------------------------------------------------------------
// Camada de SERVICE responsável pela regra de negócio relacionada com a
// manutenção de veículos (RN03 e a sua extensão simétrica de conclusão).
// Nenhuma lógica de negócio ou acesso ao Prisma deve viver nos controllers:
// eles apenas chamam as funções exportadas aqui e devolvem a resposta HTTP.
// ============================================================================

import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// Interface local que descreve o formato de entrada esperado para registar
// uma manutenção. Tipar explicitamente evita o uso de "any" implícito e
// documenta, para quem lê o código, exatamente quais campos são necessários.
interface RegistrarManutencaoInput {
  veiculoId: number;
  descricaoServico: string;
  valorCusto: number;
}

/**
 * Registra uma nova manutenção para um veículo.
 *
 * RN03: não é permitido registar manutenção para um veículo que esteja
 * atualmente 'Locado' (o veículo está com um cliente, não pode ser mexido
 * na oficina). Se o veículo estiver 'Disponivel' ou já em 'Manutencao',
 * o registo é permitido e o veículo passa (ou permanece) com
 * statusDisponibilidade = 'Manutencao'.
 *
 * Usamos prisma.$transaction com um callback assíncrono (transação
 * interativa) porque precisamos ler o estado atual do veículo e, com base
 * nesse estado, decidir se criamos o registo e atualizamos o veículo. Fazer
 * isso dentro de uma transação garante que, entre a leitura e a escrita,
 * nenhuma outra requisição consiga alterar o veículo "no meio do caminho"
 * (condição de corrida). Todas as operações dentro do callback usam o
 * cliente "tx" (e não o "prisma" global), pois é o "tx" que participa da
 * mesma transação.
 */
export async function registrarManutencao(dados: RegistrarManutencaoInput) {
  return prisma.$transaction(async (tx) => {
    // findUnique busca um único registo pela sua chave única (aqui, o id).
    // Usamos para conferir se o veículo informado realmente existe antes de
    // qualquer outra validação.
    const veiculo = await tx.veiculo.findUnique({
      where: { id: dados.veiculoId },
    });

    if (!veiculo) {
      // AppError é a classe usada em todo o projeto para sinalizar erros de
      // negócio: o construtor recebe a mensagem e o status HTTP. Como o
      // projeto usa express-async-errors, basta "throw" que o erro é
      // automaticamente capturado e encaminhado ao errorHandler global.
      throw new AppError('Veículo não encontrado.', 404);
    }

    // RN03: veículo locado não pode entrar em manutenção.
    if (veiculo.statusDisponibilidade === 'Locado') {
      throw new AppError(
        'Não é possível registar manutenção em um veículo que está atualmente locado.',
        400,
      );
    }

    // update altera os campos informados do registo encontrado por "where".
    // Aqui movemos o veículo para o status 'Manutencao', indicando que ele
    // está indisponível para locação até a manutenção ser concluída.
    // Fazemos isto ANTES de criar o registo de manutenção de propósito: como
    // logo a seguir vamos incluir os dados do veículo na resposta (via
    // "include"), precisamos que essa leitura já enxergue o status
    // atualizado — senão a resposta devolveria o status antigo ('Disponivel').
    await tx.veiculo.update({
      where: { id: dados.veiculoId },
      data: { statusDisponibilidade: 'Manutencao' },
    });

    // create insere um novo registo na tabela Manutencao. O objeto "data"
    // recebe diretamente "dados", já que os campos de RegistrarManutencaoInput
    // (veiculoId, descricaoServico, valorCusto) correspondem aos campos
    // esperados pelo Prisma para criar uma Manutencao (a dataManutencao é
    // preenchida automaticamente pelo valor padrão definido no schema).
    // O "include: { veiculo: true }" faz o Prisma trazer também os dados do
    // veículo relacionado (já com o status 'Manutencao' atualizado), unidos
    // (join) no mesmo resultado, para que o controller não precise fazer uma
    // segunda consulta.
    const manutencao = await tx.manutencao.create({
      data: dados,
      include: { veiculo: true },
    });

    return manutencao;
  });
}

/**
 * Lista todas as manutenções já registadas, das mais recentes para as mais
 * antigas (orderBy id 'desc'). Usamos findMany, que devolve um array com
 * todos os registos que atendem aos critérios informados (aqui, sem filtro,
 * ou seja, todos). O "include: { veiculo: true }" traz também os dados do
 * veículo relacionado a cada manutenção, evitando que o front-end precise
 * fazer uma requisição extra para saber a qual veículo cada manutenção
 * pertence.
 */
export async function listarManutencoes() {
  return prisma.manutencao.findMany({
    include: { veiculo: true },
    orderBy: { id: 'desc' },
  });
}

/**
 * Conclui uma manutenção em andamento, devolvendo o veículo para o status
 * 'Disponivel'.
 *
 * Esta operação existe porque, sem ela, um veículo que entrasse em
 * 'Manutencao' (via registrarManutencao) ficaria PRESO nesse status para
 * sempre — nunca mais poderia ser locado novamente. É a extensão simétrica
 * necessária para o ciclo de vida do veículo fazer sentido: assim como uma
 * locação pode ser finalizada ou cancelada (devolvendo o veículo para
 * 'Disponivel'), uma manutenção também precisa de um jeito explícito de ser
 * encerrada.
 *
 * Novamente usamos uma transação interativa: primeiro lemos o registo de
 * manutenção (com o veículo relacionado, via include) para validar o estado
 * atual, e só depois atualizamos o veículo — tudo isolado numa única
 * transação para evitar condições de corrida.
 */
export async function concluirManutencao(id: number) {
  return prisma.$transaction(async (tx) => {
    // findUnique localiza a manutenção pelo id. O "include: { veiculo: true }"
    // já traz o veículo relacionado, para que possamos validar o seu status
    // sem precisar de uma segunda consulta.
    const manutencao = await tx.manutencao.findUnique({
      where: { id },
      include: { veiculo: true },
    });

    if (!manutencao) {
      throw new AppError('Registo de manutenção não encontrado.', 404);
    }

    if (manutencao.veiculo.statusDisponibilidade !== 'Manutencao') {
      throw new AppError(
        'Este veículo não está atualmente em manutenção.',
        400,
      );
    }

    // Devolve o veículo para 'Disponivel', liberando-o novamente para
    // locação. O retorno de tx.veiculo.update já traz o registo atualizado
    // do veículo, que é o que devolvemos ao chamador desta função.
    const veiculoAtualizado = await tx.veiculo.update({
      where: { id: manutencao.veiculoId },
      data: { statusDisponibilidade: 'Disponivel' },
    });

    return veiculoAtualizado;
  });
}
