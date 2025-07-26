const fs = require('fs');
const path = require('path');

// Membaca data dari ws.json
const sourceDataPath = path.join(__dirname, 'ws.json');
const sourceData = JSON.parse(fs.readFileSync(sourceDataPath, 'utf8'));

// Logika untuk memproses data dan membuat format API yang diinginkan
const weatherApiOutput = {
  timestamp: new Date().toISOString(), // Tambahkan timestamp
  location: sourceData.city,
  current: {
    temperature: `${sourceData.temperature_celsius}°C`,
    condition: sourceData.condition,
    humidity: `${sourceData.humidity_percent}%`,
    wind_speed: `${sourceData.wind_kph} km/h`
  },
  forecast: [
    // Contoh: Anda bisa menambahkan logika untuk prakiraan di sini
    { "day": "Besok", "condition": "Hujan Ringan", "temp_max": "27°C" }
  ]
};

// Pastikan direktori 'api' ada
const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)){
    fs.mkdirSync(apiDir);
}

// Menulis output JSON ke file api/current_weather.json
const outputPath = path.join(apiDir, 'current_weather.json');
fs.writeFileSync(outputPath, JSON.stringify(weatherApiOutput, null, 2));

console.log('API cuaca berhasil diperbarui di:', outputPath);
