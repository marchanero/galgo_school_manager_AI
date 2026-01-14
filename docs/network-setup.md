# 🌐 Configuración de Red - Galgo School Manager

## Descripción del Problema

Cuando se conecta un router GL.iNet (con OpenWRT) a un ordenador Ubuntu para gestionar sensores y cámaras, se produce un problema de **doble NAT** que impide el acceso directo a los dispositivos.

## Topología de Red

```
                    Internet
                        │
                   192.168.1.1 (Gateway ISP)
                        │
    ┌───────────────────┴───────────────────┐
    │         Ubuntu Server                  │
    │         enp1s0: 192.168.1.x (DHCP)    │
    │                                        │
    │   USB Ethernet: 192.168.50.1          │
    │   (enx00e04c36022a o similar)         │
    └───────────────────┬───────────────────┘
                        │
                        │ Cable Ethernet
                        │
    ┌───────────────────┴───────────────────┐
    │      GL.iNet Router (OpenWRT)         │
    │        WAN: 192.168.50.2              │
    │        LAN: 192.168.8.1               │
    │        (Gateway para sensores)        │
    └───────────────────┬───────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │ Cámara  │   │ Sensor  │   │ Sensor  │
    │.8.210   │   │  .8.x   │   │  .8.x   │
    └─────────┘   └─────────┘   └─────────┘
```

## Problema

1. Ubuntu solo conoce la red `192.168.50.0/24`
2. Los sensores están en `192.168.8.0/24`
3. El router hace NAT, ocultando la red interna
4. Ubuntu no puede alcanzar directamente los dispositivos en `192.168.8.x`

## Solución

### Configuración necesaria:

| Componente | Configuración | Descripción |
|------------|--------------|-------------|
| **Ubuntu** | Ruta estática | `192.168.8.0/24 via 192.168.50.2` |
| **GL.iNet** | FORWARD permitido | Entre `192.168.50.0/24` ↔ `192.168.8.0/24` |
| **GL.iNet** | NAT bypass | No aplicar NAT al tráfico interno |

---

## Paso 1: Configuración en Ubuntu

### 1.1 Verificar IP Forwarding
```bash
cat /proc/sys/net/ipv4/ip_forward
# Debe mostrar "1"

# Si muestra "0", habilitar:
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf
```

### 1.2 Identificar la interfaz USB Ethernet
```bash
ip addr show | grep -E "enx|usb"
# Buscar la interfaz con IP 192.168.50.1
```

### 1.3 Añadir ruta estática (temporal)
```bash
sudo ip route add 192.168.8.0/24 via 192.168.50.2 dev <INTERFAZ_USB>
```

### 1.4 Hacer la ruta persistente
```bash
# Crear script de inicio
sudo tee /etc/networkd-dispatcher/routable.d/50-sensor-route << 'EOF'
#!/bin/bash
# Ruta hacia la red de sensores via GL.iNet
ip route add 192.168.8.0/24 via 192.168.50.2 dev enx00e04c36022a 2>/dev/null || true
EOF

sudo chmod +x /etc/networkd-dispatcher/routable.d/50-sensor-route
```

---

## Paso 2: Configuración en GL.iNet (OpenWRT)

### 2.1 Acceder al router
- Interfaz web: `http://192.168.50.2`
- SSH: `ssh root@192.168.50.2`

### 2.2 Vía LuCI (Interfaz Web)

1. **Network → Firewall → Custom Rules**
2. Añadir al final:
```bash
# Reglas para acceso desde Ubuntu a red de sensores
iptables -I FORWARD -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT
iptables -I FORWARD -s 192.168.8.0/24 -d 192.168.50.0/24 -j ACCEPT
iptables -t nat -I POSTROUTING -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT
```
3. **Save & Apply**

### 2.3 Vía SSH

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa root@192.168.50.2

# Añadir reglas de firewall
cat >> /etc/firewall.user << 'EOF'

# Reglas para acceso desde Ubuntu a red de sensores
iptables -I FORWARD -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT
iptables -I FORWARD -s 192.168.8.0/24 -d 192.168.50.0/24 -j ACCEPT
iptables -t nat -I POSTROUTING -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT
EOF

# Aplicar cambios
/etc/init.d/firewall restart
```

---

## Paso 3: Verificación

### Desde Ubuntu:
```bash
# Verificar ruta
ip route get 192.168.8.210
# Debe mostrar: via 192.168.50.2 dev enx...

# Ping a dispositivos
ping -c 3 192.168.8.210   # Cámara
ping -c 3 192.168.8.1     # Router LAN

# Probar RTSP (si hay cámara)
ffprobe rtsp://admin:password@192.168.8.210:554/stream1
```

---

## Solución de Problemas

### Error: "No route to host"
```bash
# Verificar que la ruta existe
ip route show | grep 192.168.8

# Si no existe, añadirla
sudo ip route add 192.168.8.0/24 via 192.168.50.2 dev <INTERFAZ>
```

### Error: "Destination Port Unreachable"
- Las reglas FORWARD no están configuradas en el router
- Verificar en LuCI → Network → Firewall → Custom Rules

### Error: "Connection timed out"
- El dispositivo destino no está encendido
- Verificar IP del dispositivo
- Probar ping desde el router: `ssh root@192.168.50.2 "ping -c 2 192.168.8.210"`

### SSH al router falla con "no matching host key"
```bash
# Usar algoritmos legacy
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa root@192.168.50.2
```

---

## Script de Automatización

Ver el archivo `scripts/setup-sensor-network.sh` para configuración automática.

```bash
# Ejecutar con:
sudo ./scripts/setup-sensor-network.sh
```

---

## Variables de Entorno

Puedes personalizar la configuración en `.env`:

```bash
# Red de sensores
SENSOR_NETWORK=192.168.8.0/24
SENSOR_GATEWAY=192.168.50.2
USB_INTERFACE=enx00e04c36022a

# Credenciales del router
ROUTER_IP=192.168.50.2
ROUTER_USER=root
ROUTER_PASS=your_password
```

---

## Notas Adicionales

1. **Reinicio del router**: Las reglas en `/etc/firewall.user` se aplican automáticamente
2. **Reinicio de Ubuntu**: El script en `/etc/networkd-dispatcher/` añade la ruta automáticamente
3. **Nuevos dispositivos**: Cualquier dispositivo en `192.168.8.x` será accesible automáticamente
4. **Seguridad**: El tráfico interno no pasa por NAT, manteniendo las IPs originales

---

## Referencias

- [OpenWRT Firewall](https://openwrt.org/docs/guide-user/firewall/firewall_configuration)
- [GL.iNet Docs](https://docs.gl-inet.com/)
- [Ubuntu Networkd-dispatcher](https://manpages.ubuntu.com/manpages/focal/man8/networkd-dispatcher.8.html)
