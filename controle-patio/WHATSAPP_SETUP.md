# Chamada para a balança pelo Whapi.Cloud

1. No Whapi.Cloud, conecte o WhatsApp remetente por QR Code e finalize o assistente. Para enviar texto, deixe webhooks, downloads automáticos e proxy desativados/vazios.
2. No painel do canal, copie o API Token. Não envie o token na conversa nem inclua em capturas de tela.
3. Na Vercel, projeto lgpd-site, abra Settings → Environment Variables, selecione Production e salve:

| Nome | Valor |
| --- | --- |
| WHAPI_TOKEN | API Token do canal conectado, como Secret/Sensitive |

4. Refaça o deployment após salvar as variáveis. As credenciais do banco já configuradas permanecem necessárias.
5. No cadastro do veículo, preencha o WhatsApp do motorista com DDD. Na etapa Aguardando no Pátio ou Carregamento ou Descarga, clique em Chamar para a balança, confira o telefone e confirme Enviar chamada.

Mensagem enviada:

> Olá, [motorista]. O caminhão de placa [placa] está sendo chamado para a [pesagem inicial/final]. Dirija-se à balança, por favor.

O envio usa o telefone salvo no cadastro atual do veículo. Não é necessário autorizar cada motorista nas variáveis da Vercel: o banco exige a correspondência exata do telefone, veículo e etapa.

Não há limite de demonstração imposto pelo site. O plano contratado no Whapi.Cloud continua determinando as condições do fornecedor. O site não contrata nem altera assinaturas.

Após o envio, o sistema mostra “Mensagem enviada” e libera “Chamar novamente” após 1 minuto. O intervalo vale também ao recarregar a página ou abrir o mesmo veículo em outro navegador. Cada tentativa tem um identificador próprio: repetir a mesma requisição não envia a mensagem duas vezes. Uma nova chamada deliberada após o intervalo usa outro identificador.

A confirmação de envio não representa confirmação de entrega ou leitura. A chamada não movimenta o cartão. Webhooks de recebimento e entrega não estão configurados.
