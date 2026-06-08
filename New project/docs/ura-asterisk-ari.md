# URA Asterisk ARI

Este guia prepara a homologacao da URA real do sistema Clinic Automation com Asterisk ARI.

## Endpoints do sistema

- App local: `http://localhost:5173/#relationship-ura`
- API ARI config: `GET /v1/relationship/ura/config`
- Teste ARI: `POST /v1/relationship/ura/connector/test`
- Conectar eventos ARI: `POST /v1/relationship/ura/connector/connect`
- Desconectar eventos ARI: `POST /v1/relationship/ura/connector/disconnect`
- Comandos ARI: `POST /v1/relationship/ura/commands`
- Webhook opcional: `POST /webhooks/relationship/ura/ari`

O webhook opcional exige o header:

```http
X-URA-Secret: clinic-ura-local-secret
```

## Fluxo recomendado

1. Configure o Asterisk com HTTP e ARI habilitados.
2. Configure um usuario ARI dedicado, sem reaproveitar senha administrativa.
3. Direcione o ramal/tronco de entrada para `Stasis(clinic-relationship)`.
4. No sistema, abra `Relacionamento > URA`.
5. Preencha ARI URL, aplicacao, usuario, senha, tronco SIP e segredo do webhook.
6. Clique em `Testar ARI`.
7. Clique em `Conectar eventos`.
8. Faça uma ligacao teste e digite DTMF `1`, `2`, `3` ou `4`.

## Variaveis sugeridas

- ARI base URL: `http://127.0.0.1:8088/ari`
- Aplicacao ARI: `clinic-relationship`
- Usuario ARI: `clinic_ari`
- Senha ARI: trocar em producao
- Tronco SIP: `PJSIP/tronco-principal`
- DID: numero principal da clinica

## Eventos aceitos

O conector WebSocket do sistema interpreta eventos ARI reais:

- `StasisStart` -> inicio de canal
- `ChannelStateChange` com estado `Up` -> chamada atendida
- `ChannelDtmfReceived` -> DTMF recebido
- `ChannelEnteredBridge` / `BridgeEnter` -> chamada em ponte
- `ChannelHangupRequest`, `ChannelDestroyed`, `StasisEnd` -> desligamento

## Comandos executados

O painel `Relacionamento > URA > Comandos ARI` envia comandos reais ao Asterisk:

- `answer`: atende o canal com `POST /ari/channels/{channelId}/answer`
- `play`: toca audio com `POST /ari/channels/{channelId}/play?media=...`
- `transfer`: redireciona com `POST /ari/channels/{channelId}/redirect?endpoint=...`
- `record`: inicia gravacao com `POST /ari/channels/{channelId}/record`
- `hangup`: desliga com `DELETE /ari/channels/{channelId}`

Exemplo de comando via API:

```json
{
  "action": "transfer",
  "channelId": "SIP/ARI-REAL-001",
  "queueId": "finance"
}
```

Quando o Asterisk ainda nao esta ativo, o comando fica registrado como `failed`, com a falha retornada pelo ARI. Isso e esperado em homologacao local.

## Cuidados para producao

- Usar HTTPS/rede privada entre sistema e Asterisk.
- Trocar todas as senhas dos exemplos.
- Restringir ARI por firewall.
- Usar usuario ARI com permissao minima.
- Monitorar eventos em `Relacionamento > URA > Auditoria URA`.
- Manter gravação/transcrição alinhadas com LGPD e consentimento.
