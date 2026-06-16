# Ollagüe H2V - Simulador de Transición Energética

Este repositorio contiene el código fuente del **Simulador de Transición Energética para la comuna de Ollagüe**, un modelo analítico y predictivo desarrollado como herramienta central de soporte para tesis de Ingeniería Civil Industrial. El objetivo del proyecto es evaluar la viabilidad técnica, operativa y económica de sustituir progresivamente la demanda residencial de Gas Licuado de Petróleo (GLP) por Hidrógeno Verde ($H_2V$) generado localmente mediante energía solar fotovoltaica.

---

## 📊 Arquitectura del Sistema y Módulos

El ecosistema de simulación se divide en dos componentes principales interconectados:

1. **Motor Analítico en Python (`annual_simulator.py` / `engine_validator.py`):** Ejecuta simulaciones estocásticas de series de tiempo horarias para un año completo (8,760 horas). Utiliza modelos de cielo claro calibrados para la radiación del altiplano y balances de masa/energía bajo el Poder Calorífico Inferior (LHV).
2. **Interfaz Web Reactiva (`index.html` / `app.js`):** Dashboard interactivo montado sobre Tailwind CSS y Chart.js. Permite realizar análisis de sensibilidad en tiempo real mediante sliders multivariables (CAPEX, Degradación y Eficiencia) y cuenta con un sistema de alta disponibilidad mediante *fallback* local asíncrono para asegurar su correcto despliegue sin dependencia de red externa.

---

## 🛠️ Especificaciones Técnicas del Dimensionamiento (Parámetros Base)

El simulador viene preconfigurado con el diseño óptimo de ingeniería formulado en el cuerpo de la tesis:

* **Ubicación:** Ollagüe, Región de Antofagasta, Chile (Lat: `-21.22`, Lon: `-68.25`).
* **Planta Fotovoltaica de Alimentación:** `2.0 MWp` (Sobredimensionada deliberadamente para maximizar el factor de planta).
* **Tecnología de Electrólisis:** Electrolizador tipo **PEM (Proton Exchange Membrane)** de `22.5 kW` de capacidad nominal.
* **Consumo Específico Base:** `52.5 kWh / kg H₂` (Equivalente a un `65.0%` de eficiencia base según estado del arte).
* **Precio de Paridad GLP de Referencia:** `2.19 USD/kg`.
* **Meta de Mitigación de la Tesis:** Sustitución del 50% del consumo residencial anual, equivalente a **`1,732.00 kg H₂/año`**.

---

## 📈 Resultados Clave del Modelo Anual

Al correr el motor analítico de 8,760 horas (`python annual_simulator.py`), el sistema arroja los siguientes indicadores consolidados:

| Indicador Técnico | Valor Obtenido | Unidad |
| :--- | :---: | :---: |
| **Irradiancia Total Acumulada** | `2,904.42` | kWh/m²/año |
| **Producción Total Anual de $H_2$** | `1,869.71` | kg H₂/año |
| **Sustitución Efectiva de GLP** | `324.57` | Cilindros de 15 kg/año |
| **Cumplimiento de la Meta** | **`107.95%`** | Porcentaje |

> 💡 **Nota de Diseño de Ingeniería:** El cumplimiento del **107.95%** demuestra que la estrategia de sobredimensionamiento de la planta FV (Oversizing) compensa las mermas operativas y la ventana de radiación horaria, blindando el suministro de hidrógeno frente a variaciones atmosféricas y garantizando un excedente de seguridad de `137.71 kg H₂/año`.

---

## 📂 Estructura del Repositorio

```text
├── annual_simulator.py          # Script de simulación de series de tiempo anual (8760 horas)
├── engine_validator.py          # Motor de validación analítica y balances térmicos-masas
├── resultados_simulacion_anual.csv # Matriz horaria exportada con datos de irradiancia y producción
├── index.html                   # Interfaz de usuario (UI) responsiva del Dashboard
├── app.js                       # Lógica reactiva, integración con Open-Meteo y Fallback estático
└── deploy.py                    # Script automatizado de verificación previa al despliegue