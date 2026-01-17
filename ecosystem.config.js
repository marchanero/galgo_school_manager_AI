module.exports = {
  apps: [
    {
      name: "galgo-backend",
      cwd: "./backend",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      }
    },
    {
      name: "galgo-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "run dev -- --host", // Expose to network
      env: {
        PORT: 5173
      }
    },
    {
      name: "galgo-sensors",
      cwd: "./test_publisher",
      script: "simulate_sensors_10min.mjs",
      env: {
        DURATION_SEC: "5400" // 1.5 horas
      }
    }
  ]
}
