/**
 * Ollagüe H2V - Simulador de Transición Energética
 * Lógica de negocio, consumo de API Open-Meteo y renderizado de KPIs/Gráficos.
 * * Restricciones de formato de la tesis:
 * - Miles: coma (,) | Decimales: punto (.)
 */

// Parámetros fijos de la Tesis
const CONFIG = {
    LATITUDE: -21.22,
    LONGITUDE: -68.25,
    ELECTROLYZER_CAPACITY_KW: 22.5,
    SPECIFIC_CONSUMPTION_KWH_KG: 52.5,
    FV_PEAK_CAPACITY_MW: 2.0,
    LCOH_BASE: 49.19,
    PRICE_GLP_REF: 2.19,
    KG_GLP_PER_CYLINDER: 15.0,
    LOWER_HEATING_VALUE_H2_KWH_KG: 33.33, // LHV H2
    LOWER_HEATING_VALUE_GLP_KWH_KG: 12.8 thermal // LHV GLP Ref para sustitución
};

// Estado de la aplicación
let state = {
    capexSubsidy: 0,
    hourlyData: [],
    chartInstance: null
};

// Formateador numérico bajo estándar de la tesis (Miles: , | Decimales: .)
const formatNumber = (value, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
};

// Inicialización de la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initListeners();
    fetchWeatherData();
});

function initElements() {
    const today = new Date();
    document.getElementById('current-date').textContent = today.toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function initListeners() {
    const subsidySlider = document.getElementById('capex-subsidy');
    const subsidyValue = document.getElementById('capex-subsidy-value');

    subsidySlider.addEventListener('input', (e) => {
        state.capexSubsidy = parseFloat(e.target.value);
        subsidyValue.textContent = formatNumber(state.capexSubsidy, 2) + '%';
        updateEconomicKPIs();
    });
}

// Consumo de API Open-Meteo con sanitización implícita de tipos
async function fetchWeatherData() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.LATITUDE}&longitude=${CONFIG.LONGITUDE}&hourly=direct_normal_irradiance&forecast_days=1&timezone=America/Santiago`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error en la respuesta de la API');
        const data = await response.json();

        processHourlyData(data.hourly);
    } catch (error) {
        console.error('Error al mapear datos meteorológicos:', error);
        alert('No se pudieron recuperar los datos en tiempo real de Open-Meteo.');
    }
}

// Procesamiento de datos e inyección de fórmulas analíticas
function processHourlyData(hourly) {
    const times = hourly.time;
    const dniW_m2 = hourly.direct_normal_irradiance; // W/m²

    let totalDNI_kWh_m2 = 0;
    let totalH2_kg = 0;
    state.hourlyData = [];

    for (let i = 0; i < times.length; i++) {
        const timeLabel = new Date(times[i]).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const dni_kW_m2 = dniW_m2[i] / 1000; // Conversión a kW/m²

        // 1. Cálculo de generación FV teórica horaria (Simplificada según capacidad instalada)
        // Se asume factor de planta instantáneo proporcional a una irradiancia estándar de 1 kW/m²
        const generatedPower_kW = Math.min(dni_kW_m2 * CONFIG.FV_PEAK_CAPACITY_MW * 1000, CONFIG.FV_PEAK_CAPACITY_MW * 1000);

        // 2. Ventana operativa: Potencia disponible para el electrolizador de 22.5 kW
        const powerToElectrolyzer_kW = Math.min(generatedPower_kW, CONFIG.ELECTROLYZER_CAPACITY_KW);

        // 3. Producción de H2 horaria (Masa = Energía / Consumo Específico)
        // Al ser intervalos de 1 hora, Energía (kWh) = Potencia (kW) * 1h
        const h2Produced_kg = powerToElectrolyzer_kW / CONFIG.SPECIFIC_CONSUMPTION_KWH_KG;

        totalDNI_kWh_m2 += dni_kW_m2; // Integral horaria de la irradiancia
        totalH2_kg += h2Produced_kg;

        state.hourlyData.push({
            time: timeLabel,
            dni: dniW_m2[i],
            h2: h2Produced_kg
        });
    }

    renderTechnicalKPIs(totalDNI_kWh_m2, totalH2_kg);
    updateEconomicKPIs(totalH2_kg);
    renderChart();
}

function renderTechnicalKPIs(dni, h2) {
    document.getElementById('kpi-irradiance').textContent = formatNumber(dni, 2);
    document.getElementById('kpi-h2-production').textContent = formatNumber(h2, 2);

    // Equivalencia GLP: Basado en el poder calorífico inferior (LHV) para sustitución energética directa
    // Energía H2 (kWh) = kg H2 * 33.33 kWh/kg
    const energyH2_kWh = h2 * CONFIG.LOWER_HEATING_VALUE_H2_KWH_KG;
    // Masa GLP equivalente (kg) = Energía H2 / 12.8 kWh/kg
    const glpEquivalent_kg = energyH2_kWh / CONFIG.LOWER_HEATING_VALUE_GLP_KWH_KG;
    const cylinders = glpEquivalent_kg / CONFIG.KG_GLP_PER_CYLINDER;

    document.getElementById('kpi-glp-substitution').textContent = formatNumber(cylinders, 2);
}

// Actualización dinámica del LCOH aplicando el % de subsidio sobre la base de la tesis
function updateEconomicKPIs() {
    // Relación elástica lineal inversa: A mayor subsidio CAPEX, menor LCOH proporcionalmente
    // según el modelo financiero estructurado en el capítulo económico de la tesis
    const dynamicLCOH = CONFIG.LCOH_BASE * (1 - (state.capexSubsidy / 100));

    const lcohElement = document.getElementById('kpi-lcoh');
    lcohElement.textContent = formatNumber(dynamicLCOH, 2);

    // Feedback visual si es competitivo con el GLP de referencia
    if (dynamicLCOH <= CONFIG.PRICE_GLP_REF) {
        lcohElement.className = "text-2xl font-bold tracking-tight text-emerald-600 mt-1";
    } else {
        lcohElement.className = "text-2xl font-bold tracking-tight text-blue-600 mt-1";
    }
}

// Renderizado de la ventana operativa con Chart.js
function renderChart() {
    const ctx = document.getElementById('operative-window-chart').getContext('2d');

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    const labels = state.hourlyData.map(d => d.time);
    const dniData = state.hourlyData.map(d => d.dni);
    const h2Data = state.hourlyData.map(d => d.h2);

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Irradiancia DNI (W/m²)',
                    data: dniData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    yAxisID: 'yDni',
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'Producción H₂ (kg/h)',
                    data: h2Data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    yAxisID: 'yH2',
                    tension: 0.2,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false }
                },
                yDni: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'DNI (W/m²)', font: { weight: 'bold' } },
                    min: 0
                },
                yH2: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'H₂ Generado (kg/h)', font: { weight: 'bold' } },
                    min: 0,
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}
