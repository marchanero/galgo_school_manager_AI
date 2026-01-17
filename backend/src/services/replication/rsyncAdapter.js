import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * RsyncAdapter - Adaptador para transferencias usando rsync via SSH
 * 
 * Características:
 * - Sincronización incremental eficiente
 * - Soporte para claves SSH
 * - Compresión adaptativa
 */
class RsyncAdapter {
  constructor(config = {}) {
    this.config = {
      host: config.host,
      user: config.user,
      port: config.port || 22,
      sshKeyPath: config.sshKeyPath
    }
  }

  /**
   * Ejecuta transferencia con rsync via SSH
   */
  async transfer(localPath, remotePath, onProgress = null) {
    return new Promise((resolve, reject) => {
      const { host, user, port, sshKeyPath } = this.config
      
      const sshCmd = sshKeyPath 
        ? `ssh -p ${port} -i ${sshKeyPath} -o StrictHostKeyChecking=no`
        : `ssh -p ${port} -o StrictHostKeyChecking=no`
      
      const args = [
        '-avz',
        '--partial',
        '--inplace',
        '--compress-level=1',
        '-e', sshCmd,
        localPath.endsWith('/') ? localPath : localPath + '/',
        `${user}@${host}:${remotePath}`
      ]
      
      console.log(`🚀 Ejecutando: rsync ${args.slice(0, 3).join(' ')} ...`)
      
      const proc = spawn('rsync', args)
      let stderr = ''
      
      proc.stdout.on('data', (data) => {
        const line = data.toString().trim()
        if (!line.includes('%') && line.length > 0) {
          console.log(`[rsync] ${line}`)
        }
      })
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          reject(new Error(`rsync terminó con código ${code}: ${stderr.slice(-500)}`))
        }
      })
      
      proc.on('error', reject)
    })
  }

  /**
   * Nombre del adaptador
   */
  getName() {
    return 'rsync'
  }
}

/**
 * MountAdapter - Adaptador para copias a montajes locales (SMB/NFS)
 * 
 * Usar rsync local es más eficiente que copias directas
 */
export class MountAdapter {
  constructor(config = {}) {
    this.config = {
      mountPath: config.mountPath
    }
  }

  /**
   * Copia archivos a punto de montaje local usando rsync
   */
  async transfer(localPath, remotePath, onProgress = null) {
    return new Promise((resolve, reject) => {
      const { mountPath } = this.config
      const fullRemotePath = path.join(mountPath, remotePath)
      
      // Crear directorio destino si no existe
      if (!fs.existsSync(fullRemotePath)) {
        fs.mkdirSync(fullRemotePath, { recursive: true })
      }
      
      const args = [
        '-av',
        '--partial',
        '--inplace',
        '--progress',
        localPath.endsWith('/') ? localPath : localPath + '/',
        fullRemotePath + '/'
      ]
      
      console.log(`🚀 Ejecutando: rsync (local mount) ${localPath} -> ${fullRemotePath}`)
      
      const proc = spawn('rsync', args)
      let stderr = ''
      let bytesTransferred = 0
      
      proc.stdout.on('data', (data) => {
        const line = data.toString().trim()
        const match = line.match(/(\d+,?\d*)\s+\d+%/)
        if (match) {
          bytesTransferred = parseInt(match[1].replace(/,/g, ''), 10)
        }
        if (!line.includes('%') && line.length > 0 && line.length < 100) {
          console.log(`[rsync] ${line}`)
        }
      })
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, bytesTransferred })
        } else {
          reject(new Error(`rsync terminó con código ${code}: ${stderr.slice(-500)}`))
        }
      })
      
      proc.on('error', reject)
    })
  }

  /**
   * Nombre del adaptador
   */
  getName() {
    return 'mount'
  }
}

export default RsyncAdapter
