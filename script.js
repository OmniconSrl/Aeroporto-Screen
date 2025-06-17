// script.js

const HOST_L4 = 'https://level4.omnicon.it';
const USERNAME = 'aeroportorimini.schermo@omnicon.it';
const PASSWORD = '£I#53av3$2iIL]U0';

async function login() {
  const res = await axios.post(`${HOST_L4}/api/auth/login`, {
    username: USERNAME,
    password: PASSWORD
  });
  return res.data.token;
}

async function getTelemetry(token) {
    const entityId = '854a8910-857f-11ef-a312-7d7684a9aa78';
    const entityType = 'ASSET';
    const keys = ['EGS', 'EMS'];

    const res = await axios.get(`${HOST_L4}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries?keys=${keys.join(',')}&useStrictDataTypes=false`, {
        headers: { 'X-Authorization': `Bearer ${token}` }
    });
  return res.data;
}

function calcolaIndicatori(data) {
  const totalProd = parseFloat(data.EMS?.[0]?.value || 0); // EMS
  const dailyProd = parseFloat(data.EGS?.[0]?.value || 0); // EGS

  const coeffCO2 = 0.475; // Coefficiente di emissione CO2 in kg/kWh
  const coeffCoal = 0.4; // Coefficiente di emissione CO2 da carbone in kg/kWh
  const coeffTree = 18.3; // Coefficiente di assorbimento CO2 da parte di un albero in kg/anno
  const treeLifespan = 40; // Vita media di un albero in anni

  // Coefficiente di assorbimento CO2 da parte di un albero in kg
//   const kgCO2 = totalProd * coeffCO2;
//   const tonCO2 = (kgCO2 / 1000).toFixed(2);
//   const alberi = (kgCO2 / 21.77).toFixed(0);
//   const carbone = (totalProd * 0.4 / 1000).toFixed(1);

  const alberi = ((coeffCO2 * dailyProd) / (coeffTree * treeLifespan)).toFixed(0);
  const tonCO2 = ((coeffCO2 * dailyProd)/1000).toFixed(2);
  const carbone = ((coeffCoal * dailyProd)/1000).toFixed(2);

  document.querySelector('#carbone .kpi-value').innerText = `${carbone} t`;
  document.querySelector('#alberi .kpi-value').innerText = `${alberi}`;
  document.querySelector('#co2 .kpi-value').innerText = `${tonCO2} t`;
  document.querySelector('#totale .kpi-value').innerText = `${totalProd.toFixed(0)} kWh`;
  document.querySelector('#giornaliera .kpi-value').innerText = `${dailyProd.toFixed(0)} kWh`;
}

async function updateDashboard() {
  try {
    const token = await login();
    const telemetry = await getTelemetry(token);
    calcolaIndicatori(telemetry);
  } catch (err) {
    console.error('Errore aggiornamento dati:', err);
  }
}

updateDashboard();
setInterval(updateDashboard, 15 * 60 * 1000);
