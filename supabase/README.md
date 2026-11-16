# Banco compartilhado do Kanban

O módulo `/controle-patio/` pode guardar os registros e o histórico no PostgreSQL do Supabase. Uma única linha armazena a base compacta e sua revisão. A atualização dos registros e do histórico acontece na mesma gravação. O controle de revisão rejeita alterações feitas sobre uma versão desatualizada.

## Ativação

1. Crie um projeto em https://supabase.com/dashboard e aguarde a inicialização.
2. Abra o SQL Editor do projeto e execute o conteúdo de `supabase/kanban.sql`. O arquivo pode ser executado novamente e preserva os dados existentes.
3. Para usar a função autenticada, publique `supabase/functions/patio-store/index.ts` no Supabase com o nome `patio-store`. A função autentica as requisições com um token próprio; configure a verificação JWT da plataforma como desativada apenas para essa função.
4. Crie o token privado com o SQL abaixo. Ele retorna o token somente na primeira criação. Guarde o valor nas variáveis privadas da Vercel; a tabela armazena somente seu SHA-256.

```sql
with material as materialized (
  select replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') as token
), saved as (
  insert into public.patio_backend_keys(id,token_hash)
  select 'vercel',encode(sha256(convert_to(token,'UTF8')),'hex') from material
  on conflict(id) do nothing returning id
)
select token as backend_token from material cross join saved;
```

5. No painel do projeto Vercel que publica o site, abra Settings e depois Environment Variables. Cadastre as três variáveis abaixo para o ambiente em que vai usar o banco.
6. Faça um novo deployment da versão que contém esta integração.
7. Acesse `/controle-patio/`, entre com a senha escolhida e confira o indicador de base compartilhada.
8. No navegador que contém os registros antigos, clique em **Importar deste navegador**. A importação acrescenta os códigos internos ausentes e preserva as versões que já estão no banco.

| Variável na Vercel | Valor |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto Supabase, disponível nas configurações de API. |
| `SUPABASE_BACKEND_TOKEN` | Token privado de 64 caracteres gerado no passo 4. Permite acesso somente ao quadro pela função `patio-store`. |
| `KANBAN_ACCESS_PASSWORD` | Senha de acesso ao quadro, com 16 a 256 caracteres. Use uma senha longa e exclusiva. |

Cadastre o token somente nas variáveis privadas do servidor da Vercel, no ambiente de produção. A função `patio-store` utiliza as credenciais que o Supabase fornece ao próprio ambiente para acessar as tabelas; essas credenciais não são copiadas para a Vercel.

Como alternativa, sem a função, a API aceita `SUPABASE_SERVICE_ROLE_KEY` no lugar de `SUPABASE_BACKEND_TOKEN`. Nessa opção, use a chave secreta do projeto apenas no servidor. A página acessa a API `/api/patio` com uma sessão em cookie HttpOnly. A chave do Supabase fica no servidor. As permissões SQL impedem acesso direto à tabela pelos papéis `anon` e `authenticated`.

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

Execute `node --test tests/patio-storage.test.mjs tests/patio-edge.test.mjs` com Node.js 22 ou superior.

Os testes cobrem acesso por senha, origem das requisições, gravação atômica, conflito de revisão, repetição de operações e falhas do banco. A função tem testes de token, restrição de consultas, revisão e tratamento de falhas. A validação com o banco real deve incluir duas sessões, uma gravação, releitura e conflito de revisão; remova somente os registros temporários criados para esse teste.

## Documentação dos serviços

- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://vercel.com/docs/functions/runtimes/node-js
