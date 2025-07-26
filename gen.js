const fs = require('fs');
const path = require('path');

// --- Daftar Lokasi yang ingin Anda sediakan ---
// Anda bisa menambahkan atau mengurangi lokasi di sini.
// Pastikan lintang (latitude), bujur (longitude), dan timezone sudah benar.
const LOCATIONS = [
    { name: "Ambon", id: "ambon", latitude: -3.6596, longitude: 128.1884, timezone: "Asia/Jakarta" },
    { name: "Jakarta", id: "jakarta", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
    { name: "Surabaya", id: "surabaya", latitude: -7.2575, longitude: 112.7521, timezone: "Asia/Jakarta" },
    { name: "Medan", id: "medan", latitude: 3.5952, longitude: 98.6722, timezone: "Asia/Jakarta" },
    { name: "Makassar", id: "makassar", latitude: -5.1477, longitude: 119.4327, timezone: "Asia/Makassar" }
];

// Pastikan direktori 'api' ada
const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)){
    fs.mkdirSync(apiDir);
}

// Fungsi asinkron untuk mengambil data cuaca untuk satu lokasi
async function fetchAndGenerateWeatherForLocation(location) {
    const WEATHER_API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&timezone=${encodeURIComponent(location.timezone)}`;

    let rawWeatherData;
    try {
        console.log(`Mengambil data untuk ${location.name} dari API: ${WEATHER_API_URL}`);
        const response = await fetch(WEATHER_API_URL);
        if (!response.ok) {
            throw new Error(`Gagal mengambil data cuaca untuk ${location.name}: ${response.statusText}`);
        }
        rawWeatherData = await response.json();
        console.log(`Data cuaca untuk ${location.name} berhasil diambil.`);
    } catch (error) {
        console.error(`Error saat mengambil data cuaca untuk ${location.name}:`, error.message);
        // Fallback: Jika gagal mengambil dari API, coba baca dari file lokal jika ada
        // Untuk skenario multi-lokasi, fallback ke ws.json kurang relevan kecuali Anda punya banyak ws.json
        // Jadi, untuk kesederhanaan, kita akan mencatat error dan melanjutkan ke lokasi berikutnya
        // atau bisa juga menggunakan data dummy di sini
        console.warn(`Menggunakan data dummy atau skip untuk ${location.name} karena gagal.`);
        return null; // Mengembalikan null jika gagal
    }

    const currentWeather = rawWeatherData.current_weather;

    // Logika untuk memproses data dan membuat format API yang diinginkan
    const weatherApiOutput = {
      timestamp: new Date().toISOString(),
      location: {
        name: location.name,
        latitude: rawWeatherData.latitude,
        longitude: rawWeatherData.longitude,
        timezone: rawWeatherData.timezone
      },
      current: {
        temperature: `${currentWeather.temperature}°C`,
        windSpeed: `${currentWeather.windspeed} km/h`,
        windDirection: `${currentWeather.winddirection}°`,
        weatherCode: currentWeather.weathercode,
        isDay: currentWeather.is_day === 1 ? 'Yes' : 'No',
        time: currentWeather.time
      },
      // Anda bisa menambahkan data forecast di sini jika diambil dari API yang mendukungnya
      forecast_example: []
    };

    // Menulis output JSON ke file api/[location.id].json
    const outputPath = path.join(apiDir, `${location.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(weatherApiOutput, null, 2));

    console.log(`API cuaca untuk ${location.name} berhasil diperbarui di: ${outputPath}`);
    return location.id; // Mengembalikan ID lokasi yang berhasil dibuat
}

// Fungsi utama untuk menjalankan proses untuk semua lokasi
async function generateAllWeatherAPIs() {
    const generatedFiles = [];
    for (const location of LOCATIONS) {
        const fileId = await fetchAndGenerateWeatherForLocation(location);
        if (fileId) {
            generatedFiles.push(`api/${fileId}.json`);
        }
    }

    // Jika Anda ingin membuat satu file index yang berisi daftar lokasi yang tersedia
    const indexFilePath = path.join(apiDir, 'locations.json');
    fs.writeFileSync(indexFilePath, JSON.stringify(LOCATIONS.map(loc => ({ id: loc.id, name: loc.name })), null, 2));
    generatedFiles.push(`api/locations.json`);

    // Ini penting: GitHub Actions perlu mengetahui file apa saja yang berubah/dibuat
    // untuk `git add`. Kita akan meng-add semua file .json di folder api/.
    return generatedFiles;
}

// Panggil fungsi utama dan tangani hasilnya untuk git commit
generateAllWeatherAPIs()
    .then(generatedFiles => {
        // Logika `git add` akan menangani `api/*` di workflow
        console.log("Semua API lokasi telah dibuat/diperbarui.");
    })
    .catch(error => {
        console.error("Kesalahan fatal saat membuat API lokasi:", error);
        process.exit(1); // Keluar dengan error
    });
