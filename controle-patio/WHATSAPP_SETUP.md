# Chamada para a balança pelo Whapi.Cloud

1. No Whapi.Cloud, conecte o WhatsApp remetente por QR Code e finalize o assistente. Para enviar texto, deixe webhooks, downloads automáticos e proxy desativados/vazios.
2. No painel do canal, copie o API Token. Não envie o token na conversa nem inclua em capturas de tela.
3. Na Vercel, projeto lgpd-site, abra Settings → Environment Variables, selecione Production e salve:

| Nome | Valor |
| --- | --- |
| WHAPI_TOKEN | API Token do canal conectado, como Secret/Sensitive |
| WHATSAPP_ALLOWED_RECIPIENTS | Telefones dos destinatários autorizados, separados por vírgula, com 55 e DDD, somente números |

4. Refaça o deployment após salvar as variáveis. As credenciais do banco já configuradas permanecem necessárias.
5. No cadastro do veículo, preencha o WhatsApp do motorista com DDD. Na etapa Aguardando no Pátio ou Carregamento ou Descarga, clique em Chamar para a balança, confira o telefone e confirme Enviar chamada.

Mensagem enviada:

> Olá, [motorista]. O caminhão de placa [placa] está sendo chamado para a [pesagem inicial/final]. Dirija-se à balança, por favor.

O banco limita a demonstração a 100 tentativas, inclusive falhas e resultados incertos. O limite não reinicia com recarga ou deployment. Repetir o clique não dispara novamente a mesma chamada por veículo/entrada na etapa. Não há reenvio automático após falha ou timeout.

A resposta positiva da API confirma aceitação do envio; não comprova entrega ou leitura. A chamada não movimenta o cartão. Webhooks de recebimento e entrega não estão configurados. Nenhuma assinatura ou compra é ativada pelo site. O Sandbox do fornecedor tem limites próprios, incluindo até 5 conversas por mês e 150 mensagens por dia; confira os limites atuais no painel.
