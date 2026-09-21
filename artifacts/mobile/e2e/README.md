# Teste autenticado da Central

O cenário `notificacoes.spec.ts` usa uma conta Clerk de E2E dedicada e valida o
fluxo real do Expo Web:

1. abre uma sessão por e-mail;
2. navega por Perfil até Notificações;
3. força duas respostas de erro para cobrir o retry automático e exibir a ação
   manual;
4. confirma que o retry manual carrega a Central sem spinner infinito.

O teste não cria equipe, clientes, ordens ou orçamentos. A resposta de
`/api/notifications` é isolada com um fixture vazio no navegador; as chamadas
de autenticação e de perfil continuam reais. Use uma conta que pertença apenas
à equipe reservada para E2E e que não seja usada por pessoas.

## Executar

Defina `E2E_EMAIL`, `E2E_PASSWORD` e `E2E_TEAM_NAME` para a conta e a equipe
reservadas. O comando também precisa dos valores de desenvolvimento já usados
pelo app:

```sh
E2E_EMAIL=... E2E_PASSWORD=... E2E_TEAM_NAME=... \
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN \
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY \
pnpm --filter @workspace/mobile run test:e2e
```

O teste inicia o Expo Web automaticamente. Para usar um servidor já iniciado,
informe `E2E_BASE_URL`; nesse caso o servidor local não é iniciado.

## GitHub Actions

O workflow `.github/workflows/mobile-authenticated-e2e.yml` executa esse cenário
automaticamente em pushes para `main` e também pode ser disparado manualmente.
Configure estes segredos no repositório do GitHub antes da primeira execução:

- `E2E_EMAIL`: e-mail da conta Clerk reservada para E2E;
- `E2E_PASSWORD`: senha dessa conta;
- `E2E_TEAM_NAME`: nome exato da equipe reservada;
- `EXPO_PUBLIC_DOMAIN`: domínio `.replit.dev` que expõe a API usada pelo teste;
- `CLERK_PUBLISHABLE_KEY`: chave pública do Clerk desse ambiente.

O workflow injeta os valores apenas no job, instala o Chromium com as
dependências do sistema e executa `e2e/notificacoes.spec.ts`. Não adicione
credenciais, `storageState` ou arquivos de sessão ao repositório. Em caso de
falha, o workflow publica por 14 dias o trace, screenshots, vídeo e relatório
HTML gerados pelo Playwright como artefatos da execução.
