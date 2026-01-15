import mqtt from 'mqtt';

const BROKER_URL = 'mqtt://localhost:1883';
const USERNAME = 'admin';
const PASSWORD = 'galgo2526';

const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `sim-1min-${Date.now()}`
});

const sensors = [
  { topic: 'aula1/emotibit/sensor1', type: 'heart_rate', location: 'aula1', scenarioId: 'clase_activa', min: 70, max: 90 },
  { topic: 'aula1/emotibit/sensor1', type: 'eda', location: 'aula1', scenarioId: 'clase_activa', min: 0.1, max: 0.8 },
  { topic: 'biblioteca/co2/sensor_main', type: 'co2', location: 'biblioteca', scenarioId: 'silencio', min: 400, max: 600 },
  { topic: 'invernadero/humidity/temp_soil', type: 'humidity', location: 'invernadero', scenarioId: 'riego', min: 40, max: 80 },
  { topic: 'lab/sensors/temp_01', type: 'temperature', location: 'laboratorio', scenarioId: 'test_estres', min: 20, max: 30 }
];

client.on('connect', () => {
    console.log('🚀 Iniciando simulación de 1 minuto...');
    let secondsPassed = 0;
    const duration = 60; // 60 segundos
    const interval = 2000; // Cada 2 segundos

    const timer = setInterval(() => {
        secondsPassed += interval / 1000;
        
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

        process.stdout.write(`\rEnviando datos... ${secondsPassed}/${duration}s`);

        if (secondsPassed >= duration) {
            clearInterval(timer);
            console.log('\n✅ Simulación completada.');
            client.end();
            process.exit(0);
        }
    }, interval);
});

client.on('error', (err) => {
    console.error('❌ Error MQTT:', err.message);
    process.exit(1);
});
