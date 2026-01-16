import mqtt from 'mqtt';

const BROKER_URL = 'mqtt://localhost:1883';
const USERNAME = 'admin';
const PASSWORD = 'galgo2526';

const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `sim-10min-${Date.now()}`
});

// Sensores del escenario "Aula Magna" con sus topicBase correctos
const sensors = [
  // EmotiBit Aula 1 (EM:AA:BB:CC:DD:01) - topicBase: aula1/emotibit/EM_AABBCCDD01
  { topic: 'aula1/emotibit/EM_AABBCCDD01/hr', type: 'heart_rate', location: 'Aula 1', min: 70, max: 90 },
  { topic: 'aula1/emotibit/EM_AABBCCDD01/eda', type: 'eda', location: 'Aula 1', min: 0.1, max: 0.8 },
  
  // EmotiBit Aula 2 (EM:FF:EE:DD:CC:BB) - topicBase: aula2/emotibit/EM_FFEEDDCCBB
  { topic: 'aula2/emotibit/EM_FFEEDDCCBB/hr', type: 'heart_rate', location: 'Aula 2', min: 65, max: 85 },
  { topic: 'aula2/emotibit/EM_FFEEDDCCBB/eda', type: 'eda', location: 'Aula 2', min: 0.2, max: 0.6 },
  
  // Humedad Invernadero (HUM:AA:BB:CC:DD:EE) - topicBase: invernadero/humidity
  { topic: 'invernadero/humidity/sensor1', type: 'humidity', location: 'Invernadero', min: 40, max: 80 },
  
  // CO2 Biblioteca (CO2:11:22:33:44:55) - topicBase: biblioteca/co2
  { topic: 'biblioteca/co2/sensor1', type: 'co2', location: 'Biblioteca', min: 400, max: 600 },
  
  // Termómetro Laboratorio (TEMP:01:02:03:04:05) - topicBase: lab/sensors/temperature
  { topic: 'lab/sensors/temperature/sensor1', type: 'temperature', location: 'Laboratorio', min: 20, max: 30 },
  
  // Sensor temperatura MOTA1 (sensor_tmp1) - topicBase: aulaMagna/temperature/EM:03:04:12:23
  { topic: 'aulaMagna/temperature/EM:03:04:12:23/value', type: 'temperature', location: 'Aula Magna', min: 18, max: 26 }
];

client.on('connect', () => {
    console.log('🚀 Simulación de 10 minutos iniciada...');
    let secondsPassed = 0;
    const duration = 600; // 10 minutos = 600 segundos
    const interval = 2000; // Cada 2 segundos

    const timer = setInterval(() => {
        secondsPassed += interval / 1000;
        const minutes = Math.floor(secondsPassed / 60);
        const secs = Math.floor(secondsPassed % 60);
        
        sensors.forEach(s => {
            const value = s.min + Math.random() * (s.max - s.min);
            const payload = {
                value: parseFloat(value.toFixed(2)),
                type: s.type,
                location: s.location,
                scenarioId: s.scenarioId,
                timestamp: new Date().toISOString()
            };
            client.publish(s.topic, JSON.stringify(payload));
        });

        process.stdout.write(`\r📡 Enviando datos... ${minutes}:${secs.toString().padStart(2, '0')} / 10:00`);

        if (secondsPassed >= duration) {
            clearInterval(timer);
            console.log('\n✅ Simulación de 10 minutos completada.');
            client.end();
            process.exit(0);
        }
    }, interval);
});

client.on('error', (err) => {
    console.error('❌ Error MQTT:', err.message);
    process.exit(1);
});
