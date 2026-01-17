import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'

const exec = promisify(execCallback)

/**
 * RcloneAdapter - Adaptador para transferencias usando rclone
 * 
 * Características:
 * - Transferencia eficiente con checksums
 * - Progreso en tiempo real
 * - Configuración automática de remotes
 */
class RcloneAdapter {
  constructor(config = {}) {
    this.config = {
      rcloneRemote: config.rcloneRemote || 'truenas',
      transfers: config.transfers || 4,
      checkers: config.checkers || 8,
      retries: config.retries || 10,
      retrySleep: config.retrySleep || 30,
      timeout: config.timeout || 300,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      sshKeyPath: config.sshKeyPath
    }
  }

  /**
   * Configura remote de rclone si no existe
   */
  async setupRemote() {
    const { rcloneRemote, host, port, user, password, sshKeyPath } = this.config
    
    try {
      // Verificar si el remote ya existe
      const { stdout } = await exec(`rclone listremotes 2>/dev/null`)
      if (stdout.includes(`${rcloneRemote}:`)) {
        console.log(`✅ Remote rclone '${rcloneRemote}' ya existe`)
        return true
      }
      
      // Crear remote SFTP
      let createCmd = `rclone config create ${rcloneRemote} sftp host=${host} port=${port} user=${user}`
      
      if (password) {
        const { stdout: obscured } = await exec(`rclone obscure "${password}"`)
        createCmd += ` pass=${obscured.trim()}`
      }
      
      if (sshKeyPath) {
        createCmd += ` key_file=${sshKeyPath}`
      }
      
      await exec(createCmd)
      console.log(`✅ Remote rclone '${rcloneRemote}' creado exitosamente`)
      return true
    } catch (error) {
      console.error(`❌ Error configurando rclone: ${error.message}`)
      return false
    }
  }

  /**
   * Ejecuta transferencia con rclone
   */
  async transfer(localPath, remotePath, onProgress = null) {
    return new Promise((resolve, reject) => {
      const { rcloneRemote, transfers, checkers, retries, retrySleep, timeout } = this.config
      
      const args = [
        'copy',
        localPath,
        `${rcloneRemote}:${remotePath}`,
        '--checksum',
        `--transfers=${transfers}`,
        `--checkers=${checkers}`,
        `--retries=${retries}`,
        `--retries-sleep=${retrySleep}s`,
        `--timeout=${timeout}s`,
        '--low-level-retries=20',
        '--stats=1s',
        '--stats-one-line',
        '-P'
      ]
      
      console.log(`🚀 Ejecutando: rclone ${args.slice(0, 4).join(' ')} ...`)
      
      const proc = spawn('rclone', args)
      let stderr = ''
      
      // Regex para parsear progreso
      const progressRegex = /Transferred:\s*([0-9.]+\s*\w+)\s*\/\s*([0-9.]+\s*\w+),\s*(\d+)%,\s*([0-9.]+\s*\w+\/s),\s*ETA\s*(.+)/
      
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const match = line.match(progressRegex)
          if (match && onProgress) {
            const progressData = {
              transferred: match[1],
              total: match[2],
              percent: parseInt(match[3], 10),
              speed: match[4],
              eta: match[5].trim(),
              timestamp: new Date().toISOString()
            }
            
            onProgress(progressData)
            
            // Log cada 10%
            if (progressData.percent % 10 === 0) {
              console.log(`📊 Progreso: ${progressData.percent}% | ${progressData.speed} | ETA: ${progressData.eta}`)
            }
          }
        }
      })
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
        const line = data.toString().trim()
        if (!line.includes('DEBUG') && line.length > 0 && !line.includes('Transferred:')) {
          console.log(`[rclone] ${line}`)
        }
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          reject(new Error(`rclone terminó con código ${code}: ${stderr.slice(-500)}`))
        }
      })
      
      proc.on('error', (error) => reject(error))
    })
  }

  /**
   * Nombre del adaptador
   */
  getName() {
    return 'rclone'
  }
}

export default RcloneAdapter
