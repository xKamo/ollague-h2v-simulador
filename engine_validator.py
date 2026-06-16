import unittest
from typing import Dict


class H2SimulationEngine:
    """Réplica del motor de cálculo de la tesis para validación cruzada."""

    def __init__(self):
        # Parámetros fijos de la tesis
        self.ELECTROLYZER_CAPACITY_KW: float = 22.5
        self.SPECIFIC_CONSUMPTION_KWH_KG: float = 52.5
        self.FV_PEAK_CAPACITY_MW: float = 2.0
        self.LCOH_BASE: float = 49.19
        self.LHV_H2_KWH_KG: float = 33.33
        self.LHV_GLP_KWH_KG: float = 12.8
        self.KG_GLP_CYLINDER: float = 15.0

    def calculate_hourly_production(self, dni_w_m2: float) -> float:
        """Calcula los kg de H2 producidos en una hora."""
        dni_kw_m2 = dni_w_m2 / 1000.0
        generated_power_kw = min(
            dni_kw_m2 * self.FV_PEAK_CAPACITY_MW * 1000.0,
            self.FV_PEAK_CAPACITY_MW * 1000.0,
        )
        power_to_electrolyzer_kw = min(
            generated_power_kw, self.ELECTROLYZER_CAPACITY_KW
        )
        return power_to_electrolyzer_kw / self.SPECIFIC_CONSUMPTION_KWH_KG

    def calculate_glp_substitution(self, h2_kg: float) -> float:
        """Calcula la equivalencia en cilindros de GLP de 15 kg."""
        energy_h2_kwh = h2_kg * self.LHV_H2_KWH_KG
        glp_equivalent_kg = energy_h2_kwh / self.LHV_GLP_KWH_KG
        return glp_equivalent_kg / self.KG_GLP_CYLINDER

    def calculate_dynamic_lcoh(self, subsidy_percentage: float) -> float:
        """Calcula el LCOH en función del subsidio al CAPEX."""
        return self.LCOH_BASE * (1.0 - (subsidy_percentage / 100.0))


class TestH2SimulationEngine(unittest.TestCase):
    """Pruebas unitarias basadas en los datos de control de la tesis."""

    def setUp(self):
        self.engine = H2SimulationEngine()

    def test_production_at_zero_irradiance(self):
        """Irradiancia nula debe resultar en producción cero."""
        h2 = self.engine.calculate_hourly_production(0.0)
        self.assertEqual(h2, 0.0)

    def test_production_saturation(self):
        """Alta irradiancia debe saturar el electrolizador a su capacidad máxima (22.5 kW)."""
        # 1000 W/m2 genera 2000 kW FV >> 22.5 kW electrolizador
        h2_max = self.engine.calculate_hourly_production(1000.0)
        expected_max = 22.5 / 52.5  # 0.428571... kg/h
        self.assertAlmostEqual(h2_max, expected_max, places=5)

    def test_lcoh_with_subsidy(self):
        """Validar elasticidad del LCOH con 50% de subsidio."""
        lcoh_50 = self.engine.calculate_dynamic_lcoh(50.0)
        self.assertEqual(lcoh_50, 49.19 / 2)


if __name__ == "__main__":
    unittest.main()
