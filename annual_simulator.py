import csv
import math
from typing import List, Dict, Any
from engine_validator import H2SimulationEngine


def generate_synthetic_year_dni() -> List[float]:
    """Genera un perfil horario de irradiancia (DNI) para 365 días (8760 horas)

    basado en un modelo de cielo claro simplificado para la radiación de Ollagüe.
    """
    hourly_dni: List[float] = []
    peak_dni = 1050.0  # W/m² característico del altiplano

    for day in range(365):
        day_factor = math.cos(2 * math.pi * (day - 172) / 365)
        day_length = 12.0 + 1.5 * day_factor

        for hour in range(24):
            time_of_day = hour + 0.5
            sunrise = 12.0 - (day_length / 2.0)
            sunset = 12.0 + (day_length / 2.0)

            if sunrise < time_of_day < sunset:
                normalized_time = (time_of_day - sunrise) / (sunset - sunrise)
                dni = peak_dni * math.sin(normalized_time * math.pi)
                dni_noise = dni * (1.0 - 0.05 * (day % 7 == 0))
                hourly_dni.append(max(0.0, dni_noise))
            else:
                hourly_dni.append(0.0)

    return hourly_dni


def run_annual_simulation(
    degradation: float = 0.0, efficiency: float = 65.0
) -> Dict[str, Any]:
    """Somete al motor analítico a una serie temporal de 8,760 horas."""
    engine = H2SimulationEngine()
    dni_profile = generate_synthetic_year_dni()

    total_h2_kg = 0.0
    total_dni_kwh_m2 = 0.0
    hourly_records: List[Dict[str, float]] = []

    for idx, dni in enumerate(dni_profile):
        h2_hour = engine.calculate_hourly_production(
            dni, fv_degradation_pct=degradation, ely_efficiency_pct=efficiency
        )
        total_h2_kg += h2_hour
        total_dni_kwh_m2 += dni / 1000.0

        hourly_records.append(
            {
                "Hora_Anual": idx + 1,
                "DNI_W_m2": round(dni, 2),
                "H2_kg": round(h2_hour, 4),
            }
        )

    total_cylinders = engine.calculate_glp_substitution(total_h2_kg)
    meta_tesis = 1732.0
    cumplimiento = (total_h2_kg / meta_tesis) * 100.0

    csv_filename = "resultados_simulacion_anual.csv"
    with open(csv_filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Hora_Anual", "DNI_W_m2", "H2_kg"])
        writer.writeheader()
        writer.writerows(hourly_records)

    return {
        "total_h2_kg": total_h2_kg,
        "total_dni_kwh_m2": total_dni_kwh_m2,
        "total_cylinders": total_cylinders,
        "cumplimiento_meta_pct": cumplimiento,
        "csv_path": csv_filename,
    }


if __name__ == "__main__":
    print("=== INICIANDO SIMULACIÓN ANUAL (8,760 HORAS) ===")
    res = run_annual_simulation(degradation=0.0, efficiency=65.0)

    print(f"\nIrradiancia Total Acumulada: {res['total_dni_kwh_m2']:,.2f} kWh/m²/año")
    print(f"Producción Total Anual H2:   {res['total_h2_kg']:,.2f} kg H₂/año")
    print(f"Sustitución Total de GLP:    {res['total_cylinders']:,.2f} cilindros/año")
    print(f"Cumplimiento de la Meta:     {res['cumplimiento_meta_pct']:,.2f}%")
    print(f"\n[OK] Matriz horaria exportada a: {res['csv_path']}")

