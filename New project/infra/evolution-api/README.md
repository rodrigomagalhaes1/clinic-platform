# Evolution API local

Este setup sobe uma Evolution API local para homologar WhatsApp no sistema da clinica.

## Enderecos

- API: `http://localhost:8080`
- Documentacao Swagger da Evolution: `http://localhost:8080/docs`
- Nosso app no Windows: `http://localhost:5173/#relationship-whatsapp`
- Nosso app visto pelo container: `http://host.docker.internal:5173`

## Subir

```powershell
cd "C:\Users\Rodrigo\Documents\New project\infra\evolution-api"
docker compose up -d
```

## Parar

```powershell
docker compose down
```

## Configuracao no nosso app

- Provedor: `Evolution API`
- Evolution URL: `http://127.0.0.1:8080`
- Instancia: `clinic-main`
- Evolution API key: `clinic-evolution-local-key`
- Webhook secret: `clinic-whatsapp-local-secret`

Depois clique em criar/conectar instancia no modulo WhatsApp e leia o QR Code com o WhatsApp do telefone de homologacao.
