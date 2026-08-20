// ============================================================================
// src/services/veiculo.service.ts
// Camada de SERVICE (regras de negócio + acesso a dados via Prisma) para o
// recurso Veiculo. É aqui, e não nos controllers, que ficam as validações
// (ex.: categoria existente) e as chamadas ao Prisma. Os controllers apenas
// leem a requisição, chamam estas funções e devolvem a resposta HTTP.
// ============================================================================

import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// ----------------------------------------------------------------------------
// Interfaces locais: descrevem exatamente o formato de dados que cada função
// de service espera receber. Tipar explicitamente evita erros de digitação
// nos nomes dos campos e torna claro, para quem lê o código, o que é
// obrigatório e o que é opcional em cada operação.
// ----------------------------------------------------------------------------

// Formato de entrada para a criação de um novo veículo. Todos os campos são
// obrigatórios: o veículo nasce sempre associado a uma categoria, com placa,
// modelo e ano definidos. O statusDisponibilidade NÃO entra aqui porque o
// schema.prisma já define o valor padrão 'Disponivel' para todo veículo novo.
interface CriarVeiculoInput {
  categoriaId: number;
  placa: string;
  modelo: string;
  ano: number;
}

// Formato de entrada para atualização de um veículo já existente. Todos os
// campos são opcionais (marcados com "?"), pois uma atualização pode alterar
// apenas um ou alguns campos por vez (ex.: só o statusDisponibilidade, ou só
// o modelo), sem exigir o reenvio do objeto inteiro.
interface AtualizarVeiculoInput {
  categoriaId?: number;
  placa?: string;
  modelo?: string;
  ano?: number;
  statusDisponibilidade?: string;
}

// ----------------------------------------------------------------------------
// Por que usamos o Prisma ORM?
// O Prisma é um ORM (Object-Relational Mapper): ele traduz chamadas de
// funções TypeScript (como prisma.veiculo.findMany) em comandos SQL para o
// banco de dados, e converte o resultado de volta em objetos TypeScript já
// tipados. Isso evita escrever SQL manualmente, reduz erros de digitação em
// nomes de colunas/tabelas e nos dá autocomplete e checagem de tipos em
// tempo de compilação.
// ----------------------------------------------------------------------------

/**
 * Cria um novo veículo no sistema.
 *
 * Antes de criar, validamos que a categoria informada (categoriaId) de fato
 * existe na base de dados. Isso evita criar um veículo "órfão", apontando
 * para uma categoria inexistente (o que quebraria a integridade dos dados
 * mesmo que o banco não acuse erro imediatamente).
 */
export async function criarVeiculo(dados: CriarVeiculoInput) {
  // findUnique busca no máximo um registro, localizado por uma coluna única
  // (aqui, o id da categoria, que é chave primária). É a forma mais eficiente
  // de checar "este registro existe?" quando temos o identificador exato.
  const categoria = await prisma.categoriaVeiculo.findUnique({
    where: { id: dados.categoriaId },
  });

  if (!categoria) {
    // Regra de negócio: não é possível cadastrar um veículo em uma categoria
    // que não existe. Lançamos um AppError com status 404 (Não Encontrado).
    // Como os controllers/services são funções assíncronas e o projeto usa
    // 'express-async-errors', este throw é automaticamente capturado e
    // encaminhado ao middleware global de tratamento de erros — não
    // precisamos de try/catch aqui.
    throw new AppError('Categoria de veículo não encontrada.', 404);
  }

  // create insere um novo registro na tabela Veiculo. O campo
  // statusDisponibilidade não é informado em "data" porque o schema.prisma
  // define @default("Disponivel") para ele: todo veículo novo já nasce
  // disponível para locação.
  //
  // A opção "include" diz ao Prisma para, além dos campos do próprio
  // veículo, também trazer os dados completos da relação "categoria" (o
  // objeto CategoriaVeiculo inteiro ao qual esse veículo pertence) no mesmo
  // resultado. Isso evita que o front-end precise fazer uma segunda
  // requisição só para saber o nome/valores da categoria do veículo.
  const veiculo = await prisma.veiculo.create({
    data: dados,
    include: { categoria: true },
  });

  return veiculo;
}

/**
 * Lista veículos cadastrados, com filtro opcional por statusDisponibilidade.
 *
 * Esse parâmetro opcional é o que permite, por exemplo, que o catálogo
 * público da locadora faça uma requisição como
 * GET /api/veiculos?disponibilidade=Disponivel
 * para mostrar ao cliente apenas os veículos que podem ser alugados agora,
 * sem precisar filtrar a lista inteira manualmente no front-end.
 */
export async function listarVeiculos(statusDisponibilidade?: string) {
  // findMany busca uma coleção de registros que atendem (ou não) a uma
  // condição em "where". Quando statusDisponibilidade não é informado
  // (undefined), passamos "where: undefined", o que instrui o Prisma a não
  // aplicar nenhum filtro e trazer todos os veículos.
  const veiculos = await prisma.veiculo.findMany({
    where: statusDisponibilidade ? { statusDisponibilidade } : undefined,
    // Novamente usamos "include" para trazer a categoria completa de cada
    // veículo junto com o resultado — diferente de "select", que serve para
    // escolher campos específicos DO PRÓPRIO modelo (ex.: trazer só id e
    // modelo do veículo, descartando os demais campos). "include" é usado
    // quando queremos dados de uma RELAÇÃO; "select" é usado quando queremos
    // restringir quais CAMPOS (do modelo atual ou de suas relações) voltam
    // na resposta.
    include: { categoria: true },
    // orderBy define a ordenação do resultado; aqui ordenamos pelo id em
    // ordem crescente ('asc'), para que a listagem tenha uma ordem estável e
    // previsível.
    orderBy: { id: 'asc' },
  });

  return veiculos;
}

/**
 * Busca um único veículo pelo seu id, incluindo os dados da categoria.
 * Lança 404 caso o veículo não exista.
 */
export async function buscarVeiculoPorId(id: number) {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id },
    include: { categoria: true },
  });

  if (!veiculo) {
    throw new AppError('Veículo não encontrado.', 404);
  }

  return veiculo;
}

/**
 * Atualiza os dados de um veículo já existente.
 *
 * Primeiro reaproveitamos buscarVeiculoPorId para validar que o veículo
 * existe — se não existir, essa própria função já lança o AppError 404,
 * interrompendo a execução antes de tentarmos qualquer atualização.
 */
export async function atualizarVeiculo(id: number, dados: AtualizarVeiculoInput) {
  // Reaproveita a validação de existência já implementada acima, evitando
  // duplicar a lógica de "buscar e lançar 404 se não encontrado".
  await buscarVeiculoPorId(id);

  // update modifica um registro já existente, identificado por "where", com
  // os novos valores informados em "data". Como AtualizarVeiculoInput tem
  // todos os campos opcionais, apenas os campos efetivamente enviados pelo
  // cliente da API serão alterados; os demais permanecem como estavam.
  const veiculoAtualizado = await prisma.veiculo.update({
    where: { id },
    data: dados,
    include: { categoria: true },
  });

  return veiculoAtualizado;
}
