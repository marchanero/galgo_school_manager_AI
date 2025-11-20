import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const cameras = await prisma.camera.findMany()
    console.log('Cameras:', cameras)

    const sensors = await prisma.sensor.findMany()
    console.log('Sensors:', sensors)

    const scenarios = await prisma.scenario.findMany()
    console.log('Scenarios:', scenarios)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
