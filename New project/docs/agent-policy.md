# Politica de Agentes

Agentes devem acelerar a operacao da clinica sem esconder responsabilidade, risco ou origem das mudancas.

## Niveis de risco

### Baixo

Pode executar sem aprovacao quando gerar apenas leitura, sugestoes, tarefas internas ou classificacoes.

Exemplos:

- Criar tarefa de pendencia de faturamento.
- Gerar resumo diario.
- Sugerir pacientes para contato.

### Medio

Pode executar automaticamente quando a acao for reversivel e houver trilha de auditoria.

Exemplos:

- Enviar confirmacao de consulta.
- Atualizar tentativa de contato.
- Marcar pendencia operacional.

### Alto

Exige aprovacao humana antes de qualquer efeito externo ou financeiro.

Exemplos:

- Enviar cobranca.
- Cancelar fatura.
- Alterar valor financeiro.
- Submeter lote de convenio.
- Exportar dados sensiveis.

## Regras obrigatorias

- Toda execucao de agente gera auditoria.
- Toda ferramenta declara escopos de leitura e escrita.
- Ferramentas de alto risco exigem aprovacao humana.
- Agentes nao acessam dados clinicos sem necessidade explicita.
- O usuario deve conseguir ver o motivo de cada sugestao ou acao.

## Agentes iniciais

- Confirmacao de consultas.
- Pre-faturamento.
- Cobranca assistida.
- Conciliacao financeira.
- Resumo executivo diario.

