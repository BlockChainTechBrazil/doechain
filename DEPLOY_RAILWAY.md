# Deploy MVP (SQLite) to Railway — Step-by-step

Resumo rápido
- Objetivo: deployar a imagem Docker existente (`Dockerfile`) como Web Service no Railway usando SQLite (MVP).
- Observação: Railway não garante persistência de filesystem entre deploys. Para MVP isso pode ser aceitável; para produção use Postgres add-on.

Passos (web UI)
1. No seu repositório GitHub, faça commit & push das alterações (Dockerfile, `start.sh`, etc.).
2. Acesse https://railway.app e faça login.
3. Crie um novo Project → "Deploy from GitHub" → selecione este repositório.
4. Railway detectará o `Dockerfile` e criará um Service do tipo "Container".
5. Em "Environment", adicione variáveis (opcional — seu Dockerfile tem defaults inline):
   - `PORT` = `3001`
   - `JWT_SECRET` = (se quiser sobrescrever)
   - `RELAYER_PRIVATE_KEY` = (se quiser usar chave diferente)
   - `RPC_URL`, `TRUSTED_FORWARDER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
6. Deploy: clique em Deploy. O build acontece no Railway e o container será iniciado.

Passos (CLI) — alternativo
1. Instale Railway CLI: `npm i -g railway`
2. Autentique: `railway login`
3. Inicialize no repo: `railway init` (siga prompts para criar project)
4. Puxe a imagem local via `railway up --deployment` ou `railway run` — consulte docs Railway se necessário.

Verificações pós-deploy
- Logs: Railway dashboard → Service → Logs
- Health: `https://<your-service>.up.railway.app/api/health`
- Se o banco desaparecer entre deploys, considerar Postgres (próximo passo)

Rollback e redeploy
- Use o botão "Redeploy" no Railway ou force um push para a branch ligada.

Recomendações finais
- Para MVP rápido: seguir com SQLite e Dockerfile atual.
- Para estabilidade: migrar para Postgres (posso preparar a migração se escolher essa opção).

Se quiser, começo a criar as instruções de `railway` CLI e o `railway` project config local (não consigo executar o deploy na sua conta sem credenciais). Diga se quer que eu gere um `railway-init.sh` com os comandos que você só precisará executar localmente.
