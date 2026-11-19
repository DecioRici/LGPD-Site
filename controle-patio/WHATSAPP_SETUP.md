# Chamada real para a balança

O botão chama diretamente a API oficial da Meta. Não abre o WhatsApp Web. O código permanece desativado até a configuração do remetente.

Na conta WhatsApp Business Platform, conecte o número remetente e aprove um modelo de utilidade chamado `chamada_balanca`, idioma Português (Brasil), com parâmetros posicionais no corpo:

> Olá, {{1}}. O caminhão de placa {{2}} está sendo chamado para a {{3}}. Dirija-se à balança, por favor.

Parâmetros: nome do motorista, placa e `pesagem inicial` ou `pesagem final`. A classificação e aprovação dependem da Meta.

Configure na Vercel, em **Settings → Environment Variables**, para Production:

| Variável | Conteúdo |
| --- | --- |
| WHATSAPP_ACCESS_TOKEN | Token privado da conta com permissão de envio |
| WHATSAPP_PHONE_NUMBER_ID | ID do número remetente, não o telefone digitado |
| WHATSAPP_TEMPLATE_NAME | chamada_balanca, após aprovação |
| WHATSAPP_TEMPLATE_LANGUAGE | pt_BR |
| WHATSAPP_ALLOWED_RECIPIENTS | Telefones autorizados nesta demonstração, separados por vírgulas, com 55 e DDD |
| WHATSAPP_API_VERSION | v27.0 |

Marque o token como Sensitive. Nunca coloque o token em HTML, JavaScript do navegador, repositório ou conversa. Refaça o deployment após salvar as variáveis.

O banco limita a demonstração a 100 tentativas, inclusive falhas e envios de resultado incerto. O limite não reinicia com recarga ou deployment. Cada veículo só recebe uma chamada por entrada na etapa. Repetir o clique não dispara novamente a mesma chamada. O destinatário deve estar na lista autorizada e no cadastro atual do veículo.

No site, informe o WhatsApp no cadastro e use **Chamar para a balança** em Aguardando no Pátio ou Carregamento ou Descarga. Confira os dados e clique em **Enviar chamada**. O envio não movimenta o cartão.

O retorno de um ID pela Meta confirma aceitação para envio; não comprova entrega ou leitura. Nenhuma mensagem real deve ser anunciada como entregue sem essa confirmação. O projeto não ativa plano pago nem compra pacotes automaticamente. O teste inicial deve ser feito com o próprio número antes de chamar um motorista autorizado.
