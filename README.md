# MostrarIP

Site que exibe o IP e informações do visitante, com painel admin para ver todos os acessos.

## Deploy no Railway

1. Suba o código para um repositório GitHub
2. Acesse [railway.app](https://railway.app) e crie um novo projeto a partir do repositório
3. Configure as variáveis de ambiente abaixo em **Settings → Variables**

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `JWT_SECRET` | Chave secreta para assinar os tokens JWT (obrigatório) | `uma_chave_longa_e_aleatoria` |
| `NODE_ENV` | Ambiente de execução | `production` |
| `DATABASE_URL` | URL do MySQL (opcional — sem ela usa memória) | `mysql://user:pass@host/db` |

> **Sem `DATABASE_URL`**: os dados ficam em memória e são perdidos ao reiniciar. Para persistência, adicione um banco MySQL no Railway (Add Service → MySQL).

## Conta Admin padrão

- **Email:** a@gmail.com  
- **Senha:** 123456

## Rodar localmente

```bash
pnpm install
pnpm dev
```
