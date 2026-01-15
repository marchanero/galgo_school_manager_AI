import { z } from 'zod'

/**
 * Schemas de validación Zod para payloads MQTT
 * Garantizan la integridad de los datos de sensores antes de procesarlos
 */

// Schema base para timestamp
const timestampSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  z.number()
]).optional()

// Schema genérico para sensores con valor numérico
export const numericSensorSchema = z.object({
  value: z.union([z.number(), z.string().transform(v => parseFloat(v))]),
  unit: z.string().optional(),
  timestamp: timestampSchema,
  deviceId: z.string().optional(),
  location: z.string().optional()
}).passthrough() // Permite campos adicionales

// Schema para sensor de temperatura
export const temperatureSensorSchema = z.object({
  temperature: z.number().min(-50).max(100).optional(),
  value: z.number().min(-50).max(100).optional(),
  unit: z.enum(['°C', '°F', 'C', 'F']).optional(),
  timestamp: timestampSchema
}).passthrough()

// Schema para sensor de humedad
export const humiditySensorSchema = z.object({
  humidity: z.number().min(0).max(100).optional(),
  value: z.number().min(0).max(100).optional(),
  unit: z.literal('%').optional(),
  timestamp: timestampSchema
}).passthrough()

// Schema para sensor de CO2
export const co2SensorSchema = z.object({
  co2: z.number().min(0).max(10000).optional(),
  value: z.number().min(0).max(10000).optional(),
  unit: z.literal('ppm').optional(),
  timestamp: timestampSchema
}).passthrough()

// Schema para sensores de gases (NO2, SO2, O3, CO)
export const gasSensorSchema = z.object({
  value: z.number().min(0),
  gasType: z.enum(['no2', 'so2', 'o3', 'co', 'voc']).optional(),
  unit: z.enum(['ppm', 'ppb', 'mg/m3']).optional(),
  timestamp: timestampSchema
}).passthrough()

// Schema para EmotiBit (datos biométricos)
export const emotiBitSchema = z.object({
  hr: z.number().min(0).max(250).optional(),        // Heart Rate
  eda: z.number().min(0).optional(),                // Electrodermal Activity
  ppg: z.number().optional(),                       // Photoplethysmography
  temperature: z.number().min(20).max(45).optional(), // Skin temperature
  accel_x: z.number().optional(),
  accel_y: z.number().optional(),
  accel_z: z.number().optional(),
  timestamp: timestampSchema
}).passthrough()

// Schema para comandos de grabación
export const recordingCommandSchema = z.object({
  command: z.enum(['start', 'stop', 'pause', 'resume']),
  rule: z.string().optional(),
  ruleId: z.number().optional(),
  duration: z.number().positive().optional(),
  sensorData: z.record(z.unknown()).optional(),
  timestamp: z.string().optional()
})

// Schema para condiciones de reglas
export const ruleConditionSchema = z.object({
  field: z.string().optional(),
  operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
  value: z.union([z.number(), z.string()])
})

// Schema para acciones de reglas
export const ruleActionSchema = z.object({
  type: z.enum(['start_recording', 'stop_recording', 'alert', 'notify']),
  cameras: z.array(z.number()).optional(),
  duration: z.number().positive().optional(),
  message: z.string().optional()
})

/**
 * Obtener el schema apropiado según el tipo de sensor
 */
export function getSchemaForSensorType(sensorType) {
  const schemas = {
    'temperature': temperatureSensorSchema,
    'humidity': humiditySensorSchema,
    'co2': co2SensorSchema,
    'emotibit': emotiBitSchema,
    'gases/no2': gasSensorSchema,
    'gases/so2': gasSensorSchema,
    'gases/o3': gasSensorSchema,
    'gases/co': gasSensorSchema,
    'voc': gasSensorSchema
  }
  
  return schemas[sensorType] || numericSensorSchema
}

/**
 * Validar payload de sensor
 * @param {string} sensorType - Tipo de sensor
 * @param {object} data - Datos a validar
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function validateSensorPayload(sensorType, data) {
  try {
    const schema = getSchemaForSensorType(sensorType)
    const result = schema.safeParse(data)
    
    if (result.success) {
      return { success: true, data: result.data }
    } else {
      const errorMessage = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      return { success: false, error: errorMessage }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Validar comando de grabación
 */
export function validateRecordingCommand(data) {
  const result = recordingCommandSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { 
    success: false, 
    error: result.error.errors.map(e => e.message).join(', ') 
  }
}

export default {
  validateSensorPayload,
  validateRecordingCommand,
  getSchemaForSensorType,
  schemas: {
    numericSensorSchema,
    temperatureSensorSchema,
    humiditySensorSchema,
    co2SensorSchema,
    gasSensorSchema,
    emotiBitSchema,
    recordingCommandSchema,
    ruleConditionSchema,
    ruleActionSchema
  }
}
