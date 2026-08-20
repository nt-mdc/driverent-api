// =============================================================================
// src/services/auth.service.ts
// Responsabilidade: concentrar toda a lógica de autenticação da aplicação
// (camada de "service" na arquitetura em camadas Controller -> Service -> Prisma).
// Aqui validamos credenciais do Cliente, comparamos a senha com o hash guardado
// na base de dados e emitimos o token JWT que o cliente usará para se autenticar
// nas rotas protegidas. Nenhuma lógica de negócio deve ficar no controller.
// =============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// Interface local que descreve o formato de entrada esperado pela função "login".
// Tipar explicitamente os dados de entrada evita erros de digitação em nomes de
// campos e deixa claro, para quem lê o código, o "contrato" da função.
interface LoginInput {
  email: string;
  senha: string;
}

/**
 * Autentica um Cliente a partir de e-mail e senha em texto puro.
 *
 * Por que usamos o Prisma ORM aqui?
 * O Prisma é o ORM (Object-Relational Mapper) do projeto: ele traduz chamadas
 * de métodos JavaScript/TypeScript (como "prisma.cliente.findUnique") em
 * comandos SQL executados na base de dados, e devolve os resultados já
 * tipados de acordo com o "schema.prisma". Isso evita escrever SQL manualmente
 * e reduz erros de digitação em nomes de tabelas/colunas.
 *
 * - findUnique: busca UM único registo que corresponda exatamente à condição
 *   passada em "where". Como "email" é um campo "@unique" no schema, podemos
 *   usar "where: { email: ... }" com segurança: ou existe no máximo um
 *   Cliente com aquele e-mail, ou o resultado é "null".
 */
export async function login(dados: LoginInput) {
  // 1) Buscamos o cliente pelo e-mail informado. Se "cliente" for "null",
  // significa que não existe nenhum Cliente cadastrado com esse e-mail.
  const cliente = await prisma.cliente.findUnique({
    where: { email: dados.email },
  });

  // 2) Comparação da senha com o hash guardado.
  //
  // "bcrypt.compare(senhaEmTextoPuro, hashGuardado)" pega a senha que o
  // utilizador acabou de digitar (texto puro) e o hash que está gravado na
  // coluna "senha" do Cliente (gerado no momento do cadastro com
  // "bcrypt.hash"), e verifica se ambos "batem" — ou seja, se aquela senha em
  // texto puro, ao ser hasheada com o mesmo "salt", produziria o mesmo hash.
  //
  // É importante entender que o bcrypt NUNCA "descriptografa" um hash: hashes
  // são funções de mão única (one-way). Não existe "bcrypt.decrypt". A única
  // forma de validar uma senha é gerar o hash da tentativa e comparar os
  // hashes entre si — é exatamente isso que "bcrypt.compare" faz por baixo
  // dos panos.
  //
  // Observação de segurança importante: se "cliente" não existir, ainda assim
  // usamos "cliente?.senha ?? ''" como segundo argumento (uma string vazia
  // qualquer), só para conseguirmos calcular ALGUMA comparação e não deixar
  // o tempo de resposta da rota óbvio demais (evita que um atacante descubra,
  // pelo tempo de resposta, se o e-mail existe ou não na base). O resultado
  // dessa comparação será sempre "false" quando o cliente não existe.
  const senhaConfere = await bcrypt.compare(
    dados.senha,
    cliente?.senha ?? ''
  );

  // Por que usamos a MESMA mensagem de erro ("E-mail ou senha inválidos.")
  // tanto para "cliente não encontrado" quanto para "senha incorreta"?
  //
  // Isto é uma boa prática de segurança: se devolvêssemos mensagens
  // diferentes (por exemplo, "e-mail não cadastrado" vs. "senha incorreta"),
  // um atacante poderia usar essa diferença para descobrir, tentativa por
  // tentativa, quais e-mails estão realmente cadastrados no sistema (um
  // ataque conhecido como "enumeração de utilizadores"). Ao devolver sempre a
  // mesma mensagem genérica e o mesmo código de status (401 - não
  // autorizado), não damos essa pista a quem está a tentar invadir contas.
  if (!cliente || !senhaConfere) {
    throw new AppError('E-mail ou senha inválidos.', 401);
  }

  // 3) Geração ("assinatura") do token JWT.
  //
  // "Assinar" um JWT (JSON Web Token) significa criar uma cadeia de texto
  // composta por três partes (cabeçalho, payload/carga e assinatura),
  // codificadas e concatenadas, onde a assinatura é calculada com uma chave
  // secreta (process.env.JWT_SECRET) que só o nosso servidor conhece. Isso
  // garante duas coisas: (a) qualquer pessoa pode LER o conteúdo do token
  // (não é criptografia, é apenas codificação em Base64), mas (b) ninguém
  // consegue ALTERAR o conteúdo do token sem invalidar a assinatura, porque
  // não tem acesso à chave secreta usada para gerá-la. Assim, quando o
  // cliente envia esse token de volta numa requisição futura, o servidor
  // consegue verificar (com "jwt.verify") que o token não foi adulterado e
  // confiar nos dados nele contidos (id e email do cliente).
  //
  // O payload assinado contém apenas o "id" e o "email" do cliente — nunca a
  // senha ou o hash da senha.
  const token = jwt.sign(
    { id: cliente.id, email: cliente.email },
    process.env.JWT_SECRET as string,
    // A biblioteca de tipos do "jsonwebtoken" espera um formato bem específico
    // para "expiresIn" (ex.: "1d", "12h", "30m", ou um número de segundos), por
    // isso fazemos este "as" para informar ao TypeScript que a string vinda de
    // process.env.JWT_EXPIRES_IN (ou o fallback "1d") respeita esse formato.
    { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as jwt.SignOptions['expiresIn'] }
  );

  // 4) Devolvemos o token junto com os dados públicos do cliente autenticado.
  // Construímos este objeto explicitamente, listando apenas os campos que
  // podem ser expostos pela API — NUNCA devolvemos "cliente.senha" (nem o
  // hash), para não vazar essa informação sensível na resposta HTTP.
  return {
    token,
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
    },
  };
}
