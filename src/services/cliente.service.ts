// ============================================================================
// cliente.service.ts
// ----------------------------------------------------------------------------
// Camada de SERVICE responsável por toda a lógica de negócio relacionada ao
// domínio "Cliente": criação de conta (com hash de senha), listagem e busca
// por id. Nenhuma regra de negócio ou acesso ao Prisma deve viver nos
// controllers — eles apenas chamam estas funções e devolvem o resultado.
// ============================================================================

import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// ----------------------------------------------------------------------------
// SELECT_CLIENTE_PUBLICO
// ----------------------------------------------------------------------------
// O Prisma permite escolher exatamente quais campos de uma tabela devem ser
// trazidos da base de dados através da opção "select". Aqui definimos uma
// constante reutilizável que lista todos os campos "públicos" de um Cliente,
// deliberadamente EXCLUINDO o campo "senha".
//
// Por que usar "select" em vez de buscar o registo inteiro e depois remover a
// senha manualmente (ex.: "const { senha, ...resto } = cliente")?
//   1) Segurança: com "select", o campo "senha" (mesmo em formato de hash)
//      NUNCA sai da base de dados nem chega a existir na memória da
//      aplicação. Não há risco de esquecermos de removê-lo antes de
//      devolver a resposta HTTP.
//   2) Eficiência: o Prisma monta uma consulta SQL que já traz apenas as
//      colunas necessárias, evitando transferir dados desnecessários entre
//      a base de dados e a aplicação.
//   3) Compilação: como o tsconfig deste projeto tem "noUnusedLocals": true,
//      o padrão de desestruturação "const { senha, ...resto } = cliente"
//      criaria uma variável "senha" declarada e nunca utilizada, o que
//      quebraria a compilação. Usar "select" evita esse problema por
//      completo.
//
// "as const" faz o TypeScript tratar este objeto como um literal imutável,
// o que ajuda o Prisma a inferir corretamente o tipo do resultado retornado
// (com apenas estes campos presentes).
const SELECT_CLIENTE_PUBLICO = {
  id: true,
  nome: true,
  cpf: true,
  email: true,
  telefone: true,
  criadoEm: true,
} as const;

// ----------------------------------------------------------------------------
// CriarClienteInput
// ----------------------------------------------------------------------------
// Interface local que descreve o formato de entrada esperado para criar um
// novo Cliente. Tipar explicitamente os parâmetros de entrada evita o uso de
// "any" implícito e deixa claro, para quem lê o código, quais dados são
// obrigatórios para esta operação.
interface CriarClienteInput {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  telefone: string;
}

// ----------------------------------------------------------------------------
// criarCliente
// ----------------------------------------------------------------------------
// Cria um novo Cliente na base de dados, garantindo que a senha nunca seja
// armazenada em texto puro.
//
// Usamos o Prisma ORM (Object-Relational Mapper) porque ele nos permite
// interagir com a base de dados usando funções e objetos TypeScript, em vez
// de escrever SQL manualmente. Isso traz tipagem estática (o próprio
// TypeScript nos avisa se tentarmos usar um campo que não existe no model
// Cliente) e reduz erros comuns de escrita de queries.
export async function criarCliente(dados: CriarClienteInput) {
  // bcrypt.hash(senha, saltRounds) gera um hash criptográfico irreversível
  // da senha original. O segundo parâmetro (10) é o "número de salt rounds":
  // ele controla o custo computacional do algoritmo — quanto maior o número,
  // mais tempo/processamento é necessário para gerar (e depois verificar) o
  // hash, tornando ataques de força bruta mais lentos e caros. O valor 10 é
  // um equilíbrio padrão da indústria entre segurança e desempenho.
  const senhaHash = await bcrypt.hash(dados.senha, 10);

  // prisma.cliente.create() insere um novo registo na tabela "Cliente".
  // Passamos em "data" todos os campos recebidos (nome, cpf, email,
  // telefone), sobrescrevendo o campo "senha" pelo hash gerado acima — ou
  // seja, a senha em texto puro nunca chega a ser persistida.
  //
  // A opção "select" (explicada em SELECT_CLIENTE_PUBLICO, acima) garante que
  // o objeto retornado por esta função já vem sem o campo "senha", pronto
  // para ser devolvido diretamente pelo controller como resposta da API.
  const clienteCriado = await prisma.cliente.create({
    data: {
      ...dados,
      senha: senhaHash,
    },
    select: SELECT_CLIENTE_PUBLICO,
  });

  return clienteCriado;
}

// ----------------------------------------------------------------------------
// listarClientes
// ----------------------------------------------------------------------------
// Retorna todos os clientes cadastrados, ordenados por id crescente.
//
// prisma.cliente.findMany() busca múltiplos registos da tabela "Cliente".
// Sem filtros em "where", ele traz todos os registos existentes. A opção
// "orderBy: { id: 'asc' }" garante que a lista venha sempre na mesma ordem
// (do id mais antigo para o mais recente), tornando o resultado previsível
// para quem consome a API.
export async function listarClientes() {
  const clientes = await prisma.cliente.findMany({
    select: SELECT_CLIENTE_PUBLICO,
    orderBy: { id: 'asc' },
  });

  return clientes;
}

// ----------------------------------------------------------------------------
// buscarClientePorId
// ----------------------------------------------------------------------------
// Busca um único Cliente pelo seu id. Caso não exista nenhum cliente com o
// id informado, lança um erro de negócio (404 - Não Encontrado).
//
// prisma.cliente.findUnique() busca no máximo um registo, usando uma coluna
// que garanta unicidade (aqui, a chave primária "id"). Se nenhum registo for
// encontrado, o Prisma retorna "null" em vez de lançar um erro — por isso
// precisamos verificar manualmente e decidir o que fazer nesse caso.
export async function buscarClientePorId(id: number) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: SELECT_CLIENTE_PUBLICO,
  });

  // Graças ao "express-async-errors" (importado uma única vez em
  // src/app.ts), podemos simplesmente lançar ("throw") um AppError aqui
  // dentro de uma função assíncrona que o erro será automaticamente
  // capturado e encaminhado para o middleware global de tratamento de erros
  // (errorHandler), sem necessidade de try/catch neste service nem no
  // controller que o chama.
  if (!cliente) {
    throw new AppError('Cliente não encontrado.', 404);
  }

  return cliente;
}
