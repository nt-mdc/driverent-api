// ============================================================================
// prisma/seed.ts
// ----------------------------------------------------------------------------
// Este arquivo NÃO faz parte da camada de rotas/controllers/services da API.
// É um script utilitário, executado manualmente (ou via comando configurado
// no package.json, normalmente "prisma db seed"), cuja única responsabilidade
// é popular a base de dados com um conjunto inicial de dados de exemplo
// (categorias, veículos e um cliente de teste), para que a turma consiga
// testar as rotas da API imediatamente após clonar o projeto, sem precisar
// cadastrar tudo manualmente antes de começar os testes.
// ============================================================================

import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';

// A função main() concentra toda a lógica do seed. Usamos "async" porque
// todas as operações do Prisma (create, createMany, etc.) são assíncronas:
// elas retornam Promises, pois conversam com o banco de dados pela rede
// (ou por um socket local), o que nunca é instantâneo.
async function main() {
  console.log('Iniciando o seed da base de dados do DriveRent...');

  // --------------------------------------------------------------------
  // 1) CATEGORIAS DE VEÍCULO
  // --------------------------------------------------------------------
  // prisma.categoriaVeiculo.create() insere um único registo na tabela
  // "CategoriaVeiculo" e devolve (via Promise) o objeto completo já criado,
  // incluindo o "id" gerado automaticamente pelo banco. Guardamos esse
  // retorno em variáveis (popular, sedan, suv) porque vamos precisar dos
  // seus ids no passo seguinte, para associar cada veículo à categoria
  // correta (campo categoriaId, a chave estrangeira).
  const popular = await prisma.categoriaVeiculo.create({
    data: {
      nomeCategoria: 'Popular',
      valorDiaria: 120,
      valorCaucao: 500,
    },
  });

  const sedan = await prisma.categoriaVeiculo.create({
    data: {
      nomeCategoria: 'Sedan',
      valorDiaria: 180,
      valorCaucao: 800,
    },
  });

  const suv = await prisma.categoriaVeiculo.create({
    data: {
      nomeCategoria: 'SUV',
      valorDiaria: 250,
      valorCaucao: 1200,
    },
  });

  console.log('Categorias criadas: Popular, Sedan, SUV.');

  // --------------------------------------------------------------------
  // 2) VEÍCULOS
  // --------------------------------------------------------------------
  // prisma.veiculo.createMany() insere VÁRIOS registos de uma só vez,
  // recebendo em "data" um array de objetos (um objeto por veículo a criar).
  // Isso é mais eficiente do que chamar prisma.veiculo.create() cinco vezes
  // seguidas, pois o Prisma envia uma única instrução ao banco de dados.
  // Usamos os ids (popular.id, sedan.id, suv.id) obtidos no passo anterior
  // para ligar cada veículo à sua categoria correspondente.
  //
  // Observação: createMany() não devolve os registos criados (apenas a
  // contagem de quantos foram inseridos), o que é suficiente aqui, já que
  // não precisamos dos ids destes veículos nos passos seguintes do seed.
  await prisma.veiculo.createMany({
    data: [
      {
        categoriaId: popular.id,
        placa: 'ABC1D23',
        modelo: 'Fiat Mobi',
        ano: 2022,
        statusDisponibilidade: 'Disponivel',
      },
      {
        categoriaId: popular.id,
        placa: 'ABC2D34',
        modelo: 'Chevrolet Onix',
        ano: 2023,
        statusDisponibilidade: 'Disponivel',
      },
      {
        categoriaId: sedan.id,
        placa: 'DEF3E45',
        modelo: 'Toyota Corolla',
        ano: 2023,
        statusDisponibilidade: 'Disponivel',
      },
      {
        categoriaId: sedan.id,
        placa: 'DEF4E56',
        modelo: 'Honda Civic',
        ano: 2022,
        statusDisponibilidade: 'Manutencao',
      },
      {
        categoriaId: suv.id,
        placa: 'GHI5F67',
        modelo: 'Jeep Compass',
        ano: 2023,
        statusDisponibilidade: 'Disponivel',
      },
    ],
  });

  console.log('5 veículos criados (4 disponíveis, 1 em manutenção).');

  // --------------------------------------------------------------------
  // 3) CLIENTE DE TESTE
  // --------------------------------------------------------------------
  // Nunca guardamos senhas em texto puro na base de dados. Por isso, antes
  // de criar o cliente, geramos um hash da senha com bcrypt.hash(senha, 10).
  // O segundo parâmetro (10) é o "número de rounds" (custo computacional)
  // usado pelo algoritmo bcrypt para gerar o hash — quanto maior, mais
  // seguro e mais lento. 10 é um valor padrão e equilibrado para este fim.
  const senhaHash = await bcrypt.hash('123456', 10);

  // ATENÇÃO — CREDENCIAIS DE TESTE (usadas no roteiro de testes do README):
  //   email: cliente@teste.com
  //   senha: 123456
  // (a senha acima em texto puro é apenas o valor de ORIGEM usado para
  // gerar o hash; na base de dados fica gravado somente o hash, nunca a
  // senha original.)
  await prisma.cliente.create({
    data: {
      nome: 'Cliente Teste',
      cpf: '12345678900',
      email: 'cliente@teste.com',
      senha: senhaHash,
      telefone: '11999999999',
    },
  });

  console.log('Cliente de teste criado (email: cliente@teste.com, senha: 123456).');

  // --------------------------------------------------------------------
  // 4) RESUMO FINAL
  // --------------------------------------------------------------------
  console.log('----------------------------------------------------');
  console.log('Seed concluído com sucesso! Resumo do que foi criado:');
  console.log('- 3 categorias de veículo: Popular, Sedan, SUV');
  console.log('- 5 veículos (placas ABC1D23, ABC2D34, DEF3E45, DEF4E56, GHI5F67)');
  console.log('- 1 cliente de teste (cliente@teste.com / senha: 123456)');
  console.log('----------------------------------------------------');
}

// Executa a função principal do seed.
main()
  // .catch() captura qualquer erro lançado durante a execução de main()
  // (por exemplo, uma violação de restrição @unique caso o seed seja
  // executado duas vezes sobre a mesma base de dados). Registamos o erro
  // no console e encerramos o processo com código de saída 1, sinalizando
  // falha para quem estiver a rodar o script (por exemplo, um pipeline de
  // CI/CD ou o próprio terminal do aluno).
  .catch((erro) => {
    console.error('Erro ao executar o seed:', erro);
    process.exit(1);
  })
  // .finally() é executado sempre, tanto em caso de sucesso quanto de erro.
  // prisma.$disconnect() encerra a conexão do Prisma Client com o banco de
  // dados de forma limpa. Isso é importante num script standalone como este
  // (diferente do servidor Express, que mantém a conexão aberta enquanto
  // estiver a atender requisições): sem fechar a conexão explicitamente, o
  // processo Node poderia ficar "pendurado" (sem terminar sozinho) por
  // manter um socket aberto com o banco de dados.
  .finally(async () => {
    await prisma.$disconnect();
  });
