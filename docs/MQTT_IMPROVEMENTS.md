# 📡 Mejoras de Seguridad y Robustez en MQTT

Este documento detalla las mejoras implementadas en el servicio MQTT para garantizar la seguridad, integridad y disponibilidad del sistema.

## 🔐 1. Gestión de Credenciales Seguras

Se han eliminado todas las credenciales hardcodeadas del código fuente.

- **Backend:** Ahora utiliza variables de entorno configurables en el archivo `.env`.
- **Frontend:** El cliente web ya no contiene credenciales. En su lugar, solicita la configuración al backend a través de un endpoint seguro (`/api/mqtt/config`) que no expone la contraseña.
- **Variables de Entorno:**
  - `MQTT_BROKER`: URL del broker TCP (ej: `mqtt://100.82.84.24:1883`).
  - `MQTT_WS_URL`: URL del broker via WebSockets (ej: `ws://100.82.84.24:8083/mqtt`).
  - `MQTT_USERNAME` / `MQTT_PASSWORD`: Credenciales de acceso.

## 🔄 2. Reconexión Robusta (Exponential Backoff)

Para evitar saturar el broker y garantizar la reconexión tras caídas de red, se ha implementado un algoritmo de **Exponential Backoff con Jitter**.

- **Algoritmo:**
  - El tiempo de espera entre reintentos se duplica progresivamente.
  - Se añade un factor de "jitter" aleatorio (±15%) para evitar colisiones si múltiples clientes intentan reconectar a la vez.
- **Configuración:**
  - `baseDelay`: 1000ms.
  - `maxDelay`: 60000ms.
  - `multiplier`: 2x.
  - `maxRetries`: 10 (configurable).

## ✅ 3. Validación de Datos (Zod)

Para garantizar que el sistema solo procese datos válidos, se ha integrado la librería **Zod** para validación de esquemas en tiempo real.

- **Esquemas Implementados:**
  - `temperatureSensorSchema`: Valida rangos de temperatura (-50°C a 100°C).
  - `humiditySensorSchema`: Valida rangos de humedad (0% a 100%).
  - `co2SensorSchema`: Valida niveles de CO2 (0 a 10000 ppm).
  - `emotiBitSchema`: Valida métricas biométricas específicas (HR, EDA, PPG).
  - `recordingCommandSchema`: Valida los comandos enviados a las cámaras.
- **Comportamiento:**
  - Los payloads mal formados o con valores fuera de rango son detectados y registrados como errores de validación sin afectar la integridad de la base de datos.
  - Se han añadido estadísticas de validación en tiempo real visibles en el panel de control.

## 📊 4. Estadísticas y Monitoreo

El servicio MQTT ahora reporta métricas detalladas:
- Mensajes recibidos vs. validados.
- Errores de validación vs. errores de sistema.
- Intentos de reconexión y estado actual del backoff.
- Historial de últimos mensajes recibidos.

---
*Documentación actualizada: 15 de enero de 2026*
