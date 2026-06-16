/**
 * Ollagüe H2V - Simulador de Transición Energética
 * Motor de Cálculo Reactivo y Sincronizado para Defensa de Tesis
 */

const CONFIG = {
    LATITUDE: -21.22,
    LONGITUDE: -68.25,
    ELECTROLYZER_CAPACITY_KW: 22.5,
    BASE_ELECTROLYZER_EFFICIENCY: 65.0,
    BASE_SPECIFIC_CONSUMPTION: 52.5, // kWh/kg H2
    FV_PEAK_CAPACITY_MW: 2.0,
    LCOH_BASE: 49.19,
    PRICE_GLP_REF: 2.19
};

// Respaldo de radiación típico para Ollagüe (Evita pantallas en blanco si la API falla o está bloqueada)
const OLLAGUE_FALLBACK_DNI = [
    0, 0, 0, 0, 0, 0, 0, 120, 450, 780, 950, 1020, 1050, 1020, 950, 780, 450, 120, 0, 0, 0, 0, 0, 0
];

let state = {
    capexSubsidy: 0,
    fvDegradation: 0,
    elyEfficiency: 65,
    rawHourlyData: {},
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
    document.getElementById('capex-subsidy').addEventListener('input', (e) => {
        state.capexSubsidy = parseFloat(e.target.value);
        document.getElementById('capex-subsidy-value').textContent = formatNumber(state.capexSubsidy, 2) + '%';
        recalculateAndRender();
    });

    document.getElementById('fv-degradation').addEventListener('input', (e) => {
        state.fvDegradation = parseFloat(e.target.value);
        document.getElementById('fv-degradation-value').textContent = formatNumber(state.fvDegradation, 2) + '%';
        recalculateAndRender();
    });

    document.getElementById('ely-efficiency').addEventListener('input', (e) => {
        state.elyEfficiency = parseFloat(e.target.value);
        document.getElementById('ely-efficiency-value').textContent = formatNumber(state.elyEfficiency, 2) + '%';
        recalculateAndRender();
    });
}

async function fetchWeatherData() {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-21.22&longitude=-68.25&hourly=direct_normal_irradiance&forecast_days=1&timezone=America%2FSantiago';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API con sobrecarga');
        const data = await response.json();
        if (!data.hourly || !data.hourly.direct_normal_irradiance) throw new Error('Datos incompletos');

        state.rawHourlyData = data.hourly;
        document.getElementById('api-status-dot').className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        document.getElementById('api-status-text').textContent = "API Open-Meteo Activa";
    } catch (error) {
        console.warn("Cargando matriz de respaldo de Ollagüe debido a restricciones de red local.");
        const baseIsoTime = new Date().toISOString().split('T')[0];
        state.rawHourlyData = {
            time: Array.from({length: 24}, (_, i) => `${baseIsoTime}T${String(i).padStart(2, '0')}:00`),
            direct_normal_irradiance: OLLAGUE_FALLBACK_DNI
        };
        document.getElementById('api-status-dot').className = "w-2 h-2 rounded-full bg-amber-500 animate-none";
        document.getElementById('api-status-text').textContent = "Respaldo Histórico Activo";
    } finally {
        recalculateAndRender();
    }
}

function recalculateAndRender() {
    if (!state.rawHourlyData.time) return;

    const times = state.rawHourlyData.time;
    const dniW_m2 = state.rawHourlyData.direct_normal_irradiance;

    let totalDNI_kWh_m2 = 0;
    let totalH2_kg = 0;
    let processedHourly = [];

    const degradationFactor = 1 - (state.fvDegradation / 100);
    const dynamicSpecificConsumption = CONFIG.BASE_SPECIFIC_CONSUMPTION * (CONFIG.BASE_ELECTROLYZER_EFFICIENCY / state.elyEfficiency);

    for (let i = 0; i < times.length; i++) {
        const timeLabel = new Date(times[i]).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const dni_kW_m2 = dniW_m2[i] / 1000;

        const generatedPower_kW = Math.min(dni_kW_m2 * CONFIG.FV_PEAK_CAPACITY_MW * 1000, CONFIG.FV_PEAK_CAPACITY_MW * 1000) * degradationFactor;
        const powerToElectrolyzer_kw = Math.min(generatedPower_kW, CONFIG.ELECTROLYZER_CAPACITY_KW);
        const h2Produced_kg = powerToElectrolyzer_kw / dynamicSpecificConsumption;

        totalDNI_kWh_m2 += dni_kW_m2;
        totalH2_kg += h2Produced_kg;

        processedHourly.push({
            time: timeLabel,
            dni: dniW_m2[i],
            h2: h2Produced_kg
        });
    }

    renderKPIs(totalDNI_kWh_m2, totalH2_kg);
    updateChart(processedHourly);
}

function renderKPIs(dni, h2) {
    document.getElementById('kpi-irradiance').textContent = formatNumber(dni, 2);
    document.getElementById('kpi-h2-production').textContent = formatNumber(h2, 2);

    const projectedAnnualH2_kg = h2 * 365;
    document.getElementById('kpi-annual-projection').textContent = formatNumber(projectedAnnualH2_kg, 2);

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
        state.chartInstance.update('none');
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
