// script.js


const HOST_L4 = 'https://level4.omnicon.it';
const entityIdAsset = 'df769a70-4544-11f0-acb3-7d1711d9d68a';
const entityIdDevice = '0fd19aa1-45d9-11f0-acb3-7d1711d9d68a';
const keysAsset = ['EGS', 'EGE']; // EGS, EGE
const keysDevice = ['ETI_001',"PAT_001"]; // ETI, PAT
  
let currentIndex = 0;
let lastSwitchTime = 0;
const kpiCards = document.querySelectorAll('.kpi-card');
const switchInterval = 2500; // 15s

let telemetryInterval = null;

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
  const prodAttuale = parseFloat(data["PAT_001"]?.[0]?.value || 0); // PAT
  const totalProd = parseFloat(data["ETI_001"]?.[0]?.value || 0); // ETI
  const EGS = parseFloat(data.EGS?.[0]?.value || 0); // EGS
  const EGE = parseFloat(data.EGE?.[0]?.value || 0); // EGE
  let dailyProd = EGE + EGS;

  const coeffCO2 = 0.475; // Coefficiente di emissione CO2 in kg/kWh
  const coeffCoal = 0.4; // Coefficiente di emissione CO2 da carbone in kg/kWh
  const coeffTree = 18.3; // Coefficiente di assorbimento CO2 da parte di un albero in kg/anno
  const treeLifespan = 40; // Vita media di un albero in anni

  const tonCO2 = ((coeffCO2 * totalProd)/1000).toFixed(2);
  const carbone = ((coeffCoal * totalProd)/1000).toFixed(2);

  document.querySelector('#carbone .kpi-value').innerText = `${carbone} t`;
  document.querySelector('#prod-attuale .kpi-value').innerText = `${(totalProd / 1000).toFixed(2)} kW`;
  document.querySelector('#co2 .kpi-value').innerText = `${tonCO2} t`;
  document.querySelector('#totale .kpi-value').innerText = `${(totalProd / 1000000).toFixed(2)} GWh`;
  document.querySelector('#giornaliera .kpi-value').innerText = `${(dailyProd / 1000000).toFixed(2)} MWh`;
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
    calcolaIndicatori({ ...telemetry, ...telemetryETI });
    startTelemetryLoop(token);
    requestAnimationFrame(animateKpiLoop);
  } catch (err) {
    localStorage.removeItem("l4_user");
    localStorage.removeItem("l4_pass");
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
  setInterval(checkForUpdates, 60 * 60 * 1000); // ogni 60 minuti
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
      // console.log("Nuova versione disponibile:", currentVersion);
      localStorage.setItem("site_version", currentVersion); // salva prima
      location.reload(); // aggiornamento forzato
    } else {
      localStorage.setItem("site_version", currentVersion);
      // console.log("Nessun aggiornamento, versione attuale:", currentVersion);
    }
  })
  .catch(err => {
    console.warn("Impossibile controllare versione:", err);
  });
}

function animateKpiLoop(timestamp) {
  if (!lastSwitchTime) lastSwitchTime = timestamp;

  const elapsed = timestamp - lastSwitchTime;

  // Protezione: solo se il tempo trascorso è entro limiti accettabili
  if (elapsed >= switchInterval ) {
    // Reset trasformazioni
    kpiCards.forEach(card => {
      card.style.transform = 'scale(0.98)';
      card.style.transition = 'transform 1s ease-in-out';
    });

    // Applica trasformazione al prossimo elemento
    const currentCard = kpiCards[currentIndex];
    currentCard.style.transform = 'scale(1.03)';

    // Prepara il prossimo ciclo
    currentIndex = (currentIndex + 1) % kpiCards.length;
    lastSwitchTime = timestamp;
  }

//   while (elapsed >= switchInterval) {
//   kpiCards.forEach(card => card.style.transform = 'scale(1)');
//   kpiCards[currentIndex].style.transform = 'scale(1.02)';
//   currentIndex = (currentIndex + 1) % kpiCards.length;
//   lastSwitchTime += switchInterval; // aggiungi invece di riassegnare timestamp
// }


  requestAnimationFrame(animateKpiLoop);
}

function startTelemetryLoop(token) {
  if (telemetryInterval) clearInterval(telemetryInterval);
  telemetryInterval = setInterval(async () => {
    try {
      const telemetry = await getTelemetry(token, keysAsset, 'ASSET', entityIdAsset);
      const telemetryETI = await getTelemetry(token, keysDevice, 'DEVICE', entityIdDevice);
      calcolaIndicatori({ ...telemetry, ...telemetryETI });
    } catch (e) {
      console.warn("Errore polling dati:", e);
    }
  }, 45 * 60 * 1000);
}