const fs = require('fs');
const path = require('path');

// --- START: MODIFIKASI DI SINI ---
// URL API cuaca yang akan kita ambil datanya
const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast?latitude=-3.6596&longitude=128.1884&current_weather=true&timezone=Asia%2FJakarta";

async function generateWeatherApi() {
    let rawWeatherData;
    try {
        console.log(`Mengambil data dari API: ${WEATHER_API_URL}`);
        const response = await fetch(WEATHER_API_URL);
        if (!response.ok) {
            throw new Error(`Gagal mengambil data cuaca: ${response.statusText}`);
        }
        rawWeatherData = await response.json();
        console.log("Data cuaca berhasil diambil.");
    } catch (error) {
        console.error("Error saat mengambil data cuaca:", error.message);
        // Fallback: Jika gagal mengambil dari API, coba baca dari file lokal jika ada
        // Ini adalah pilihan, Anda bisa menghapusnya jika selalu ingin dari API
        try {
            const fallbackPath = path.join(__dirname, 'ws.json');
            if (fs.existsSync(fallbackPath)) {
                console.log("Mencoba membaca dari ws.json sebagai fallback.");
                rawWeatherData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
            } else {
                throw new Error("Tidak ada data fallback ws.json.");
            }
        } catch (fallbackError) {
            console.error("Error saat fallback ke ws.json:", fallbackError.message);
            process.exit(1); // Keluar dengan error jika tidak ada data sama sekali
        }
    }

    // Ekstrak data yang relevan dari respons API
    // Perhatikan struktur data dari Open-Meteo API berbeda dari ws.json Anda
    const currentWeather = rawWeatherData.current_weather;
    const timezone = rawWeatherData.timezone; // Ambil timezone dari respons API

    // Logika untuk memproses data dan membuat format API yang diinginkan
    const weatherApiOutput = {
      timestamp: new Date().toISOString(), // Tambahkan timestamp saat API dibuat
      location: {
        latitude: rawWeatherData.latitude,
        longitude: rawWeatherData.longitude,
        timezone: timezone || "Asia/Jakarta" // Gunakan timezone dari API atau default
      },
      current: {
        temperature: `${currentWeather.temperature}°C`,
        windSpeed: `${currentWeather.windspeed} km/h`,
        windDirection: `${currentWeather.winddirection}°`,
        weatherCode: currentWeather.weathercode, // Kode cuaca dari Open-Meteo
        isDay: currentWeather.is_day === 1 ? 'Yes' : 'No',
        time: currentWeather.time // Waktu pengamatan dari API
      },
      // Anda bisa menambahkan data forecast di sini jika diambil dari API yang mendukungnya
      forecast_example: [ // Ini hanya contoh, Anda bisa mengembangkannya
          { "day": "Next update", "description": "Based on future API calls" }
      ]
    };

    // --- END: MODIFIKASI DI SINI ---

    // Pastikan direktori 'api' ada
    const apiDir = path.join(__dirname, 'api');
    if (!fs.existsSync(apiDir)){
        fs.mkdirSync(apiDir);
    }

    // Menulis output JSON ke file api/current_weather.json
    const outputPath = path.join(apiDir, 'current_weather.json');
    fs.writeFileSync(outputPath, JSON.stringify(weatherApiOutput, null, 2));

    console.log('API cuaca berhasil diperbarui di:', outputPath);
}

// Panggil fungsi utama
generateWeatherApi();
