# Gestão de Fluxo Logístico

Aplicação web para controle de veículos e acompanhamento das etapas de uma operação de pátio.

## Acesso

https://lgpd-site-mocha.vercel.app/

## Recursos

- cadastro e edição de veículos;
- fluxo Kanban com sete etapas operacionais;
- avanço, retorno e cancelamento lógico;
- histórico de movimentações;
- filtros por etapa, operação e modalidade de frete;
- indicadores de quantidade e permanência;
- exportação dos registros em CSV;
- conjunto opcional de dados fictícios para demonstração.

## Tecnologias

A versão web utiliza HTML, CSS e JavaScript. O módulo `controle-patio` pode armazenar registros e histórico em uma base PostgreSQL compartilhada do Supabase, acessada pela API da Vercel com senha. Consulte [a configuração do banco](supabase/README.md). Quando o banco não está configurado, o módulo utiliza o localStorage do navegador.

## Uso responsável

Utilize somente dados fictícios ou informações cujo tratamento esteja autorizado. Ao limpar os dados do navegador, os registros locais são removidos.
