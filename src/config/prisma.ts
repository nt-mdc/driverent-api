// ============================================================================
// src/config/prisma.ts
// ----------------------------------------------------------------------------
// Responsabilidade deste arquivo dentro da arquitetura em camadas:
// Este arquivo é responsável por criar e exportar a ÚNICA instância (singleton)
// do Prisma Client usada por toda a aplicação. Nenhum outro arquivo do projeto
// (controllers, services, middlewares) deve criar o seu próprio "new
// PrismaClient()" — todos importam essa mesma instância a partir daqui, o que
// mantém a camada de acesso a dados centralizada, previsível e fácil de
// configurar/depurar em um único lugar.
// ============================================================================

import { PrismaClient } from '@prisma/client';

// ----------------------------------------------------------------------------
// O que é o "Prisma Client"?
// ----------------------------------------------------------------------------
// O Prisma Client NÃO é escrito à mão por nós: ele é gerado automaticamente
// (via "npx prisma generate") a partir do arquivo prisma/schema.prisma. O
// gerador lê os "models" definidos no schema (Cliente, CategoriaVeiculo,
// Veiculo, Locacao, Manutencao) e produz uma biblioteca TypeScript totalmente
// tipada, com uma classe chamada PrismaClient que sabe:
//   - abrir/gerir a conexão com o banco de dados configurado em DATABASE_URL;
//   - traduzir chamadas como "prisma.cliente.findMany()" em comandos SQL reais
//     (SELECT, INSERT, UPDATE, DELETE, transações, etc.);
//   - devolver os resultados já convertidos em objetos/arrays JavaScript com
//     os tipos corretos (ex.: prisma.cliente.findUnique(...) devolve um objeto
//     tipado como "Cliente | null", nunca "any").
// Em outras palavras: o Prisma Client é a "ponte" tipada entre o nosso código
// TypeScript e o banco de dados relacional, eliminando a necessidade de
// escrever SQL manualmente na maior parte das operações.
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Por que apenas UMA instância (padrão singleton)?
// ----------------------------------------------------------------------------
// Cada instância de PrismaClient mantém internamente um "pool" (conjunto) de
// conexões abertas com o banco de dados. Se cada arquivo do projeto (cada
// controller, cada service) criasse o seu próprio "new PrismaClient()", cada
// um desses arquivos abriria o seu próprio pool de conexões — e como uma
// aplicação Node.js normalmente importa dezenas de módulos, isso rapidamente
// esgotaria o número máximo de conexões simultâneas permitidas pelo banco de
// dados (a maioria dos bancos tem um limite, ex.: 20, 50, 100 conexões).
//
// A solução é o padrão "singleton": criamos a instância UMA única vez, aqui
// neste arquivo, e exportamos essa mesma instância para ser importada (e
// reaproveitada) em todos os outros lugares do projeto, assim:
//
//   import { prisma } from '../config/prisma';
//
// Dessa forma, não importa quantos services usem o Prisma — todos
// compartilham o mesmo pool de conexões, controlado e eficiente.
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// O parâmetro "log": o que cada nível mostra no terminal em desenvolvimento?
// ----------------------------------------------------------------------------
// O PrismaClient aceita uma opção de configuração "log", que controla quais
// eventos internos são impressos no console durante a execução. Usamos aqui
// três níveis, muito úteis enquanto se está a aprender e a depurar o projeto:
//
//   - 'query': imprime no terminal CADA comando SQL que o Prisma efetivamente
//     envia ao banco de dados (ex.: "SELECT * FROM Veiculo WHERE id = $1").
//     Isso ajuda muito a entender, na prática, o que uma chamada como
//     "prisma.veiculo.findUnique(...)" está a fazer "por baixo dos panos".
//
//   - 'warn': imprime avisos (warnings) gerados internamente pelo Prisma,
//     como o uso de alguma funcionalidade em vias de mudar de comportamento
//     ou configurações potencialmente problemáticas — sem que isso impeça a
//     aplicação de continuar a funcionar.
//
//   - 'error': imprime erros internos do próprio Prisma (ex.: falha ao ligar
//     ao banco de dados, erro ao interpretar uma query). Isto é diferente dos
//     erros de regra de negócio da nossa aplicação (que lançamos com
//     "throw new AppError(...)" nos services) — aqui trata-se de erros da
//     camada de acesso a dados em si.
//
// Em produção, normalmente reduzir-se-ia este nível de log (por exemplo,
// mantendo apenas 'error'), mas para fins didáticos, nesta turma, mantemos os
// três níveis ativos para que os alunos vejam exatamente o que acontece a
// cada requisição.
// ----------------------------------------------------------------------------

// Instância singleton do Prisma Client, exportada para ser reutilizada em
// toda a aplicação (services, middlewares, etc.).
export const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});
