# Banco compartilhado do Kanban

O módulo `/controle-patio/` pode guardar os registros e o histórico no PostgreSQL do Supabase. Uma única linha armazena a base compacta e sua revisão. A atualização dos registros e do histórico acontece na mesma gravação. O controle de revisão rejeita alterações feitas sobre uma versão desatualizada.

## Ativação

1. Crie um projeto em https://supabase.com/dashboard e aguarde a inicialização.
2. Abra o SQL Editor do projeto e execute o conteúdo de `supabase/kanban.sql`. O arquivo pode ser executado novamente e preserva os dados existentes.
3. No painel do projeto Vercel que publica o site, abra Settings e depois Environment Variables. Cadastre as três variáveis abaixo para o ambiente em que vai usar o banco.
4. Faça um novo deployment da versão que contém esta integração.
5. Acesse `/controle-patio/`, entre com a senha escolhida e confira o indicador de base compartilhada.
6. No navegador que contém os registros antigos, clique em **Importar deste navegador**. A importação acrescenta os códigos internos ausentes e preserva as versões que já estão no banco.

| Variável na Vercel | Valor |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto Supabase, disponível nas configurações de API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de servidor do projeto, disponível nas configurações de API. Pode ser a chave secreta atual ou a chave legada `service_role`. |
| `KANBAN_ACCESS_PASSWORD` | Senha de acesso ao quadro, com 16 a 256 caracteres. Use uma senha longa e exclusiva. |

Cadastre a chave somente nas variáveis do servidor da Vercel. A página acessa a API `/api/patio` com uma sessão em cookie HttpOnly. A chave do Supabase fica no servidor. As permissões SQL impedem acesso direto à tabela pelos papéis `anon` e `authenticated`.

## Uso

- Usuários que entrarem com a mesma senha acessam o mesmo quadro.
- A página consulta atualizações a cada 10 segundos quando está visível e o formulário de cadastro está fechado.
- Se outro usuário alterar a base antes de uma gravação, o sistema recarrega a versão atual. Reabra o formulário e refaça a alteração.
- Se a conexão falhar durante uma gravação, o sistema mantém a operação pendente na sessão do navegador. Clique em **Sincronizar** para repetir a mesma operação.
- Os registros anteriores do navegador permanecem disponíveis para importação.
- Os botões de dados de teste e limpeza afetam a base compartilhada e pedem confirmação.
- A aba Levantamento mantém seu conjunto fixo de cinco atendimentos.
- Esta implementação compacta aceita até 2.000 registros, 20.000 eventos e 3 MB por gravação. Para volumes maiores, use tabelas separadas para atendimentos e eventos.

Quando todas as três variáveis estiverem ausentes, o quadro usa o armazenamento local existente. Uma configuração parcial apresenta erro e bloqueia a gravação até ser corrigida.

## Conferência

Execute `node --test tests/patio-storage.test.mjs` com Node.js 22 ou superior.

Os testes cobrem acesso por senha, origem das requisições, gravação atômica, conflito de revisão, repetição de operações e falhas do banco. A validação com o banco real depende da ativação acima.

## Documentação dos serviços

- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://vercel.com/docs/functions/runtimes/node-js
