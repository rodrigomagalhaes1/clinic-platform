# Arquitetura

## Visao geral

A plataforma sera organizada como um monorepo TypeScript com aplicacoes e pacotes internos:

- `apps/api`: API HTTP, autenticacao, autorizacao, endpoints e workers.
- `apps/web`: interface web operacional para recepcao, financeiro, administracao e gestores.
- `packages/domain`: entidades, eventos, contratos e regras independentes de framework.
- `packages/agents`: modelos de tarefas, ferramentas, politicas de aprovacao e orquestracao.
- `packages/shared`: tipos, validacoes e utilitarios compartilhados.

## Estilo modular

Cada modulo deve conter:

- Modelo de dados do dominio.
- Casos de uso.
- Eventos emitidos.
- Permissoes necessarias.
- Pontos de automacao.
- Relatorios e metricas.

## Dados e infraestrutura

Proposta inicial:

- PostgreSQL para dados transacionais.
- Redis para filas, locks e cache operacional.
- Object storage para anexos, guias, documentos e comprovantes.
- Workers separados para tarefas longas e automacoes.

## Seguranca e compliance

- Controle de acesso por papel e permissao granular.
- Auditoria imutavel para leitura, escrita, exportacao e automacoes.
- Trilhas de consentimento e base legal para dados pessoais.
- Criptografia em transito e em repouso.
- Politicas de retencao e anonimização quando aplicavel.

## Agentes

Agentes nao devem executar diretamente acoes criticas sem politica explicita. Cada ferramenta de agente deve declarar:

- Escopo permitido.
- Dados que pode ler.
- Dados que pode alterar.
- Se exige aprovacao humana.
- Evento de auditoria gerado.

