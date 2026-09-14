# Controle de Pátio Logístico

Sistema de controle de veículos e operações de pátio logístico.

## Aplicações

- **Versão web:** HTML, CSS e JavaScript, executada diretamente no navegador.
- **Protótipo acadêmico:** Python, Streamlit, pandas e SQLite, executado localmente.

## Acesso

https://lgpd-site-mocha.vercel.app/controle-patio/

## Recursos

- cadastro e edição de veículos;
- quadro Kanban com sete etapas;
- avanço, retorno, movimentação direta e cancelamento lógico;
- histórico de movimentações;
- filtros operacionais;
- indicadores por etapa, operação e modalidade de frete;
- exportação CSV.

## Executar a versão Python

```bash
pip install -r requirements.txt
streamlit run app.py
```

O banco `kanban_logistico.db` é criado localmente na primeira execução.

## Privacidade

Não publique dados pessoais, credenciais ou registros operacionais sem autorização.
