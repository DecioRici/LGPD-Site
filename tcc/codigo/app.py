# =====================================================
# KANBAN LOGÍSTICO — CONTROLE DE PÁTIO
# Arquivo: app.py
# Executar: streamlit run app.py
# =====================================================

import html
import sqlite3
from datetime import date, datetime, time, timedelta
from pathlib import Path

import pandas as pd
import streamlit as st

# =====================================================
# CONFIGURAÇÕES GERAIS
# =====================================================
st.set_page_config(
    page_title="Controle de Pátio Logístico",
    page_icon="🚚",
    layout="wide",
    initial_sidebar_state="expanded",
)

DB_PATH = Path("kanban_logistico.db")

ETAPAS = [
    "Agendado",
    "Check-in",
    "Aguardando no Pátio",
    "Pesagem Inicial",
    "Carregamento/Descarga",
    "Pesagem Final",
    "Liberado",
]

CORES = {
    "Agendado": "#3B82F6",
    "Check-in": "#22C55E",
    "Aguardando no Pátio": "#F59E0B",
    "Pesagem Inicial": "#A855F7",
    "Carregamento/Descarga": "#F97316",
    "Pesagem Final": "#06B6D4",
    "Liberado": "#16A34A",
}

ICONES = {
    "Agendado": "📅",
    "Check-in": "✅",
    "Aguardando no Pátio": "⏳",
    "Pesagem Inicial": "⚖️",
    "Carregamento/Descarga": "🏗️",
    "Pesagem Final": "⚖️",
    "Liberado": "🚚",
}

UNIDADES = ["t", "kg", "L", "m³", "un"]
OPERACOES = ["DESCARGA", "CARGA"]
FRETES = ["FOB", "CIF"]

# =====================================================
# CSS
# =====================================================
st.markdown(
    """
<style>
.stApp {background:#070D18; color:#F8FAFC;}
.block-container {max-width:100%; padding-top:1.1rem; padding-left:1.2rem; padding-right:1.2rem;}
header, footer, #MainMenu {visibility:hidden;}
section[data-testid="stSidebar"] {background:linear-gradient(180deg,#07111F 0%,#0A1628 100%); border-right:1px solid rgba(148,163,184,.18);}
section[data-testid="stSidebar"] * {color:#E2E8F0;}
.main-title {font-size:34px; font-weight:950; color:#F8FAFC; border-left:6px solid #2563EB; padding-left:15px; line-height:1.05; margin-bottom:4px;}
.subtitle {color:#94A3B8; font-size:15px; margin-left:22px; margin-bottom:18px;}
.kpi-card {border-radius:18px; padding:18px 20px; min-height:112px; border:1px solid rgba(148,163,184,.22); box-shadow:0 18px 35px rgba(0,0,0,.26);}
.kpi-blue {background:linear-gradient(135deg,rgba(37,99,235,.40),rgba(15,23,42,.96));}
.kpi-green {background:linear-gradient(135deg,rgba(34,197,94,.34),rgba(15,23,42,.96));}
.kpi-yellow {background:linear-gradient(135deg,rgba(245,158,11,.36),rgba(15,23,42,.96));}
.kpi-purple {background:linear-gradient(135deg,rgba(168,85,247,.38),rgba(15,23,42,.96));}
.kpi-red {background:linear-gradient(135deg,rgba(239,68,68,.34),rgba(15,23,42,.96));}
.kpi-label {color:#E2E8F0; font-size:14px; font-weight:850;}
.kpi-value {color:#FFF; font-size:32px; font-weight:950; margin-top:8px;}
.kpi-desc {color:#CBD5E1; font-size:13px; margin-top:6px;}
div[data-testid="column"] {padding-left:.18rem !important; padding-right:.18rem !important;}
.kanban-col {background:linear-gradient(180deg,#101827 0%,#0B1220 100%); border:1px solid rgba(148,163,184,.22); border-radius:16px; padding:0 10px 10px 10px; min-height:0!important; height:auto!important; box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 18px rgba(0,0,0,.16); margin-bottom:0;}
.col-top {height:5px; border-radius:16px 16px 0 0; margin:0 -10px 12px -10px;}
.col-header {display:flex; align-items:flex-start; gap:8px; min-height:74px; margin-bottom:0;}
.step-number {min-width:34px; width:34px; height:34px; border-radius:50%; color:#020617; font-weight:950; display:flex; align-items:center; justify-content:center; font-size:14px; margin-top:2px;}
.col-title {color:#FFF; font-size:15px; font-weight:950; line-height:1.25;}
.col-count {color:#CBD5E1; font-size:13px; font-weight:850; margin-top:2px;}
.empty-card {border:1px dashed rgba(148,163,184,.22); background:rgba(15,23,42,.35); border-radius:14px; min-height:300px; display:flex; align-items:flex-start; justify-content:center; text-align:center; color:#64748B; font-size:13px; padding:80px 10px 10px 10px; margin-top:0;}
.empty-icon {font-size:34px; opacity:.55; margin-bottom:8px;}
.truck-card {background:linear-gradient(180deg,#172033 0%,#0F172A 100%); color:#F8FAFC; border-radius:14px; padding:14px; margin-top:0!important; margin-bottom:8px; border:1px solid rgba(96,165,250,.30); border-left:5px solid #3B82F6; box-shadow:0 16px 28px rgba(0,0,0,.32);}
.card-header {display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px;}
.card-date {color:#CBD5E1; font-size:11px; font-weight:850;}
.card-pedido {color:#60A5FA; font-size:14px; font-weight:950; margin-bottom:8px;}
.badge {display:inline-block; border-radius:8px; padding:4px 7px; font-size:10px; font-weight:950; color:white; white-space:nowrap;}
.badge-blue {background:#2563EB;}
.badge-green {background:#16A34A;}
.badge-purple {background:#7C3AED;}
.badge-orange {background:#F97316;}
.badge-red {background:#DC2626;}
.info-line {color:#E5E7EB; font-size:11px; font-weight:750; line-height:1.35; margin-top:7px;}
.info-label {color:#93C5FD; font-weight:950;}
.card-time {border-top:1px solid rgba(148,163,184,.35); color:#F8FAFC; font-size:12px; font-weight:950; padding-top:8px; margin-top:10px;}
.stButton > button {width:100%; border-radius:10px; border:1px solid rgba(148,163,184,.25); background:#111827; color:#FFF; font-weight:950; min-height:34px; padding:.25rem .45rem;}
.stButton > button:hover {background:#2563EB; border-color:#60A5FA; color:#FFF;}
[data-testid="stForm"] {background:rgba(15,23,42,.84); border:1px solid rgba(148,163,184,.20); border-radius:18px; padding:22px;}
.legend-box, .about-box {background:rgba(15,23,42,.82); border:1px solid rgba(148,163,184,.20); border-radius:18px; padding:18px; color:#E2E8F0;}
.small-note {color:#94A3B8; font-size:13px;}
</style>
""",
    unsafe_allow_html=True,
)

# =====================================================
# BANCO DE DADOS
# =====================================================
def conectar():
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def coluna_existe(conn, tabela, coluna):
    info = conn.execute(f"PRAGMA table_info({tabela})").fetchall()
    return coluna in [item[1] for item in info]


def adicionar_coluna_se_nao_existe(conn, tabela, coluna, definicao):
    if not coluna_existe(conn, tabela, coluna):
        conn.execute(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {definicao}")


def criar_banco():
    with conectar() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS caminhoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pedido TEXT NOT NULL,
                placa TEXT NOT NULL,
                motorista TEXT NOT NULL,
                cpf TEXT,
                transportadora TEXT,
                produto TEXT NOT NULL,
                quantidade REAL NOT NULL DEFAULT 0,
                unidade TEXT NOT NULL DEFAULT 't',
                operacao TEXT NOT NULL,
                frete TEXT NOT NULL,
                agendamento TEXT NOT NULL,
                status TEXT NOT NULL,
                entrada_status TEXT NOT NULL,
                criado_em TEXT NOT NULL,
                finalizado_em TEXT,
                cancelado INTEGER DEFAULT 0,
                observacao TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caminhao_id INTEGER NOT NULL,
                pedido TEXT NOT NULL,
                placa TEXT NOT NULL,
                etapa_origem TEXT,
                etapa_destino TEXT NOT NULL,
                momento TEXT NOT NULL,
                acao TEXT NOT NULL,
                FOREIGN KEY(caminhao_id) REFERENCES caminhoes(id)
            )
            """
        )

        # Migração para bancos antigos.
        adicionar_coluna_se_nao_existe(conn, "caminhoes", "quantidade", "REAL NOT NULL DEFAULT 0")
        adicionar_coluna_se_nao_existe(conn, "caminhoes", "unidade", "TEXT NOT NULL DEFAULT 't'")
        conn.commit()


def carregar_caminhoes():
    with conectar() as conn:
        return pd.read_sql_query("SELECT * FROM caminhoes ORDER BY agendamento DESC, id DESC", conn)


def carregar_historico():
    with conectar() as conn:
        return pd.read_sql_query("SELECT * FROM historico ORDER BY momento DESC", conn)





def registrar_historico(caminhao_id, pedido, placa, origem, destino, acao):
    agora = datetime.now().isoformat(timespec="seconds")
    with conectar() as conn:
        conn.execute(
            """
            INSERT INTO historico (caminhao_id, pedido, placa, etapa_origem, etapa_destino, momento, acao)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (caminhao_id, pedido, placa, origem, destino, agora, acao),
        )
        conn.commit()


def inserir_caminhao(
    pedido,
    placa,
    motorista,
    cpf,
    transportadora,
    produto,
    quantidade,
    unidade,
    operacao,
    frete,
    agendamento,
    observacao,
):
    agora = datetime.now().isoformat(timespec="seconds")
    agendamento_str = agendamento.isoformat(timespec="minutes")
    with conectar() as conn:
        cur = conn.execute(
            """
            INSERT INTO caminhoes (
                pedido, placa, motorista, cpf, transportadora, produto, quantidade, unidade,
                operacao, frete, agendamento, status, entrada_status, criado_em,
                finalizado_em, cancelado, observacao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)
            """,
            (
                pedido,
                placa,
                motorista,
                cpf,
                transportadora,
                produto,
                float(quantidade),
                unidade,
                operacao,
                frete,
                agendamento_str,
                "Agendado",
                agora,
                agora,
                observacao,
            ),
        )
        caminhao_id = cur.lastrowid
        conn.commit()
    registrar_historico(caminhao_id, pedido, placa, None, "Agendado", "Cadastro")


def atualizar_status(row, novo_status, acao):
    agora = datetime.now().isoformat(timespec="seconds")
    finalizado_em = agora if novo_status == "Liberado" else None
    with conectar() as conn:
        conn.execute(
            """
            UPDATE caminhoes
            SET status = ?, entrada_status = ?, finalizado_em = ?
            WHERE id = ?
            """,
            (novo_status, agora, finalizado_em, int(row["id"])),
        )
        conn.commit()
    registrar_historico(int(row["id"]), row["pedido"], row["placa"], row["status"], novo_status, acao)


def cancelar_card(row):
    with conectar() as conn:
        conn.execute("UPDATE caminhoes SET cancelado = 1 WHERE id = ?", (int(row["id"]),))
        conn.commit()
    registrar_historico(int(row["id"]), row["pedido"], row["placa"], row["status"], row["status"], "Cancelamento")


def limpar_base():
    with conectar() as conn:
        conn.execute("DELETE FROM historico")
        conn.execute("DELETE FROM caminhoes")

        conn.commit()


def carregar_exemplos():
    limpar_base()
    exemplos = [
        ("DEMO-001", "ABC1D23", "MOTORISTA 01", "", "TRANSPORTADORA ALFA", "PRODUTO A", 32000, "kg", "DESCARGA", "FOB", datetime.now() + timedelta(hours=1), "Registro fictício"),
        ("DEMO-002", "DEF4G56", "MOTORISTA 02", "", "TRANSPORTADORA BETA", "PRODUTO B", 28000, "kg", "CARGA", "CIF", datetime.now() + timedelta(hours=2), "Registro fictício"),
        ("DEMO-003", "GHI7J89", "MOTORISTA 03", "", "TRANSPORTADORA GAMA", "PRODUTO C", 30000, "kg", "DESCARGA", "FOB", datetime.now() + timedelta(hours=3), "Registro fictício"),
        ("DEMO-004", "JKL0M12", "MOTORISTA 04", "", "TRANSPORTADORA DELTA", "PRODUTO D", 24000, "kg", "CARGA", "CIF", datetime.now() + timedelta(hours=4), "Registro fictício"),
    ]
    for item in exemplos:
        inserir_caminhao(*item)

    df = carregar_caminhoes()
    if not df.empty:
        for pedido, etapa in [("DEMO-002", "Pesagem Inicial"), ("DEMO-003", "Check-in")]:
            achado = df[df["pedido"] == pedido]
            if not achado.empty:
                atualizar_status(achado.iloc[0], etapa, "Carga de exemplo")


criar_banco()

# =====================================================
# FUNÇÕES AUXILIARES
# =====================================================
def limpar_texto(valor):
    return html.escape(str(valor if valor is not None else "").strip())


def parse_dt(valor):
    if pd.isna(valor) or valor is None or str(valor).strip() == "":
        return None
    return datetime.fromisoformat(str(valor))


def tempo_minutos(valor_iso):
    dt = parse_dt(valor_iso)
    if not dt:
        return 0
    return max(0, int((datetime.now() - dt).total_seconds() / 60))


def df_ativos(df):
    if df.empty:
        return df.copy()
    return df[df["cancelado"] == 0].copy()


def contar_etapa(df, etapa):
    if df.empty:
        return 0
    return int(len(df[(df["status"] == etapa) & (df["cancelado"] == 0)]))


def tempo_medio_patio(df):
    ativos = df_ativos(df)
    if ativos.empty:
        return 0
    em_andamento = ativos[ativos["status"] != "Liberado"].copy()
    if em_andamento.empty:
        return 0
    return int(em_andamento["criado_em"].apply(tempo_minutos).mean())


def maior_gargalo(df):
    ativos = df_ativos(df)
    if ativos.empty:
        return "Sem dados"
    andamento = ativos[ativos["status"] != "Liberado"]
    if andamento.empty:
        return "Sem gargalo"
    return str(andamento["status"].value_counts().index[0])


def avancar_card(row):
    idx = ETAPAS.index(row["status"])
    if idx < len(ETAPAS) - 1:
        atualizar_status(row, ETAPAS[idx + 1], "Avanço de etapa")


def voltar_card(row):
    idx = ETAPAS.index(row["status"])
    if idx > 0:
        atualizar_status(row, ETAPAS[idx - 1], "Retorno de etapa")


def preparar_movimentacao(df):
    if df.empty:
        return pd.DataFrame()

    mov = df_ativos(df)
    if mov.empty:
        return pd.DataFrame()

    mov = mov.copy()
    mov["agendamento_dt"] = pd.to_datetime(mov["agendamento"], errors="coerce")
    mov = mov.dropna(subset=["agendamento_dt"])
    mov["data"] = mov["agendamento_dt"].dt.date
    mov["hora"] = mov["agendamento_dt"].dt.hour
    mov["quantidade"] = pd.to_numeric(mov["quantidade"], errors="coerce").fillna(0)
    mov["entrada_prevista"] = mov.apply(lambda r: r["quantidade"] if r["operacao"] == "DESCARGA" else 0, axis=1)
    mov["saida_prevista"] = mov.apply(lambda r: r["quantidade"] if r["operacao"] == "CARGA" else 0, axis=1)
    mov["saldo_previsto"] = mov["entrada_prevista"] - mov["saida_prevista"]
    return mov


def filtrar_movimentacao(mov, data_inicio, data_fim, produto, transportadora, unidade):
    if mov.empty:
        return mov.copy()
    filtrado = mov[(mov["data"] >= data_inicio) & (mov["data"] <= data_fim)].copy()
    if produto != "Todos":
        filtrado = filtrado[filtrado["produto"] == produto]
    if transportadora != "Todas":
        filtrado = filtrado[filtrado["transportadora"] == transportadora]
    if unidade != "Todas":
        filtrado = filtrado[filtrado["unidade"] == unidade]
    return filtrado



def formatar_numero(valor):
    try:
        return f"{float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "0,00"


def render_card(row):
    minutos = tempo_minutos(row["entrada_status"])
    badge_frete = "badge-blue" if row["frete"] == "FOB" else "badge-green"
    badge_operacao = "badge-purple" if row["operacao"] == "DESCARGA" else "badge-orange"
    cor_borda = CORES.get(row["status"], "#3B82F6")
    agendamento = parse_dt(row["agendamento"])
    agendamento_txt = agendamento.strftime("%d/%m/%Y %H:%M") if agendamento else "Sem agendamento"

    quantidade_txt = f"{formatar_numero(row.get('quantidade', 0))} {limpar_texto(row.get('unidade', ''))}"

    html_card = (
        f"<div class='truck-card' style='border-left-color:{cor_borda};'>"
        f"<div class='card-header'>"
        f"<div class='card-date'>📅 {agendamento_txt}</div>"
        f"<span class='badge {badge_frete}'>{limpar_texto(row['frete'])}</span>"
        f"</div>"
        f"<div class='card-pedido'>{limpar_texto(row['pedido'])}</div>"
        f"<div class='info-line'><span class='info-label'>Transportadora:</span><br>{limpar_texto(row['transportadora'])}</div>"
        f"<div class='info-line'><span class='info-label'>Motorista:</span><br>{limpar_texto(row['motorista'])}</div>"
        f"<div class='info-line'><span class='info-label'>Placa:</span> {limpar_texto(row['placa'])}</div>"
        f"<div class='info-line'><span class='info-label'>Produto:</span><br>{limpar_texto(row['produto'])}</div>"
        f"<div class='info-line'><span class='info-label'>Quantidade:</span> {quantidade_txt}</div>"
        f"<div style='margin-top:9px;'><span class='badge {badge_operacao}'>{limpar_texto(row['operacao'])}</span></div>"
        f"<div class='card-time'>🕒 {minutos} min nesta etapa</div>"
        f"</div>"
    )
    st.markdown(html_card, unsafe_allow_html=True)

    with st.popover("⋮", use_container_width=True):
        st.caption(f"Controle do card {row['pedido']}")
        if st.button("◀ Retornar etapa", key=f"voltar_{row['id']}", use_container_width=True):
            voltar_card(row)
            st.rerun()
        if st.button("▶ Avançar etapa", key=f"avancar_{row['id']}", use_container_width=True):
            avancar_card(row)
            st.rerun()
        if st.button("Cancelar card", key=f"cancelar_{row['id']}", use_container_width=True):
            cancelar_card(row)
            st.rerun()


# =====================================================
# SIDEBAR
# =====================================================
st.sidebar.markdown(
    """
<div style="padding:18px 6px 12px 6px;">
    <div style="font-size:24px; font-weight:950; color:#F8FAFC;">🚚 FLUXODOCK</div>
    <div style="color:#94A3B8; font-size:13px;">Controle operacional de veículos</div>
</div>
""",
    unsafe_allow_html=True,
)

menu = st.sidebar.radio(
    "Navegação",
    [
        "Kanban",
        "Cadastro",
        "Dashboard",
        "Base de Dados",
        "Histórico",
        "Sobre",
    ],
    label_visibility="collapsed",
)

st.sidebar.markdown("---")
st.sidebar.markdown("**Operador**")
st.sidebar.markdown("🟢 Online")
st.sidebar.markdown("---")

if st.sidebar.button("Carregar exemplos", use_container_width=True):
    carregar_exemplos()
    st.rerun()

if st.sidebar.button("Limpar base", use_container_width=True):
    limpar_base()
    st.rerun()

st.sidebar.caption("Banco SQLite: kanban_logistico.db")

# =====================================================
# DADOS
# =====================================================
df = carregar_caminhoes()
ativos = df_ativos(df)

mov = preparar_movimentacao(df)

# =====================================================
# TELA KANBAN
# =====================================================
if menu == "Kanban":
    st.markdown('<div class="main-title">Kanban Operacional</div>', unsafe_allow_html=True)
    st.markdown('<div class="subtitle">Acompanhamento visual das etapas dos caminhões no pátio</div>', unsafe_allow_html=True)

    f1, f2, f3, f4, f5 = st.columns([1.25, 1, 1, 1, 1])
    with f1:
        busca = st.text_input("Buscar", placeholder="Placa, motorista, pedido ou produto", label_visibility="collapsed")
    with f2:
        filtro_operacao = st.selectbox("Operação", ["Todas"] + OPERACOES, label_visibility="collapsed")
    with f3:
        filtro_frete = st.selectbox("Frete", ["Todos"] + FRETES, label_visibility="collapsed")
    with f4:
        filtro_produto = st.text_input("Produto", placeholder="Filtrar produto", label_visibility="collapsed")
    with f5:
        filtro_transportadora = st.text_input("Transportadora", placeholder="Filtrar transp.", label_visibility="collapsed")

    df_view = ativos.copy()
    if not df_view.empty:
        if busca:
            termo = busca.upper()
            df_view = df_view[
                df_view["placa"].str.upper().str.contains(termo, na=False)
                | df_view["motorista"].str.upper().str.contains(termo, na=False)
                | df_view["pedido"].str.upper().str.contains(termo, na=False)
                | df_view["produto"].str.upper().str.contains(termo, na=False)
            ]
        if filtro_operacao != "Todas":
            df_view = df_view[df_view["operacao"] == filtro_operacao]
        if filtro_frete != "Todos":
            df_view = df_view[df_view["frete"] == filtro_frete]
        if filtro_produto:
            df_view = df_view[df_view["produto"].str.upper().str.contains(filtro_produto.upper(), na=False)]
        if filtro_transportadora:
            df_view = df_view[df_view["transportadora"].str.upper().str.contains(filtro_transportadora.upper(), na=False)]

    total_patio = int(len(ativos[ativos["status"] != "Liberado"])) if not ativos.empty else 0
    total_liberado = int(len(ativos[ativos["status"] == "Liberado"])) if not ativos.empty else 0
    total_cancelado = int(len(df[df["cancelado"] == 1])) if not df.empty else 0
    qtd_agendada = int(len(ativos[ativos["status"] == "Agendado"])) if not ativos.empty else 0

    k1, k2, k3, k4, k5 = st.columns(5, gap="medium")
    with k1:
        st.markdown(f"<div class='kpi-card kpi-blue'><div class='kpi-label'>🚚 Registros não liberados</div><div class='kpi-value'>{total_patio}</div><div class='kpi-desc'>Inclui agendados e etapas em andamento</div></div>", unsafe_allow_html=True)
    with k2:
        st.markdown(f"<div class='kpi-card kpi-green'><div class='kpi-label'>📅 Agendados</div><div class='kpi-value'>{qtd_agendada}</div><div class='kpi-desc'>Ainda não iniciados</div></div>", unsafe_allow_html=True)
    with k3:
        st.markdown(f"<div class='kpi-card kpi-yellow'><div class='kpi-label'>⏱ Tempo médio em aberto</div><div class='kpi-value'>{tempo_medio_patio(df)} min</div><div class='kpi-desc'>Tempo desde o cadastro dos não liberados</div></div>", unsafe_allow_html=True)
    with k4:
        st.markdown(f"<div class='kpi-card kpi-purple'><div class='kpi-label'>📊 Maior concentração</div><div class='kpi-value' style='font-size:22px;'>{maior_gargalo(df)}</div><div class='kpi-desc'>Etapa com mais registros não liberados</div></div>", unsafe_allow_html=True)
    with k5:
        st.markdown(f"<div class='kpi-card kpi-red'><div class='kpi-label'>✕ Cancelados</div><div class='kpi-value'>{total_cancelado}</div><div class='kpi-desc'>Cards cancelados</div></div>", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    colunas = st.columns(7, gap="small")
    for indice, etapa in enumerate(ETAPAS):
        with colunas[indice]:
            cor = CORES[etapa]
            qtd = contar_etapa(df_view, etapa)
            cards = df_view[df_view["status"] == etapa].copy() if not df_view.empty else pd.DataFrame()

            st.markdown(
                f"""
                <div class="kanban-col">
                    <div class="col-top" style="background:{cor};"></div>
                    <div class="col-header">
                        <div class="step-number" style="background:{cor};">{indice + 1}</div>
                        <div class="col-title">{ICONES[etapa]} {etapa}<div class="col-count">({qtd})</div></div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            if not cards.empty:
                for _, row in cards.sort_values("entrada_status", ascending=True).iterrows():
                    render_card(row)
            else:
                st.markdown(
                    f"""
                    <div class="empty-card">
                        <div>
                            <div class="empty-icon">{ICONES[etapa]}</div>
                            <div>Nenhum caminhão<br>nesta etapa</div>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    legenda = " &nbsp;&nbsp; ".join([f"<span style='color:{CORES[e]}; font-weight:950;'>●</span> {e}" for e in ETAPAS])
    st.markdown(f"<div class='legend-box'><b>Legenda:</b> &nbsp; {legenda}</div>", unsafe_allow_html=True)

# =====================================================
# CADASTRO
# =====================================================
elif menu == "Cadastro":
    st.markdown('<div class="main-title">Cadastro de Caminhão</div>', unsafe_allow_html=True)
    st.markdown('<div class="subtitle">Registro de motorista, veículo, quantidade, produto e agendamento</div>', unsafe_allow_html=True)

    with st.form("form_cadastro", clear_on_submit=True):
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            placa = st.text_input("Placa", placeholder="Ex: ABC1D23")
            motorista = st.text_input("Motorista", placeholder="Nome completo")
            cpf = st.text_input("CPF", placeholder="Opcional")
        with c2:
            transportadora = st.text_input("Transportadora", placeholder="Nome da transportadora")
            produto = st.text_input("Produto", placeholder="Ex: Milho, Soja, Etanol")
            pedido = st.text_input("Pedido/Romaneio", placeholder="Ex: PED - 113001")
        with c3:
            quantidade = st.number_input("Quantidade", min_value=0.0, step=0.01, format="%.2f")
            unidade = st.selectbox("Unidade", UNIDADES)
            agendamento = st.datetime_input("Data/Hora agendada")
        with c4:
            operacao = st.selectbox("Operação", OPERACOES)
            frete = st.selectbox("Frete", FRETES)
            observacao = st.text_area("Observação")

        salvar = st.form_submit_button("Cadastrar no Kanban")

        if salvar:
            erros = []
            if not placa.strip():
                erros.append("Placa")
            if not motorista.strip():
                erros.append("Motorista")
            if not produto.strip():
                erros.append("Produto")
            if quantidade <= 0:
                erros.append("Quantidade maior que zero")

            if erros:
                st.error("Preencha corretamente: " + ", ".join(erros) + ".")
            else:
                proximo = int(datetime.now().timestamp())
                pedido_final = pedido.upper().strip() if pedido.strip() else f"PED - {proximo}"
                inserir_caminhao(
                    pedido_final,
                    placa.upper().strip(),
                    motorista.upper().strip(),
                    cpf.strip(),
                    transportadora.upper().strip() if transportadora else "NÃO INFORMADA",
                    produto.upper().strip(),
                    quantidade,
                    unidade,
                    operacao,
                    frete,
                    agendamento,
                    observacao.strip(),
                )
                st.success("Caminhão cadastrado com sucesso e enviado para Agendado.")

# =====================================================
# DASHBOARD
# =====================================================
elif menu == "Dashboard":
    st.markdown('<div class="main-title">Dashboard</div>', unsafe_allow_html=True)
    st.markdown('<div class="subtitle">Indicadores operacionais do pátio logístico</div>', unsafe_allow_html=True)

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total cadastrado", int(len(df)))
    c2.metric("Ativos", int(len(ativos)))
    c3.metric("Não liberados", int(len(ativos[ativos["status"] != "Liberado"])) if not ativos.empty else 0)
    c4.metric("Liberados", int(len(ativos[ativos["status"] == "Liberado"])) if not ativos.empty else 0)
    c5.metric("Cancelados", int(len(df[df["cancelado"] == 1])) if not df.empty else 0)

    if not ativos.empty:
        st.subheader("Caminhões por etapa")
        st.bar_chart(ativos["status"].value_counts())

        c6, c7 = st.columns(2)
        with c6:
            st.subheader("Caminhões por operação")
            st.bar_chart(ativos["operacao"].value_counts())
        with c7:
            st.subheader("Caminhões por frete")
            st.bar_chart(ativos["frete"].value_counts())

        if not mov.empty:
            st.subheader("Volume total por produto e unidade")
            volume_produto = mov.groupby(["produto", "unidade"], as_index=False)["quantidade"].sum()
            st.dataframe(volume_produto.sort_values(["unidade", "quantidade"], ascending=[True, False]), use_container_width=True, hide_index=True)
            for unidade_grafico, grupo_unidade in volume_produto.groupby("unidade"):
                st.markdown(f"**Unidade: {unidade_grafico}**")
                st.bar_chart(grupo_unidade.set_index("produto")["quantidade"])

            st.subheader("Volume total por transportadora e unidade")
            volume_transp = (
                mov.groupby(["transportadora", "unidade"], as_index=False)["quantidade"]
                .sum()
                .sort_values(["unidade", "quantidade"], ascending=[True, False])
            )
            st.dataframe(volume_transp, use_container_width=True, hide_index=True)

        hist = carregar_historico()
        if not hist.empty:
            st.subheader("Movimentações por etapa")
            st.bar_chart(hist["etapa_destino"].value_counts())
    else:
        st.info("Nenhum dado cadastrado.")

# =====================================================
# BASE DE DADOS
# =====================================================
elif menu == "Base de Dados":
    st.markdown('<div class="main-title">Base de Dados</div>', unsafe_allow_html=True)
    st.markdown('<div class="subtitle">Registros salvos no banco SQLite</div>', unsafe_allow_html=True)

    if not df.empty:
        colunas = [
            "id", "pedido", "placa", "motorista", "transportadora", "produto", "quantidade", "unidade",
            "operacao", "frete", "status", "agendamento", "entrada_status", "criado_em", "finalizado_em", "cancelado", "observacao"
        ]
        st.dataframe(df[colunas], use_container_width=True, hide_index=True)
        csv = df[colunas].to_csv(index=False).encode("utf-8-sig")
        st.download_button("Baixar CSV", csv, "kanban_logistico.csv", "text/csv")
    else:
        st.info("Nenhum registro encontrado.")

# =====================================================
# HISTÓRICO
# =====================================================
elif menu == "Histórico":
    st.markdown('<div class="main-title">Histórico de Movimentações</div>', unsafe_allow_html=True)
    st.markdown('<div class="subtitle">Rastreabilidade das alterações de etapa</div>', unsafe_allow_html=True)

    hist = carregar_historico()
    if not hist.empty:
        st.dataframe(hist, use_container_width=True, hide_index=True)
        csv = hist.to_csv(index=False).encode("utf-8-sig")
        st.download_button("Baixar histórico CSV", csv, "historico_kanban.csv", "text/csv")
    else:
        st.info("Nenhuma movimentação registrada.")

# =====================================================
# SOBRE
# =====================================================
else:
    st.markdown('<div class="main-title">Sobre o Sistema</div>', unsafe_allow_html=True)
    st.markdown('<div class="subtitle">Sistema para acompanhamento das operações de pátio</div>', unsafe_allow_html=True)

    st.markdown(
        """
<div class="about-box">
    <h3>Objetivo</h3>
    <p>Desenvolver um protótipo em Python baseado em Kanban digital para apoiar o controle visual das etapas operacionais de caminhões em um pátio logístico.</p>

    <h3>Funcionalidades principais</h3>
    <ul>
        <li>Cadastro de caminhões, motoristas, transportadoras, produtos, quantidades e agendamentos.</li>
        <li>Controle visual por etapas: agendado, check-in, pátio, pesagens, carga/descarga e liberação.</li>
        <li>Movimentação dos cards por avanço ou retorno de etapa.</li>
        <li>Histórico das alterações para rastreabilidade operacional.</li>
        <li>Dashboard com indicadores de pátio, gargalo, tempo médio, operação e frete.</li>
        <li>Volume movimentado por transportadora.</li>
        <li>Exportação de dados em CSV.</li>
    </ul>

    <h3>Aplicação em Engenharia de Produção</h3>
    <p>O sistema conecta gestão visual, logística, controle de pátio e apoio à tomada de decisão baseada em dados.</p>

</div>
""",
        unsafe_allow_html=True,
    )