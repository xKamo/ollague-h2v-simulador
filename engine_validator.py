import unittest
from typing import Dict


class H2SimulationEngine:
    """Réplica del motor de cálculo multivariable de la tesis para validación cruzada."""

    def __init__(self):
        self.ELECTROLYZER_CAPACITY_KW: float = 22.5
        self.BASE_ELECTROLYZER_EFFICIENCY: float = 65.0
        self.BASE_SPECIFIC_CONSUMPTION: float = 52.5
        self.FV_PEAK_CAPACITY_MW: float = 2.0
        self.LCOH_BASE: float = 49.19
        self.LHV_H2_KWH_KG: float = 33.33
        self.LHV_GLP_KWH_KG: float = 12.8
        self.KG_GLP_CYLINDER: float = 15.0

    def calculate_hourly_production(
        self,
        dni_w_m2: float,
        fv_degradation_pct: float = 0.0,
        ely_efficiency_pct: float = 65.0,
    ) -> float:
        """Calcula los kg de H2 con degradación FV y eficiencia variable."""
        dni_kw_m2 = dni_w_m2 / 1000.0
        degradation_factor = 1.0 - (fv_degradation_pct / 100.0)

        # Consumo específico dinámico inversamente proporcional a la eficiencia
        dynamic_specific_consumption = self.BASE_SPECIFIC_CONSUMPTION * (
            self.BASE_ELECTROLYZER_EFFICIENCY / ely_efficiency_pct
        )

        # Potencia FV corregida por degradación
        generated_power_kw = (
            min(
                dni_kw_m2 * self.FV_PEAK_CAPACITY_MW * 1000.0,
                self.FV_PEAK_CAPACITY_MW * 1000.0,
            )
            * degradation_factor
        )

        power_to_electrolyzer_kw = min(
            generated_power_kw, self.ELECTROLYZER_CAPACITY_KW
        )
        return power_to_electrolyzer_kw / dynamic_specific_consumption

    def calculate_glp_substitution(self, h2_kg: float) -> float:
        """Calcula la equivalencia en cilindros de GLP de 15 kg."""
        energy_h2_kwh = h2_kg * self.LHV_H2_KWH_KG
        glp_equivalent_kg = energy_h2_kwh / self.LHV_GLP_KWH_KG
        return glp_equivalent_kg / self.KG_GLP_CYLINDER

    def calculate_dynamic_lcoh(self, subsidy_percentage: float) -> float:
        """Calcula el LCOH en función del subsidio al CAPEX."""
        return self.LCOH_BASE * (1.0 - (subsidy_percentage / 100.0))


class TestH2SimulationEngine(unittest.TestCase):
    """Pruebas unitarias para el modelo elástico multivariable."""

    def setUp(self):
        self.engine = H2SimulationEngine()

    def test_production_with_degradation(self):
        """La degradación extrema no debe saturar la planta FV incluso con alta irradiancia."""
        # Con 100% de degradación la producción debe ser 0
        h2 = self.engine.calculate_hourly_production(
            1000.0, fv_degradation_pct=100.0
        )
        self.assertEqual(h2, 0.0)

    def test_efficiency_impact(self):
        """Mayor eficiencia del electrolizador debe disminuir el consumo específico aumentando la producción."""
        # Simulación a 1000 W/m2 con 65% vs 80% eficiencia
        h2_base = self.engine.calculate_hourly_production(
            1000.0, ely_efficiency_pct=65.0
        )
        h2_alta = self.engine.calculate_hourly_production(
            1000.0, ely_efficiency_pct=80.0
        )
        self.assertGreater(h2_alta, h2_base)

    def test_lcoh_with_subsidy(self):
        """Validar elasticidad lineal del LCOH."""
        lcoh_85 = self.engine.calculate_dynamic_lcoh(85.0)
        expected = 49.19 * (1 - 0.85)
        self.assertAlmostEqual(lcoh_85, expected, places=4)


if __name__ == "__main__":
    unittest.main()
