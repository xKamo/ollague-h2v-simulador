/**
 * Ollagüe H2V - Simulador de Transición Energética
 * Módulo 2: Motor de cálculo multivariable y reactividad en tiempo real.
 */

const CONFIG = {
    LATITUDE: -21.22,
    LONGITUDE: -68.25,
    ELECTROLYZER_CAPACITY_KW: 22.5,
    BASE_ELECTROLYZER_EFFICIENCY: 65.0, // % Base Tesis
    BASE_SPECIFIC_CONSUMPTION: 52.5,    // kWh/kg H2 @ 65% eficiencia
    FV_PEAK_CAPACITY_MW: 2.0,
    LCOH_BASE: 49.19,
    PRICE_GLP_REF: 2.19,
    KG_GLP_PER_CYLINDER: 15.0,
    LOWER_HEATING_VALUE_H2_KWH_KG: 33.33,
    LOWER_HEATING_VALUE_GLP_KWH_KG: 12.8
};

// Estado reactivo multivariable
let state = {
    capexSubsidy: 0,
    fvDegradation: 0,
    elyEfficiency: 65,
    rawHourlyData: [], // Almacena la respuesta pura de la API para recálculos rápidos
    chartInstance: null
};

const formatNumber = (value, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
};

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initListeners();
    fetchWeatherData();
});

function initElements() {
    const today = new Date();
    document.getElementById('current-date').textContent = today.toLocaleDateString('es-CL', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function initListeners() {
    // Listener Subsidio CAPEX
    const capexSlider = document.getElementById('capex-subsidy');
    const capexValue = document.getElementById('capex-subsidy-value');
    capexSlider.addEventListener('input', (e) => {
        state.capexSubsidy = parseFloat(e.target.value);
        capexValue.textContent = formatNumber(state.capexSubsidy, 2) + '%';
        recalculateAndRender();
    });

    // Listener Degradación FV
    const fvSlider = document.getElementById('fv-degradation');
    const fvValue = document.getElementById('fv-degradation-value');
    fvSlider.addEventListener('input', (e) => {
        state.fvDegradation = parseFloat(e.target.value);
        fvValue.textContent = formatNumber(state.fvDegradation, 2) + '%';
        recalculateAndRender();
    });

    // Listener Eficiencia Electrolizador
    const elySlider = document.getElementById('ely-efficiency');
    const elyValue = document.getElementById('ely-efficiency-value');
    elySlider.addEventListener('input', (e) => {
        state.elyEfficiency = parseFloat(e.target.value);
        elyValue.textContent = formatNumber(state.elyEfficiency, 2) + '%';
        recalculateAndRender();
    });
}

async function fetchWeatherData() {
    // URL parametrizada limpia sin caracteres de escape conflictivos
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-21.22&longitude=-68.25&hourly=direct_normal_irradiance&forecast_days=1&timezone=America%2FSantiago';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error en la API');
        const data = await response.json();

        if (!data.hourly || !data.hourly.direct_normal_irradiance) {
            throw new Error('Estructura de datos incompleta');
        }

        state.rawHourlyData = data.hourly;
        recalculateAndRender();
    } catch (error) {
        console.error('Error detallado de conexión:', error);
        alert('No se pudieron recuperar los datos de Open-Meteo.');
        }
}

// Orquestador de recálculo instantáneo (Inyección de fórmulas elásticas de la tesis)
function recalculateAndRender() {
    if (!state.rawHourlyData.time) return;

    const times = state.rawHourlyData.time;
    const dniW_m2 = state.rawHourlyData.direct_normal_irradiance;

    let totalDNI_kWh_m2 = 0;
    let totalH2_kg = 0;
    let processedHourly = [];

    // Factor de penalización por degradación FV: (1 - %degradación/100)
    const degradationFactor = 1 - (state.fvDegradation / 100);

    // Ajuste elástico del consumo específico: Inversamente proporcional a la variación de eficiencia
    const dynamicSpecificConsumption = CONFIG.BASE_SPECIFIC_CONSUMPTION * (CONFIG.BASE_ELECTROLYZER_EFFICIENCY / state.elyEfficiency);

    for (let i = 0; i < times.length; i++) {
        const timeLabel = new Date(times[i]).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const dni_kW_m2 = dniW_m2[i] / 1000;

        // 1. Generación FV corregida por degradación de paneles
        const generatedPower_kW = Math.min(dni_kW_m2 * CONFIG.FV_PEAK_CAPACITY_MW * 1000, CONFIG.FV_PEAK_CAPACITY_MW * 1000) * degradationFactor;

        // 2. Ventana operativa del electrolizador PEM
        const powerToElectrolyzer_kW = Math.min(generatedPower_kW, CONFIG.ELECTROLYZER_CAPACITY_KW);

        // 3. Producción horaria ajustada por eficiencia dinámica del sistema
        const h2Produced_kg = powerToElectrolyzer_kW / dynamicSpecificConsumption;

        totalDNI_kWh_m2 += dni_kW_m2;
        totalH2_kg += h2Produced_kg;

        processedHourly.push({
            time: timeLabel,
            dni: dniW_m2[i],
            h2: h2Produced_kg
        });
    }

    // Actualizar Interfaz
    renderKPIs(totalDNI_kWh_m2, totalH2_kg);
    updateChart(processedHourly);
}

function renderKPIs(dni, h2) {
    document.getElementById('kpi-irradiance').textContent = formatNumber(dni, 2);
    document.getElementById('kpi-h2-production').textContent = formatNumber(h2, 2);

    // Sustitución de GLP por LHV equivalente
    const energyH2_kWh = h2 * CONFIG.LOWER_HEATING_VALUE_H2_KWH_KG;
    const glpEquivalent_kg = energyH2_kWh / CONFIG.LOWER_HEATING_VALUE_GLP_KWH_KG;
    const cylinders = glpEquivalent_kg / CONFIG.KG_GLP_PER_CYLINDER;
    document.getElementById('kpi-glp-substitution').textContent = formatNumber(cylinders, 2);

    // LCOH Dinámico con subsidio CAPEX
    const dynamicLCOH = CONFIG.LCOH_BASE * (1 - (state.capexSubsidy / 100));
    const lcohElement = document.getElementById('kpi-lcoh');
    lcohElement.textContent = formatNumber(dynamicLCOH, 2);

    if (dynamicLCOH <= CONFIG.PRICE_GLP_REF) {
        lcohElement.className = "text-2xl font-bold tracking-tight text-emerald-600 mt-1";
    } else {
        lcohElement.className = "text-2xl font-bold tracking-tight text-blue-600 mt-1";
    }
}

function updateChart(hourlyData) {
    const ctx = document.getElementById('operative-window-chart').getContext('2d');
    const labels = hourlyData.map(d => d.time);
    const dniData = hourlyData.map(d => d.dni);
    const h2Data = hourlyData.map(d => d.h2);

    if (state.chartInstance) {
        state.chartInstance.data.labels = labels;
        state.chartInstance.data.datasets[0].data = dniData;
        state.chartInstance.data.datasets[1].data = h2Data;
        state.chartInstance.update('none'); // Update síncrono ultra-rápido para transiciones fluidas en Sliders
        return;
    }

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Irradiancia DNI (W/m²)',
                    data: dniData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    yAxisID: 'yDni',
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'Producción H₂ (kg/h)',
                    data: h2Data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
                x: { grid: { display: false } },
                yDni: { type: 'linear', position: 'left', title: { display: true, text: 'DNI (W/m²)' }, min: 0 },
                yH2: { type: 'linear', position: 'right', title: { display: true, text: 'H₂ (kg/h)' }, min: 0, grid: { display: false } }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}
