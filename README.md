# Submundo Ink Ops — conexão em tempo real V71

Este pacote adiciona salas multiplayer por WebSocket ao FPS. O servidor mantém as salas em memória e envia snapshots a cada 50 ms; o banco não participa do movimento durante a partida.

## Publicar gratuitamente no Render

1. Crie uma conta gratuita em render.com.
2. Crie um repositório no GitHub e envie todos os arquivos desta pasta, exceto `node_modules`.
3. No Render, escolha **New → Blueprint** e selecione o repositório.
4. O arquivo `render.yaml` configura o serviço gratuito automaticamente.
5. Depois do deploy, abra a URL gerada e teste em dois celulares.

O serviço gratuito pode dormir após 15 minutos sem acesso. Ao abrir uma sala depois disso, aguarde o primeiro carregamento.

## Teste local

```bash
npm install
npm start
```

Abra `http://localhost:3000` em duas abas. O endpoint `/health` confirma a versão ativa.
