# WhatsApp autonomo

## Decisao tecnica

O modulo foi desenhado para suportar dois caminhos:

- Meta WhatsApp Cloud API: caminho oficial para producao, com webhook de verificacao e recebimento de mensagens.
- Evolution API / Baileys: caminho open-source/self-host para homologacao e integracoes locais.

O sistema fica independente do fornecedor: os webhooks normalizam mensagens para o mesmo agente interno.

## Endpoints

- `GET /v1/relationship/whatsapp/config`
- `PATCH /v1/relationship/whatsapp/config`
- `GET /v1/relationship/whatsapp/readiness`
- `GET /v1/relationship/whatsapp/safety-dashboard`
- `GET /v1/relationship/whatsapp/flows`
- `POST /v1/relationship/whatsapp/flows`
- `GET /v1/relationship/whatsapp/templates`
- `POST /v1/relationship/whatsapp/templates`
- `GET /v1/relationship/whatsapp/autonomy-rules`
- `POST /v1/relationship/whatsapp/autonomy-rules`
- `GET /v1/relationship/whatsapp/autonomy-profiles`
- `POST /v1/relationship/whatsapp/autonomy-profiles`
- `GET /v1/relationship/whatsapp/journeys`
- `POST /v1/relationship/whatsapp/journeys`
- `GET /v1/relationship/whatsapp/insurance-validation`
- `GET /v1/relationship/whatsapp/prep-rules`
- `POST /v1/relationship/whatsapp/prep-rules`
- `GET /v1/patients/lookup`
- `GET /v1/relationship/whatsapp/profile-updates`
- `POST /v1/relationship/whatsapp/profile-updates/resolve`
- `GET /v1/relationship/whatsapp/consents`
- `POST /v1/relationship/whatsapp/consents/record`
- `GET /v1/relationship/whatsapp/evolution/status`
- `POST /v1/relationship/whatsapp/evolution/instance`
- `POST /v1/relationship/whatsapp/evolution/connect`
- `GET /v1/relationship/whatsapp/conversations`
- `GET /v1/relationship/whatsapp/supervision`
- `GET /v1/relationship/whatsapp/exceptions`
- `GET /v1/relationship/whatsapp/autonomy-reviews`
- `POST /v1/relationship/whatsapp/autonomy-reviews/approve`
- `POST /v1/relationship/whatsapp/autonomy-reviews/reject`
- `POST /v1/relationship/whatsapp/conversations/assume`
- `POST /v1/relationship/whatsapp/conversations/release`
- `POST /v1/relationship/whatsapp/conversations/resolve`
- `GET /v1/relationship/whatsapp/messages`
- `POST /v1/relationship/whatsapp/messages/manual`
- `GET /v1/relationship/whatsapp/outbox`
- `POST /v1/relationship/whatsapp/outbox/send`
- `POST /v1/relationship/whatsapp/outbox/retry`
- `POST /v1/relationship/whatsapp/outbox/resolve-failure`
- `POST /v1/relationship/whatsapp/outbox/approve`
- `POST /v1/relationship/whatsapp/outbox/send-pending`
- `GET /v1/relationship/whatsapp/tasks`
- `GET /v1/relationship/whatsapp/ocr`
- `POST /v1/relationship/whatsapp/messages/simulate`
- `GET /v1/appointments/availability`
- `GET /webhooks/relationship/whatsapp/cloud`
- `POST /webhooks/relationship/whatsapp/cloud`
- `POST /webhooks/relationship/whatsapp/evolution`

## Cascata autonoma

1. Recebe mensagem por webhook ou simulador local.
2. Normaliza origem, paciente, texto, legenda, midia e texto extraido.
3. Se a conversa ja tem uma cascata ativa, continua da etapa atual.
4. Se nao tem cascata ativa, classifica intencao:
   - agendamento
   - cancelamento
   - pedido por foto/documento
   - triagem
5. Inicia a cascata configurada para aquela intencao ou acao.
6. Executa acao quando permitido:
   - cria paciente se necessario;
   - cria agendamento;
   - cancela agendamento ativo;
   - cria tarefa de revisao quando a confianca e baixa;
   - gera resposta do agente.
7. Coloca a resposta na caixa de saida.
8. Envia automaticamente quando `autoSendEnabled` estiver ativo e a tarefa nao exigir revisao humana.
9. Registra conversa, mensagens, tarefas, tentativas de envio e auditoria.

## Jornadas / cascatas

As cascatas ficam em `relationship_whatsapp_journeys` e guardam o estado na conversa:

- `journeyId`
- `journeyName`
- `journeyStepId`
- `journeyStepTitle`
- `journeyStatus`
- `collectedData`

Cascatas iniciais:

- Agendamento: paciente, pedido, convenio, preferencia de horario e confirmacao.
- Cancelamento: paciente e confirmacao.
- Pedido por foto: recebimento, OCR/conferencia e agendamento.
- Atendimento humano: pausa do agente e revisao.

Cada etapa possui:

- titulo;
- acao;
- mensagem/prompt;
- dados esperados;
- flag de revisao humana.

## Agenda assistida

Na etapa de confirmacao, o agente consulta a agenda local antes de criar atendimento:

- resolve o procedimento por nome, modalidade ou palavras-chave;
- identifica salas compativeis pela modalidade;
- calcula a duracao pelo cadastro do procedimento;
- procura horarios livres evitando conflito com atendimentos ativos;
- grava sala, unidade, inicio, fim, modalidade, convenio e origem WhatsApp no atendimento.

Tambem existe uma consulta operacional para a equipe:

```text
GET /v1/appointments/availability?procedureName=Tomografia&preferredPeriod=manha&limit=6
```

O retorno traz procedimento resolvido, salas compativeis, horarios livres e o primeiro horario sugerido para a cascata.

## Convenio e autorizacao

Na etapa de convenio, o agente valida contra os cadastros locais:

- `registry_insurances`
- `registry_plans`

Comportamento:

- Particular: segue sem autorizacao.
- Convenio cadastrado sem guia obrigatoria: segue para escolha de horario.
- Convenio cadastrado com guia obrigatoria: pede guia/senha antes de avancar.
- Convenio desconhecido: pausa a cascata e cria tarefa de revisao humana.

Consulta operacional:

```text
GET /v1/relationship/whatsapp/insurance-validation?insuranceName=Convenio%20Demo&procedureName=Tomografia&guideNumber=G123
```

Quando a guia/senha existe, o atendimento criado recebe `authorizationStatus=authorized`, `guideNumber` e `authorizationCode`. Quando falta, permanece em `pending` e o agente solicita a informacao ao paciente.

## Preparo e checklist

Apos confirmar o agendamento, o agente seleciona uma regra de preparo em `relationship_whatsapp_prep_rules` por:

- palavras-chave do procedimento;
- modalidade;
- regra padrao.

O atendimento criado recebe:

- `prepRuleId`
- `prepRuleName`
- `prepInstructions`

A resposta final ao paciente inclui:

- preparo;
- documentos necessarios;
- antecedencia recomendada;
- necessidade de acompanhante quando configurada.

Regras iniciais:

- Tomografia com contraste.
- Ressonancia magnetica.
- Ultrassom abdominal.
- Preparo padrao.

## Reconhecimento do paciente

Antes de responder, o agente tenta reconhecer o paciente:

- por telefone do WhatsApp;
- por CPF informado no texto da conversa.

Quando encontra cadastro local, a conversa recebe:

- `patientId`
- `patientName`
- `patientDocumentNumber`
- `patientBirthDate`
- `patientMatchedBy`

Com isso a cascata pode pular a etapa de identificacao e falar com o paciente pelo nome. Se o CPF for informado mas nao existir no cadastro, o agente preserva a informacao e pode continuar pedindo confirmacao ou encaminhar para revisao conforme a regra do fluxo.

Politica de seguranca:

- CPF unico no cadastro confirma a identidade automaticamente.
- Telefone unico pede confirmacao leve por data de nascimento ou CPF antes de continuar.
- Telefone ou CPF duplicado pausa a automacao e cria revisao humana.
- A mensagem original fica guardada enquanto o agente aguarda confirmacao, para continuar o fluxo sem pedir que o paciente repita a solicitacao.

## Atualizacao cadastral assistida

O agente nao altera cadastro automaticamente. Quando percebe dados novos ou divergentes, cria uma pendencia em `relationship_whatsapp_profile_updates`.

Casos cobertos:

- paciente reconhecido por CPF usando telefone diferente do cadastro;
- telefone informado na conversa que nao existe no cadastro;
- CPF informado divergente do cadastro;
- data de nascimento informada divergente do cadastro.

As pendencias guardam:

- paciente;
- conversa;
- campo;
- valor atual;
- valor informado;
- origem;
- motivo;
- status.

Na tela do WhatsApp, a recepcao pode marcar a pendencia como revisada ou rejeitada. A atualizacao final do cadastro continua sendo humana, para evitar troca indevida de dados sensiveis.

## Consentimento LGPD no WhatsApp

Antes de seguir com atendimento identificado, o agente verifica se o paciente possui consentimento valido para uso do canal WhatsApp em `relationship_whatsapp_consents`.

Comportamento:

- paciente ainda anonimo: o agente nao solicita consentimento antes de entender a demanda;
- paciente reconhecido por telefone: primeiro confirma CPF ou nascimento;
- paciente confirmado e sem consentimento aceito: pede ciencia para uso do WhatsApp em atendimento, agendamento e orientacoes;
- resposta positiva: registra `accepted`, guarda versao da politica e continua a mensagem original;
- resposta negativa: registra `rejected`, pausa a automacao e encaminha para equipe humana;
- resposta indefinida: mantem a conversa aguardando paciente, sem repetir a cascata.

A conversa guarda `whatsappConsentStatus`, `whatsappConsentId`, `whatsappConsentAt` e `pendingConsentText`, permitindo continuar o fluxo depois do aceite sem pedir que o paciente repita a solicitacao. Os eventos ficam na auditoria WhatsApp como `whatsapp.consent_requested` e `whatsapp.consent_recorded`.

## Envio de respostas

A caixa de saida grava cada resposta do agente em `relationship_whatsapp_messages` com `direction=outbound`.

Status suportados:

- `queued`: pronto para envio.
- `sending`: tentativa em andamento.
- `sent`: aceito pelo provedor.
- `failed`: falha controlada, com motivo em `error`.
- `blocked_review`: bloqueado porque a conversa precisa de revisao humana.
- `delivered` e `read`: reservados para confirmacoes futuras de webhook.

Provedores:

- Evolution API: `POST /message/sendText/{instance}` com header `apikey`.
- Meta Cloud API: `POST /{graphVersion}/{phoneNumberId}/messages` com bearer token.
- Simulacao local: marca como enviado sem chamar rede externa.

Quando o provedor real ainda nao estiver rodando ou configurado, o sistema mantem rastreabilidade e mostra a falha na tela, permitindo nova tentativa manual.

## Supervisao humana

Modos do agente:

- `automatic`: o agente responde e envia sozinho, exceto em baixa confianca.
- `supervised`: o agente cria rascunho e aguarda aprovacao humana antes de enviar.
- `manual`: a equipe assume o atendimento e responde pela tela.

A tela de supervisao permite:

- ver conversas com risco de revisao, falha de entrega ou atendimento manual;
- assumir conversa e pausar automacao;
- liberar conversa de volta para o agente;
- resolver conversa;
- aprovar resposta pendente;
- editar resposta pendente antes de aprovar;
- enviar resposta manual.

## Inbox de atendimento

O modulo possui um inbox operacional para uso diario pela recepcao:

- lista de conversas com status, ultima mensagem e consentimento;
- historico central de mensagens inbound/outbound;
- resposta manual diretamente na conversa selecionada;
- contexto lateral com paciente, LGPD, ultima acao do agente, saidas pendentes, pendencias cadastrais e atendimentos recentes;
- acoes de assumir, liberar agente e resolver conversa.

Essa tela usa as colecoes existentes de conversas, mensagens, tarefas, consentimentos, pendencias e atendimentos. Ela nao cria uma base paralela de atendimento.

## Revisao antes do envio

Mensagens de saida bloqueadas, em rascunho ou aguardando aprovacao podem ser editadas pela equipe antes do envio. Ao aprovar com texto alterado, o sistema grava:

- texto original;
- texto revisado;
- usuario revisor;
- data/hora da revisao;
- auditoria `whatsapp.outbound_reviewed`.

Depois da revisao, a mensagem segue pelo mesmo fluxo de envio do provedor configurado.

Mensagens enviadas pelo proprio WhatsApp conectado (`fromMe`) sao ignoradas pelo webhook para evitar resposta em loop.

## Fila de excecoes

A fila de excecoes consolida os pontos que precisam de acao humana, sem duplicar dados em outra tabela. Ela cruza conversas, tarefas, saidas, OCR, consentimentos e pendencias cadastrais.

Entram na fila:

- identidade duplicada ou divergente;
- LGPD solicitado ou recusado;
- revisao humana do agente;
- convenio/autorizacao pendente;
- falha de envio ou resposta aguardando aprovacao;
- OCR falho, pendente ou com baixa confianca;
- pendencia cadastral.

O endpoint `GET /v1/relationship/whatsapp/exceptions` retorna resumo e itens priorizados por gravidade e data. Na tela, a equipe pode assumir, liberar ou resolver a conversa a partir da propria fila.

## Fluxos do agente

Os fluxos configuraveis controlam a arvore de atendimento do WhatsApp.

Cada fluxo possui:

- nome;
- intencao;
- acao;
- palavras-chave;
- resposta padrao;
- exigencia de aprovacao humana;
- prioridade;
- status ativo/inativo.

Acoes suportadas:

- `info`: responde uma informacao sem alterar agenda.
- `clarify`: pede dados adicionais.
- `schedule`: cria agendamento quando permitido.
- `cancel`: tenta cancelar agendamento ativo.
- `order`: trata pedido/guia e pode acionar OCR.
- `human`: encaminha para revisao humana.

Variaveis aceitas na resposta:

- `{{nome}}`
- `{{procedimento}}`
- `{{data}}`
- `{{telefone}}`

## Templates oficiais

Templates oficiais ficam em `relationship_whatsapp_templates` e padronizam textos sensiveis antes de uso pelo agente ou pela equipe.

Templates iniciais:

- confirmacao de agendamento;
- preparo de exame;
- consentimento LGPD;
- solicitacao de guia/autorizacao;
- cancelamento confirmado;
- encaminhamento para humano;
- lembrete de vespera.

Cada template possui nome, categoria, gatilho, texto, variaveis, prioridade, status e flag de aprovacao. A tela permite cadastrar novos modelos locais sem integrar ainda com templates oficiais da Meta.

## Regras de autonomia

As regras ficam em `relationship_whatsapp_autonomy_rules` e definem quando o agente pode seguir sozinho ou precisa pausar para revisao humana.

Politicas iniciais:

- LGPD recusado sempre vai para humano;
- identidade nao confirmada bloqueia agendamento, cancelamento e pedido por foto;
- OCR abaixo do limite configurado exige revisao;
- termos sensiveis pausam o agente;
- convenio com autorizacao pendente vai para conferencia;
- cancelamento no mesmo dia exige recepcao;
- agendamento particular pode seguir automatico quando nao houver outra regra mais critica.

Quando uma regra interrompe o fluxo, o sistema cria tarefa `autonomy_review`, pausa a conversa e registra `whatsapp.autonomy_rule_applied` na auditoria.

## Perfis de autonomia

Os perfis ficam em `relationship_whatsapp_autonomy_profiles` e funcionam como politica macro por tipo de atendimento. Eles entram depois das regras criticas: se nenhuma regra especifica bloquear, o perfil define se o atendimento segue automatico, supervisionado ou humano.

Perfis iniciais:

- relacionamento critico: reclamacao, laudo errado, processo ou diagnostico ficam com humano;
- agendamento particular: pode seguir automatico quando identidade e LGPD estiverem ok;
- agendamento por convenio: exige aprovacao operacional;
- cancelamento: exige aprovacao operacional;
- pedido por foto: exige supervisao.

Cada perfil possui escopo, modo, acao, tipo de atendimento, palavras-chave, prioridade e status.

## Dashboard de seguranca do agente

O endpoint `GET /v1/relationship/whatsapp/safety-dashboard` consolida indicadores para acompanhamento operacional:

- percentual de automacao;
- total de acoes automaticas;
- intervencoes humanas;
- aprovacoes pendentes;
- taxa de sucesso de envio;
- tempo medio de aprovacao;
- resumo executivo (`ready`, `homologation`, `attention` ou `blocked`);
- principais motivos de intervencao;
- riscos de entrega com acao de retry ou revisao;
- eventos recentes de regra aplicada, aprovacao, rejeicao, revisao e atendimento humano.

Na tela de WhatsApp, o painel **Seguranca do agente** permite acompanhar se a automacao esta saudavel antes de liberar mais autonomia.
Falhas antigas de envio podem ser reenviadas ou marcadas como revisadas; nesse caso, o evento `whatsapp.outbound_failure_resolved` preserva a rastreabilidade.

Antes de chamar o provedor, o sistema valida o destino WhatsApp. Numeros vazios, curtos, longos, sem DDI ou com aparencia de ID interno/protocolo sao bloqueados preventivamente e registrados como falha classificada. As falhas tambem recebem categoria e recomendacao:

- `invalid_phone`: corrigir telefone no cadastro;
- `missing_country_code`: incluir DDI;
- `profile_issue`: corrigir pendencia cadastral antes do envio;
- `provider_bad_request`: revisar payload/numero antes de reenviar;
- `provider_auth`: revisar credenciais;
- `instance_not_found`: checar instancia Evolution;
- `provider_unavailable`: testar conector e tentar novamente;
- `retry_limit`: assumir manualmente;
- `provider_unknown`: revisar detalhes do erro.

Quando a categoria for `invalid_phone` ou `missing_country_code`, o sistema cria automaticamente uma pendencia cadastral em `relationship_whatsapp_profile_updates` com origem `whatsapp_delivery_failure`. Essa pendencia aparece na tela de **Pendencias cadastrais** para a recepcao corrigir o telefone/WhatsApp do paciente ou da conversa antes de nova tentativa.

Ao corrigir uma pendencia de telefone, a API `POST /v1/relationship/whatsapp/profile-updates/resolve` pode receber `correctedValue` e `reprocess=true`. O sistema valida o telefone com DDI/DDD, atualiza o paciente e a conversa, resolve pendencias relacionadas, registra `whatsapp.profile_update_applied` e pode reprocessar saidas falhas/bloqueadas para o numero corrigido. Enquanto existir uma pendencia `whatsapp_delivery_failure` aberta para a conversa ou telefone, novas respostas automaticas ficam em `blocked_profile` e geram `whatsapp.outbound_blocked_profile_issue`.

## Aprovacao operacional das regras

A fila `autonomy-reviews` mostra cada pausa feita por regra com motivo, acao pretendida, mensagem de origem, saida pendente e estado da conversa. A equipe pode:

- aprovar e continuar, registrando `whatsapp.autonomy_rule_approved`;
- manter no humano, registrando `whatsapp.autonomy_rule_rejected`;
- assumir a conversa para resposta manual.

Quando aprovado, o sistema remove a pausa da conversa e tenta continuar a acao original com bypass controlado apenas da regra ja aprovada. Para agendamento e cancelamento, cria a tarefa operacional final e a resposta ao paciente. Para mensagem bloqueada, libera a saida pendente.

## Pedido por foto e OCR

O sistema tenta ler pedidos por foto/documento nesta ordem:

1. Se o provedor ja enviou `extractedText`, usa esse texto.
2. Se houver `mediaUrl`, baixa a midia e executa OCR local.
3. Se for Cloud API com `mediaId`, usa o token da Cloud API para obter a URL da midia e baixar.
4. Se nao conseguir baixar ou se o OCR falhar, cria uma tarefa de revisao humana.

Motor local suportado:

```text
Tesseract CLI
Idioma padrao: por+eng
```

No Windows, instale o Tesseract e deixe `tesseract.exe` no PATH. Pacote recomendado:

```powershell
winget install --id UB-Mannheim.TesseractOCR -e
```

Se o Tesseract nao estiver instalado, a cascata continua funcionando, mas pedidos por foto sem texto extraido ficam como `pending_media` ou `human_review`.

## Exemplo Evolution API

Setup local criado em:

```text
infra/evolution-api/docker-compose.yml
infra/evolution-api/.env
run-evolution.cmd
```

Para subir:

```powershell
.\run-evolution.cmd
```

Configure o webhook da instancia para:

```text
POST http://SEU_SERVIDOR/webhooks/relationship/whatsapp/evolution
Header: X-WhatsApp-Secret: clinic-whatsapp-local-secret
```

## Exemplo Cloud API

Configure o webhook no Meta Developers:

```text
Callback URL: http://SEU_SERVIDOR/webhooks/relationship/whatsapp/cloud
Verify token: clinic-whatsapp-verify
```

Para producao, use HTTPS e tokens fortes.
