-- Estrutura acadêmica simplificada. Não contém dados operacionais da empresa.
CREATE TABLE agendamentos (
    id INTEGER PRIMARY KEY,
    fluxo VARCHAR(30) NOT NULL,
    modalidade_frete VARCHAR(10),
    material VARCHAR(80),
    check_in TIMESTAMP NOT NULL,
    liberacao TIMESTAMP,
    conclusao TIMESTAMP NOT NULL,
    tempo_patio_min INTEGER,
    tempo_fila_min INTEGER,
    tempo_primeira_pesagem_min INTEGER,
    tempo_operacao_min INTEGER,
    tempo_segunda_pesagem_min INTEGER,
    tempo_total_min INTEGER NOT NULL
);

CREATE INDEX idx_agendamentos_fluxo ON agendamentos (fluxo);
CREATE INDEX idx_agendamentos_check_in ON agendamentos (check_in);
