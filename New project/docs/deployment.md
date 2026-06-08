# Implantacao local/servidor

Este projeto ja pode rodar como uma aplicacao unica em Node.js, servindo API e interface na mesma porta.

## Requisitos

- Windows Server ou Windows 10/11 dedicado.
- Node.js 20 ou superior.
- Pasta com permissao de escrita para `data/`.
- Backup externo da pasta `data/backups`.
- Acesso restrito por rede interna ou HTTPS via proxy.

## Variaveis

Use `.env.example` como referencia:

```text
APP_ENV=production
PORT=5173
PUBLIC_BASE_URL=https://sistema.sua-clinica.com.br
CLINIC_DATABASE_PATH=data/clinic.sqlite
CLINIC_BACKUPS_PATH=data/backups
```

## Execucao

```powershell
.\run-production.cmd
```

Depois acesse a URL definida em `PUBLIC_BASE_URL`.

## Checklist antes de uso real

- Alterar a senha inicial do administrador.
- Criar usuarios reais por perfil.
- Validar consentimentos LGPD.
- Ativar backup automatico e copiar backups para destino externo.
- Configurar HTTPS/reverse proxy.
- Restringir firewall para a rede autorizada.
- Testar restauracao de backup.
- Homologar PACS/DICOM, WhatsApp, telefonia e fiscal antes de integra-los.

## Proxima evolucao recomendada

Para multiusuario intenso ou varias unidades, migrar o armazenamento de SQLite para PostgreSQL e manter o SQLite apenas para homologacao/local.
