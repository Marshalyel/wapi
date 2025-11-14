/**
 * generate-bmkg-api-auto.js
 * Node.js script untuk otomatis update API cuaca BMKG tiap 5 menit
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js'); // npm i xml2js

const LOCATIONS = [
  { name: "Ambon", id: "ambon", adm4: "81.76.01.1001" },
  { name: "Jakarta", id: "jakarta", adm4: "31.71.06.1001" },
  { name: "Surabaya", id: "surabaya", adm4: "35.76.01.1001" },
  { name: "Medan", id: "medan", adm4: "12.76.01.1001" },
  { name: "Makassar", id: "makassar", adm4: "73.77.01.1001" },
  { name: "Bandung", id: "bandung", adm4: "32.73.01.1001" },
  { name: "Yogyakarta", id: "yogyakarta", adm4: "34.75.01.1001" },
  { name: "Padang", id: "padang", adm4: "13.72.01.1001" }
];

const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);

async function fetchBMKGWeather(location) {
  const url = `https://data.bmkg.go.id/cuaca/prakiraan-cuaca/${location.adm4}.xml`;

  try {
    console.log(`[${new Date().toLocaleTimeString()}] Mengambil data BMKG untuk ${location.name}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xmlText = await res.text();
    const json = await xml2js.parseStringPromise(xmlText, { explicitArray: false });

    const prakiraan = json.weather.forecast.area.parameter
      .filter(p => ["cuaca", "suhu", "kecepatan_angin", "arah_angin"].includes(p.$.id))
      .reduce((acc, p) => {
        acc[p.$.id] = p.timerange.value;
        return acc;
      }, {});

    const output = {
      timestamp: new Date().toISOString(),
      location: { name: location.name, adm4: location.adm4 },
      current: {
        weather: prakiraan.cuaca || "Tidak tersedia",
        temperature: prakiraan.suhu || "Tidak tersedia",
        windSpeed: prakiraan.kecepatan_angin || "Tidak tersedia",
        windDirection: prakiraan.arah_angin || "Tidak tersedia",
        time: new Date().toISOString()
      }
    };

    fs.writeFileSync(path.join(apiDir, `${location.id}.json`), JSON.stringify(output, null, 2));
    return location.id;

  } catch (err) {
    console.error(`Gagal mengambil data untuk ${location.name}: ${err.message}`);
    return null;
  }
}

async function updateAllLocations() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Memulai update semua lokasi...`);
  for (const loc of LOCATIONS) {
    await fetchBMKGWeather(loc);
  }
  // Update index
  fs.writeFileSync(path.join(apiDir, 'locations.json'),
    JSON.stringify(LOCATIONS.map(l => ({ id: l.id, name: l.name })), null, 2));
  console.log(`[${new Date().toLocaleTimeString()}] Semua API kota diperbarui.\n`);
}

// Jalankan pertama kali
updateAllLocations();

// Set interval setiap 5 menit
setInterval(updateAllLocations, 5 * 60 * 1000); // 5 menit = 300000 ms
