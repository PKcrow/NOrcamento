# Notificações de pagamento no Android

## Como a remoção funciona

As notificações de pagamento pendente usam o identificador estável
`gestao-autonomos:payment:<id-da-O.S.>`. O identificador é gravado junto com os
agendamentos locais, então uma nova sincronização não cria outra notificação
para a mesma O.S.

Quando o pagamento é registrado em outro dispositivo, a API envia um push
headless com `notificationType=payment_recorded`. A tarefa de notificação em
segundo plano, registrada pelo `expo-notifications`, procura notificações
pendentes da mesma O.S. no Android e cancela tanto o agendamento quanto a
notificação já apresentada. Isso acontece sem abrir a interface do aplicativo.

## Retry e confirmação

- Para `payment_recorded`, a API confere o ticket e o recibo do Expo. Falhas,
  ticket sem identificador ou recibo ausente mantêm o token na fila da chamada
  e geram no máximo três tentativas.
- Todas as tentativas usam o mesmo `collapseId` e o mesmo identificador local da
  O.S., então reenviar o controle não cria uma nova pendência local.
- Tokens marcados como `DeviceNotRegistered` são descartados. Se a limpeza local
  falhar ou a notificação continuar apresentada, o aparelho grava a O.S. para
  tentar novamente na próxima sincronização.

## Limitações do Expo Push Service

- O Expo Push Service não oferece uma API para um servidor cancelar
  diretamente um identificador de notificação local.
- O fluxo depende da entrega do push headless pelo FCM e da execução da tarefa
  em segundo plano. O Android pode atrasar ou não executar essa tarefa em
  modo Doze, economia agressiva de bateria, falta de rede ou depois de o
  usuário forçar a parada do aplicativo.
- Se o Android não entregar o evento headless, a sincronização normal ao abrir
  o app continua removendo a pendência. O recurso não deve ser tratado como
  garantia de entrega em tempo real.

## Validação de produção

Validar em um APK/AAB de produção (não no Expo Go):

1. Instalar o build em dois Androids e conceder permissão de notificações.
2. No aparelho A, sincronizar uma O.S. concluída e confirmar a pendência
   persistente.
3. Fechar o app no aparelho A sem usar “Forçar parada”.
4. Registrar o pagamento no aparelho B.
5. Confirmar que a notificação da mesma O.S. desaparece no aparelho A sem
   abrir a interface do app.
6. Repetir o teste com o aparelho A em economia de bateria e registrar que o
   Android pode adiar a remoção até permitir a execução do headless push.