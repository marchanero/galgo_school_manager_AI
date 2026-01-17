import mqtt from 'mqtt';

const BROKER_URL = 'mqtt://localhost:1883';
const USERNAME = 'admin';
const PASSWORD = 'galgo2526';

// Configuración EmotiBit (según especificaciones)
const FREQUENCY_HZ = 25;
const INTERVAL_MS = 40; // 1000/25 = 40ms
const DURATION_SEC = 600; // 10 minutos
const DURATION_MS = DURATION_SEC * 1000;

// Configuración Sensores Ambientales (baja frecuencia)
const ENV_FREQUENCY_HZ = 0.5; // 1 mensaje cada 2 segundos
const ENV_INTERVAL_MS = 2000;

const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `sim-emotibit-real-${Date.now()}`
});

// Estado interno para generación señales continuas
const emotibitState = {
  // EmotiBit 1 (Aula 1)
  'EM_AABBCCDD01': {
    phase: 0,
    respirationPhase: 0,
    eda: 5.0,
    temp: 36.5,
    sensorTemp: 25.0,
    heartRate: 75,
    hrv: 50,
    ibi: 800,
    lastBeat: Date.now(),
    accelZ: 1.0 // Gravedad
  },
  // EmotiBit 2 (Aula 2)
  'EM_FFEEDDCCBB': {
    phase: 2, // Desfase
    respirationPhase: 1,
    eda: 4.2,
    temp: 36.7,
    sensorTemp: 26.1,
    heartRate: 82,
    hrv: 45,
    ibi: 730,
    lastBeat: Date.now(),
    accelZ: 1.0
  }
};

// Generadores señales
const signalGenerators = {
  // PPG: Onda de pulso
  ppg: (state) => {
    state.phase += 0.2; // Velocidad avance fase
    // Simula onda dicrotica simple
    return parseFloat((Math.sin(state.phase) * 0.3 + 0.7 + Math.random() * 0.05).toFixed(4));
  },

  // EDA: Tónica + Fásica (Respiración)
  eda: (state) => {
    state.respirationPhase += 0.05;
    // Componente respiratorio lento
    const respiration = Math.sin(state.respirationPhase) * 0.1;
    // Deriva lenta (tónica)
    const drift = (Math.random() - 0.5) * 0.01;
    state.eda = Math.max(0.1, state.eda + drift + respiration * 0.01);
    return parseFloat(state.eda.toFixed(3));
  },

  // Heart Rate & HRV
  heartRate: (state) => {
    // Variabilidad latido a latido
    const variability = (Math.random() - 0.5) * 2;
    state.heartRate += variability * 0.1; // Suavizado
    // Mantener en rango fisiológico
    state.heartRate = Math.max(60, Math.min(100, state.heartRate));
    return parseFloat(state.heartRate.toFixed(1));
  },

  // Temperatura
  temp: (state) => {
    state.temp += (Math.random() - 0.5) * 0.01;
    return parseFloat(state.temp.toFixed(2));
  },

  // Acelerómetro (Gravedad + Ruido)
  accel: (state) => {
    const noise = () => (Math.random() - 0.5) * 0.05;
    return {
      x: parseFloat(noise().toFixed(3)),
      y: parseFloat(noise().toFixed(3)),
      z: parseFloat((state.accelZ + noise()).toFixed(3))
    };
  }
};

client.on('connect', () => {
  console.log('🚀 Simulación 25Hz EmotiBit Iniciada (Documentación Oficial)');
  console.log(`⏱️  Duración: 10 minutos (${DURATION_MS}ms)`);
  console.log(`📡 Dispositivos: 2 EmotiBit + 3 Sensores Ambientales`);

  const startTime = Date.now();
  
  // 1. Loop de Alta Frecuencia (25Hz) para EmotiBit
  const fastTimer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - startTime;

    if (elapsed >= DURATION_MS) {
      clearInterval(fastTimer);
      clearInterval(slowTimer);
      console.log('\n✅ Simulación completada.');
      client.end();
      process.exit(0);
      return;
    }

    // Publicar datos para ambos EmotiBits
    Object.keys(emotibitState).forEach(deviceId => {
      const state = emotibitState[deviceId];
      const baseTopic = deviceId === 'EM_AABBCCDD01' 
        ? 'aula1/emotibit/EM_AABBCCDD01' 
        : 'aula2/emotibit/EM_FFEEDDCCBB';
      
      const location = deviceId === 'EM_AABBCCDD01' ? 'Aula 1' : 'Aula 2';

      // Generar paquete completo de datos 25Hz
      const payload = {
        timestamp: new Date().toISOString(),
        location: location,
        value: {
          ppg: signalGenerators.ppg(state),
          eda: signalGenerators.eda(state),
          heart_rate: signalGenerators.heartRate(state),
          temperature: signalGenerators.temp(state),
          sensor_temperature: state.sensorTemp,
          // Vectores IMU (Aplanados o anidados según prefiera el backend)
          // Backend actual prefiere objetos anidados para visualizar bonito en dashboard
          accel: signalGenerators.accel(state),
          gyro: signalGenerators.accel(state), // Reutilizamos generador ruido
          mag: signalGenerators.accel(state),
          // Métricas derivadas
          hrv: Math.round(state.hrv + (Math.random() - 0.5) * 5),
          ibi: Math.round(60000 / state.heartRate)
        }
      };

      // Publicar en topic general del dispositivo y subtopics específicos para compatibilidad
      // 1. Topic único con todo el payload (más eficiente)
      client.publish(`${baseTopic}/all`, JSON.stringify(payload));

      // 2. Topics individuales para el dashboard actual (según configuración actual)
      client.publish(`${baseTopic}/ppg`, JSON.stringify({ ...payload, value: payload.value.ppg, type: 'ppg' }));
      client.publish(`${baseTopic}/eda`, JSON.stringify({ ...payload, value: payload.value.eda, type: 'eda' }));
      client.publish(`${baseTopic}/hr`, JSON.stringify({ ...payload, value: payload.value.heart_rate, type: 'heart_rate' }));
      client.publish(`${baseTopic}/temp`, JSON.stringify({ ...payload, value: payload.value.temperature, type: 'temperature' }));
      client.publish(`${baseTopic}/acc`, JSON.stringify({ ...payload, value: payload.value.accel, type: 'accelerometer' }));
    });

  }, INTERVAL_MS);

  // 2. Loop de Baja Frecuencia (0.5Hz) para Ambiente
  const slowTimer = setInterval(() => {
    // Invernadero
    client.publish('invernadero/humidity/sensor1', JSON.stringify({
      value: parseFloat((55 + Math.random() * 5).toFixed(1)),
      type: 'humidity',
      location: 'Invernadero',
      timestamp: new Date().toISOString()
    }));

    // Biblioteca
    client.publish('biblioteca/co2/sensor1', JSON.stringify({
      value: Math.floor(450 + Math.random() * 50),
      type: 'co2',
      location: 'Biblioteca',
      timestamp: new Date().toISOString()
    }));

    process.stdout.write(`\r📡 [${new Date().toLocaleTimeString()}] EmotiBit 25Hz OK | Env. 0.5Hz OK`);
  }, ENV_INTERVAL_MS);

});

client.on('error', (err) => {
    console.error('❌ Error MQTT:', err.message);
    process.exit(1);
});
