/**
 * generate-weather.js
 *
 * Weather API Generator menggunakan data dari BMKG
 * Menggunakan kode Adm4 untuk tiap kota
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// --- DAFTAR LOKASI dengan kode Adm4 BMKG ---
const LOCATIONS = [
  { name: "Ambon", id: "ambon", adm4: "81.76.01.1001", timezone: "Asia/Jayapura" },
  { name: "Jakarta", id: "jakarta", adm4: "31.71.01.1001", timezone: "Asia/Jakarta" },
  { name: "Surabaya", id: "surabaya", adm4: "35.76.01.1001", timezone: "Asia/Jakarta" },
  { name: "Medan", id: "medan", adm4: "12.76.01.1001", timezone: "Asia/Jakarta" },
  { name: "Makassar", id: "makassar", adm4: "73.77.01.1001", timezone: "Asia/Makassar" },
  { name: "Bandung", id: "bandung", adm4: "32.73.01.1001", timezone: "Asia/Jakarta" },
  { name: "Yogyakarta", id: "yogyakarta", adm4: "34.75.01.1001", timezone: "Asia/Jakarta" },
  { name: "Padang", id: "padang", adm4: "13.72.01.1001", timezone: "Asia/Jakarta" }
];

const apiDir = path.join(__dirname, 'api');
const MAX_RETRIES = 3;

// Pastikan fetch ada
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    const { fetch: undiciFetch } = require('undici');
    fetchFn = undiciFetch;
  } catch (e) {
    console.error("Tidak ditemukan fetch global. Install 'undici' atau gunakan Node versi baru.");
    process.exit(1);
  }
}

// util
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function atomicWriteJson(filePath, obj) {
  const tmp = filePath + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(tmp, filePath);
}

async function fetchWithRetry(url, tries = MAX_RETRIES) {
  let attempt = 0, lastErr = null;
  while (attempt < tries) {
    try {
      const resp = await fetchFn(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      return await resp.json();
    } catch (err) {
      lastErr = err;
      attempt++;
      const backoff = 500 * Math.pow(2, attempt - 1);
      console.warn(`Fetch gagal (attempt ${attempt}/${tries}): ${err.message}. Retry ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function fetchAndGenerateWeatherForLocation(loc) {
  const outputPath = path.join(apiDir, `${loc.id}.json`);
  const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${loc.adm4}`;

  try {
    console.log(`Mengambil data BMKG untuk ${loc.name} (adm4=${loc.adm4})`);
    const data = await fetchWithRetry(url);

    // Ambil entri teratas (terbaru)
    const firstEntry = data.data?.[0]?.cuaca?.[0];
    if (!firstEntry) throw new Error('Data cuaca tidak ditemukan');

    const localTime = new Intl.DateTimeFormat("en-CA", {
      timeZone: loc.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date()).replace(",", "");

    const output = {
      timestamp: localTime,
      location: { name: loc.name, timezone: loc.timezone },
      current: {
        temperature: firstEntry.t + "°C",
        humidity: firstEntry.hu + "%",
        windSpeed: firstEntry.ws + " km/jam",
        windDirection: firstEntry.wd,
        weatherDescription: firstEntry.weather_desc
      },
      raw: data
    };

    await atomicWriteJson(outputPath, output);
    console.log(`Berhasil menulis: ${outputPath}`);
    return `api/${loc.id}.json`;
  } catch (err) {
    console.error(`Error ${loc.name}: ${err.message}`);
    return null;
  }
}

async function generateAllWeatherAPIs() {
  await fsp.mkdir(apiDir, { recursive: true });
  const generatedFiles = [];
  for (const loc of LOCATIONS) {
    const file = await fetchAndGenerateWeatherForLocation(loc);
    if (file) generatedFiles.push(file);
    await sleep(200);
  }

  const indexFilePath = path.join(apiDir, 'locations.json');
  await atomicWriteJson(indexFilePath, LOCATIONS.map(l => ({ id: l.id, name: l.name })));
  generatedFiles.push('api/locations.json');

  console.log("Selesai membuat semua API lokasi.");
  return generatedFiles;
}

generateAllWeatherAPIs()
  .then(files => console.log("Generated:", files))
  .catch(err => console.error("Fatal error:", err));
