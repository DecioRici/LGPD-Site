# Dashboard Kanban Logístico

Versão acadêmica e anonimizada do Trabalho de Conclusão de Curso de Décio Rici Neto, apresentado ao curso de Engenharia de Produção do UNISAGRADO

## Objetivo

Desenvolver um dashboard operacional a partir dos dados de um Kanban digital para analisar o fluxo de caminhões em um pátio logístico

## Escopo da versão pública

- site de apresentação do projeto
- indicadores agregados de 241 agendamentos
- trabalho completo em PDF
- descrição das tecnologias e regras de análise
- nenhuma credencial, endereço interno ou identificação da empresa

## Tecnologias

- JavaScript para a interface e as visualizações do site
- SQL no armazenamento dos eventos do projeto original
- Python no tratamento, validação e cálculo dos indicadores
- Excel na consolidação e conferência independente

## Principais resultados

- média de permanência: 4h01
- mediana de permanência: 2h04
- registros acima do limite de Tukey de 10h18: 18
- expedição: 195 registros
- matéria-prima: 46 registros

Os resultados caracterizam o período analisado. O estudo não comprova redução de filas, custos ou tempo porque não houve comparação controlada antes e depois da implantação

## Execução local

O site é estático. Abra `index.html` em um navegador ou execute um servidor HTTP local

```bash
python -m http.server 8000
```

Depois, acesse `http://localhost:8000`

## Privacidade

A empresa é identificada somente como empresa do setor de alimentos. A base operacional bruta não integra este repositório
