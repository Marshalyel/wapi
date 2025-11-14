/**
 * generate-weather.js
 *
 * Weather API Generator (WAPI)
 * Mengambil data cuaca dari Open-Meteo untuk beberapa kota,
 * menyimpan JSON dengan timestamp lokal sesuai timezone masing-masing kota.
 *
 * Requirements:
 * - Node.js >= 18 atau install 'undici' (npm i undici)
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// --- DAFTAR LOKASI (pastikan timezone sesuai IANA) ---
const LOCATIONS = [
  { name: "Ambon", id: "ambon", latitude: -3.6596, longitude: 128.1884, timezone: "Asia/Jayapura" }, // WIT
  { name: "Jakarta", id: "jakarta", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
  { name: "Surabaya", id: "surabaya", latitude: -7.2575, longitude: 112.7521, timezone: "Asia/Jakarta" },
  { name: "Medan", id: "medan", latitude: 3.5952, longitude: 98.6722, timezone: "Asia/Jakarta" },
  { name: "Makassar", id: "makassar", latitude: -5.1477, longitude: 119.4327, timezone: "Asia/Makassar" },
  { name: "Bandung", id: "bandung", latitude: -6.9175, longitude: 107.6191, timezone: "Asia/Jakarta" },
  { name: "Yogyakarta", id: "yogyakarta", latitude: -7.7956, longitude: 110.3695, timezone: "Asia/Jakarta" },
  { name: "Padang", id: "padang", latitude: -0.9517, longitude: 100.3546, timezone: "Asia/Jakarta" }
];

const apiDir = path.join(__dirname, 'api');
const CONCURRENCY = 3; // jumlah request paralel
const MAX_RETRIES = 3;

// --- Pastikan fetch ada ---
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    const { fetch: undiciFetch } = require('undici');
    fetchFn = undiciFetch;
  } catch (e) {
    console.error("Node.js tidak memiliki fetch. Gunakan Node >=18 atau install 'undici'.");
    process.exit(1);
  }
}

// --- util sleep ---
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// --- util atomic write ---
async function atomicWriteJson(filePath, obj) {
  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(tmp, filePath);
}

// --- util fallback baca file lama ---
async function readExistingJson(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// --- fetch dengan retry ---
async function fetchWithRetry(url, tries = MAX_RETRIES) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < tries) {
    try {
      const resp = await fetchFn(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const json = await resp.json();
      return json;
    } catch (err) {
      lastErr = err;
      attempt++;
      const backoff = 500 * Math.pow(2, attempt - 1);
      console.warn(`Fetch gagal (attempt ${attempt}/${tries}): ${err.message}, retry ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// --- proses satu lokasi ---
async function fetchAndGenerateWeatherForLocation(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current_weather: 'true',
    timezone: location.timezone
  });
  const WEATHER_API_URL = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const outputPath = path.join(apiDir, `${location.id}.json`);

  try {
    console.log(`Mengambil data untuk ${location.name} dari API`);
    const rawWeatherData = await fetchWithRetry(WEATHER_API_URL);
    const currentWeather = rawWeatherData?.current_weather;
    if (!currentWeather) throw new Error('current_weather tidak tersedia');

    // Timestamp lokal sesuai timezone kota
    const localTime = new Intl.DateTimeFormat("en-CA", {
      timeZone: location.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date()).replace(",", "");

    const weatherApiOutput = {
      timestamp: localTime,
      location: {
        name: location.name,
        latitude: rawWeatherData.latitude ?? location.latitude,
        longitude: rawWeatherData.longitude ?? location.longitude,
        timezone: rawWeatherData.timezone ?? location.timezone
      },
      current: {
        temperature: `${currentWeather.temperature}°C`,
        windSpeed: `${currentWeather.windspeed} km/h`,
        windDirection: `${currentWeather.winddirection}°`,
        weatherCode: currentWeather.weathercode,
        isDay: currentWeather.is_day === 1 ? 'Ya' : 'Tidak',
        time: currentWeather.time
      },
      raw: rawWeatherData
    };

    await atomicWriteJson(outputPath, weatherApiOutput);
    console.log(`OK: api/${location.id}.json`);
    return `api/${location.id}.json`;

  } catch (err) {
    console.error(`Error untuk ${location.name}: ${err.message}`);
    const existing = await readExistingJson(outputPath);
    if (existing) {
      existing._fallback = { note: `Data dipakai dari file lokal karena fetch gagal`, error: err.message };
      await atomicWriteJson(outputPath, existing);
      console.log(`Fallback digunakan untuk ${location.name}`);
      return `api/${location.id}.json (fallback)`;
    }
    return null;
  }
}

// --- chunk helper ---
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- fungsi utama ---
async function generateAllWeatherAPIs() {
  await fsp.mkdir(apiDir, { recursive: true });
  const generatedFiles = [];
  const batches = chunkArray(LOCATIONS, CONCURRENCY);

  for (const batch of batches) {
    const promises = batch.map(loc => fetchAndGenerateWeatherForLocation(loc));
    const results = await Promise.allSettled(promises);
    for (const r of results) if (r.status === 'fulfilled' && r.value) generatedFiles.push(r.value);
    await sleep(200);
  }

  const indexFilePath = path.join(apiDir, 'locations.json');
  await atomicWriteJson(indexFilePath, LOCATIONS.map(loc => ({ id: loc.id, name: loc.name })));
  generatedFiles.push('api/locations.json');

  console.log("Semua API lokasi telah dibuat/diperbarui.");
  return generatedFiles;
}

// --- jalankan ---
generateAllWeatherAPIs()
  .then(files => console.log("Selesai. Files:", files))
  .catch(err => { console.error("Kesalahan fatal:", err); process.exit(1); });
