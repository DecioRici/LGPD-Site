"""Calcula os indicadores descritos no TCC a partir de uma base anonimizada."""

from __future__ import annotations

import csv
import statistics
import sys
from pathlib import Path


def percentile(values: list[float], proportion: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * proportion
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def calculate(csv_path: Path) -> dict[str, float | int]:
    with csv_path.open(encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    times = [float(row["tempo_total_min"]) for row in rows]
    q1 = percentile(times, 0.25)
    q3 = percentile(times, 0.75)
    upper_limit = q3 + 1.5 * (q3 - q1)

    return {
        "registros": len(times),
        "media_min": statistics.fmean(times),
        "mediana_min": statistics.median(times),
        "percentil_90_min": percentile(times, 0.90),
        "limite_tukey_min": upper_limit,
        "casos_extremos": sum(value > upper_limit for value in times),
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python analysis/calcular_indicadores.py arquivo.csv")
    for name, value in calculate(Path(sys.argv[1])).items():
        print(f"{name}: {value:.2f}" if isinstance(value, float) else f"{name}: {value}")
