// script.js


const HOST_L4 = 'https://level4.omnicon.it';
const entityIdAsset = '854a8910-857f-11ef-a312-7d7684a9aa78';
const entityIdDevice = '36bc2c50-857e-11ef-a312-7d7684a9aa78';
const keysAsset = ['EGS', 'EGE']; // EGS, EGE
const keysDevice = ['ETI']; // EGS, EGE

async function login(USERNAME,PASSWORD) {
  const res = await axios.post(`${HOST_L4}/api/auth/login`, {
    username: USERNAME,
    password: PASSWORD
  });
  return res.data.token;
}

async function getTelemetry(token, keys, entityType, entityId) {

    const res = await axios.get(`${HOST_L4}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries?keys=${keys.join(',')}&useStrictDataTypes=false`, {
        headers: { 'X-Authorization': `Bearer ${token}` }
    });
  return res.data;
}

function calcolaIndicatori(data) {
  const totalProd = parseFloat(data.ETI?.[0]?.value || 0); // ETI
  const EGS = parseFloat(data.EGS?.[0]?.value || 0); // EGS
  const EGE = parseFloat(data.EGE?.[0]?.value || 0); // EGE
  let dailyProd = EGE + EGS;

  const coeffCO2 = 0.475; // Coefficiente di emissione CO2 in kg/kWh
  const coeffCoal = 0.4; // Coefficiente di emissione CO2 da carbone in kg/kWh
  const coeffTree = 18.3; // Coefficiente di assorbimento CO2 da parte di un albero in kg/anno
  const treeLifespan = 40; // Vita media di un albero in anni

  const alberi = ((coeffCO2 * totalProd) / (coeffTree * treeLifespan)).toFixed(0);
  const tonCO2 = ((coeffCO2 * totalProd)/1000).toFixed(2);
  const carbone = ((coeffCoal * totalProd)/1000).toFixed(2);

  document.querySelector('#carbone .kpi-value').innerText = `${carbone} t`;
  document.querySelector('#alberi .kpi-value').innerText = `${alberi} Alberi`;
  document.querySelector('#co2 .kpi-value').innerText = `${tonCO2} t`;
  document.querySelector('#totale .kpi-value').innerText = `${totalProd.toFixed(0)/1000} MWh`;
  document.querySelector('#giornaliera .kpi-value').innerText = `${dailyProd.toFixed(0)/1000} kWh`;
}

function showLoginModal() {
  document.getElementById("loginModal").style.display = "flex";
}

function hideLoginModal() {
  document.getElementById("loginModal").style.display = "none";
}

function loginFromModal() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if (!user || !pass) {
    alert("Inserisci username e password");
    return;
  }

  localStorage.setItem("l4_user", user);
  localStorage.setItem("l4_pass", pass);
  hideLoginModal();
  autoLogin(user, pass);
}


async function autoLogin(user, pass) {
  try {
    const token = await login(user, pass);
    let telemetry = await getTelemetry(token, keysAsset, 'ASSET', entityIdAsset);
    let telemetryETI = await getTelemetry(token, keysDevice, 'DEVICE', entityIdDevice);
    telemetry = { ...telemetry, ...telemetryETI };
    calcolaIndicatori(telemetry);
    setInterval(async () => {
      let telemetry = await getTelemetry(token, keysAsset, 'ASSET', entityIdAsset);
      let telemetryETI = await getTelemetry(token, keysDevice, 'DEVICE', entityIdDevice);
      telemetry = { ...telemetry, ...telemetryETI };
      calcolaIndicatori(telemetry);
    }, 15 * 60 * 1000);
  } catch (err) {
    console.error('Login fallito:', err);
    showLoginModal();
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("l4_user");
  const savedPass = localStorage.getItem("l4_pass");

  if (savedUser && savedPass) {
    hideLoginModal();
    autoLogin(savedUser, savedPass);
  } else {
    showLoginModal();
  }

  
  checkForUpdates(); // controllo iniziale
  setInterval(checkForUpdates, 1 * 60 * 1000); // ogni 1 minuto
});


function checkForUpdates() {
  axios.get('version.json', {
    headers: { 'Cache-Control': 'no-store' },
    params: { t: new Date().getTime() } // forziamo anti-cache con query param
  })
  .then(res => {
    const currentVersion = res.data.version;
    const lastVersion = localStorage.getItem("site_version");

    if (lastVersion && lastVersion !== currentVersion) {
      console.log("Nuova versione disponibile:", currentVersion);
      location.reload(); // aggiornamento forzato
    } else {
      localStorage.setItem("site_version", currentVersion);
      console.log("Nessun aggiornamento, versione attuale:", currentVersion);
    }
  })
  .catch(err => {
    console.warn("Impossibile controllare versione:", err);
  });
}
