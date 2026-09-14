# Sistema Kanban digital para pátio logístico

Página acadêmica do Trabalho de Conclusão de Curso de Décio Rici Neto, apresentado ao curso de Engenharia de Produção do UNISAGRADO em 2026.

## Objetivo

Desenvolver um protótipo funcional de sistema Kanban digital em Python para apoiar o controle operacional de caminhões em pátio logístico.

## Escopo da pesquisa

- fluxo visual com sete etapas, do agendamento à liberação;
- cadastro operacional e movimentação de cards;
- histórico de origem, destino, ação e horário;
- filtros, indicadores, análise por etapa e exportação em CSV;
- validação funcional com quatro operações simuladas;
- nenhuma identificação de empresa ou dado operacional real.

## Tecnologias do protótipo

- Python para regras, consultas, movimentações e indicadores;
- Streamlit para a interface;
- pandas para organização tabular;
- SQLite para armazenamento local.

JavaScript é utilizado somente nesta página de apresentação. Excel não é necessário para executar o protótipo, mas pode abrir os arquivos CSV exportados. O código operacional do protótipo não integra esta publicação.

## Interpretação dos resultados

Os testes funcionais atenderam aos cenários de cadastro, avanço, retorno, cancelamento lógico, filtros, indicadores, análise operacional e exportação. Como a validação utilizou dados simulados e não houve implantação real, o trabalho não afirma redução de filas, custos, mão de obra ou tempo de permanência.

## Página publicada

https://lgpd-site-mocha.vercel.app/tcc/

## Execução local da página

```bash
python -m http.server 8000
```

Depois, acesse `http://localhost:8000/tcc/`.
