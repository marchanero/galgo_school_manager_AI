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
    }
  ]
}
