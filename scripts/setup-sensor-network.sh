#!/bin/bash
#===============================================================================
# Script: setup-sensor-network.sh
# Descripción: Configura la red para acceder a sensores detrás de un router GL.iNet
# Autor: Galgo School Manager AI
# Fecha: Enero 2026
#===============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración por defecto (puede sobreescribirse con variables de entorno)
SENSOR_NETWORK="${SENSOR_NETWORK:-192.168.8.0/24}"
SENSOR_GATEWAY="${SENSOR_GATEWAY:-192.168.50.2}"
USB_NETWORK="${USB_NETWORK:-192.168.50.0/24}"
USB_IP="${USB_IP:-192.168.50.1}"
ROUTER_IP="${ROUTER_IP:-192.168.50.2}"
ROUTER_USER="${ROUTER_USER:-root}"

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que se ejecuta como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
}

# Detectar la interfaz USB Ethernet
detect_usb_interface() {
    log_info "Detectando interfaz USB Ethernet..."
    
    # Buscar interfaces que empiecen con 'enx' (USB Ethernet)
    USB_INTERFACE=$(ip -o link show | grep -E 'enx|usb' | awk -F': ' '{print $2}' | head -1)
    
    if [[ -z "$USB_INTERFACE" ]]; then
        # Buscar por IP
        USB_INTERFACE=$(ip -o addr show | grep "$USB_IP" | awk '{print $2}')
    fi
    
    if [[ -z "$USB_INTERFACE" ]]; then
        log_error "No se encontró interfaz USB Ethernet con IP $USB_IP"
        echo "Interfaces disponibles:"
        ip -o addr show | grep -v "lo:" | awk '{print "  " $2 " - " $4}'
        read -p "Introduce el nombre de la interfaz USB: " USB_INTERFACE
    fi
    
    log_success "Interfaz USB detectada: $USB_INTERFACE"
}

# Verificar IP forwarding
check_ip_forwarding() {
    log_info "Verificando IP forwarding..."
    
    if [[ $(cat /proc/sys/net/ipv4/ip_forward) -eq 1 ]]; then
        log_success "IP forwarding está habilitado"
    else
        log_warning "IP forwarding está deshabilitado. Habilitando..."
        sysctl -w net.ipv4.ip_forward=1
        
        # Hacer permanente
        if ! grep -q "net.ipv4.ip_forward = 1" /etc/sysctl.conf; then
            echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
        fi
        log_success "IP forwarding habilitado"
    fi
}

# Añadir ruta estática temporal
add_route_temporary() {
    log_info "Añadiendo ruta hacia $SENSOR_NETWORK via $SENSOR_GATEWAY..."
    
    # Verificar si la ruta ya existe
    if ip route show | grep -q "$SENSOR_NETWORK"; then
        log_warning "La ruta ya existe"
        ip route show | grep "$SENSOR_NETWORK"
    else
        ip route add $SENSOR_NETWORK via $SENSOR_GATEWAY dev $USB_INTERFACE
        log_success "Ruta añadida correctamente"
    fi
}

# Hacer la ruta persistente
add_route_persistent() {
    log_info "Configurando ruta persistente..."
    
    SCRIPT_PATH="/etc/networkd-dispatcher/routable.d/50-sensor-route"
    
    # Crear directorio si no existe
    mkdir -p /etc/networkd-dispatcher/routable.d/
    
    # Crear script
    cat > "$SCRIPT_PATH" << EOF
#!/bin/bash
# Ruta hacia la red de sensores via GL.iNet
# Generado automáticamente por setup-sensor-network.sh
ip route add $SENSOR_NETWORK via $SENSOR_GATEWAY dev $USB_INTERFACE 2>/dev/null || true
EOF
    
    chmod +x "$SCRIPT_PATH"
    log_success "Script persistente creado en $SCRIPT_PATH"
}

# Configurar el router GL.iNet vía SSH
configure_router() {
    log_info "¿Deseas configurar el router GL.iNet automáticamente? (s/n)"
    read -p "> " CONFIGURE_ROUTER
    
    if [[ "$CONFIGURE_ROUTER" != "s" && "$CONFIGURE_ROUTER" != "S" ]]; then
        log_info "Saltando configuración del router"
        echo ""
        log_warning "Recuerda configurar manualmente en el router:"
        echo "  1. Accede a http://$ROUTER_IP (LuCI)"
        echo "  2. Network → Firewall → Custom Rules"
        echo "  3. Añade estas reglas:"
        echo ""
        echo "  iptables -I FORWARD -s $USB_NETWORK -d $SENSOR_NETWORK -j ACCEPT"
        echo "  iptables -I FORWARD -s $SENSOR_NETWORK -d $USB_NETWORK -j ACCEPT"
        echo "  iptables -t nat -I POSTROUTING -s $USB_NETWORK -d $SENSOR_NETWORK -j ACCEPT"
        echo ""
        return
    fi
    
    log_info "Conectando al router $ROUTER_IP..."
    
    # Crear script temporal para ejecutar en el router
    ROUTER_COMMANDS=$(cat << 'ROUTEREOF'
# Verificar si las reglas ya existen
if ! iptables -C FORWARD -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT 2>/dev/null; then
    echo "Añadiendo reglas de FORWARD..."
    iptables -I FORWARD -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT
    iptables -I FORWARD -s 192.168.8.0/24 -d 192.168.50.0/24 -j ACCEPT
fi

if ! iptables -t nat -C POSTROUTING -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT 2>/dev/null; then
    echo "Añadiendo regla NAT bypass..."
    iptables -t nat -I POSTROUTING -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT
fi

# Hacer persistente
if ! grep -q "Reglas para acceso desde Ubuntu" /etc/firewall.user 2>/dev/null; then
    echo "" >> /etc/firewall.user
    echo "# Reglas para acceso desde Ubuntu a red de sensores" >> /etc/firewall.user
    echo "iptables -I FORWARD -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT" >> /etc/firewall.user
    echo "iptables -I FORWARD -s 192.168.8.0/24 -d 192.168.50.0/24 -j ACCEPT" >> /etc/firewall.user
    echo "iptables -t nat -I POSTROUTING -s 192.168.50.0/24 -d 192.168.8.0/24 -j ACCEPT" >> /etc/firewall.user
    echo "Reglas guardadas en /etc/firewall.user"
fi

echo "Configuración del router completada"
ROUTEREOF
)
    
    # Ejecutar en el router
    ssh -o StrictHostKeyChecking=no \
        -o HostKeyAlgorithms=+ssh-rsa \
        -o PubkeyAcceptedKeyTypes=+ssh-rsa \
        -o ConnectTimeout=10 \
        ${ROUTER_USER}@${ROUTER_IP} "$ROUTER_COMMANDS"
    
    if [[ $? -eq 0 ]]; then
        log_success "Router configurado correctamente"
    else
        log_error "Error al configurar el router. Configura manualmente."
    fi
}

# Verificar conectividad
verify_connectivity() {
    log_info "Verificando conectividad..."
    
    echo ""
    echo "Ruta configurada:"
    ip route get $(echo $SENSOR_NETWORK | cut -d'/' -f1 | sed 's/0$/1/')
    
    echo ""
    log_info "Probando ping al gateway del router ($ROUTER_IP)..."
    if ping -c 2 -W 2 $ROUTER_IP > /dev/null 2>&1; then
        log_success "Gateway del router accesible"
    else
        log_error "No se puede alcanzar el gateway"
    fi
    
    echo ""
    log_info "Probando ping a la red de sensores (192.168.8.1)..."
    if ping -c 2 -W 2 192.168.8.1 > /dev/null 2>&1; then
        log_success "Red de sensores accesible"
    else
        log_warning "No se puede alcanzar 192.168.8.1 (puede que no esté configurado el router)"
    fi
}

# Mostrar resumen
show_summary() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}CONFIGURACIÓN COMPLETADA${NC}"
    echo "=============================================="
    echo ""
    echo "Resumen de configuración:"
    echo "  - Interfaz USB:      $USB_INTERFACE"
    echo "  - IP Ubuntu:         $USB_IP"
    echo "  - Router Gateway:    $SENSOR_GATEWAY"
    echo "  - Red de sensores:   $SENSOR_NETWORK"
    echo ""
    echo "Archivos creados:"
    echo "  - /etc/networkd-dispatcher/routable.d/50-sensor-route"
    echo ""
    echo "Para probar un dispositivo específico:"
    echo "  ping 192.168.8.210"
    echo ""
    echo "Para probar stream RTSP:"
    echo "  ffprobe rtsp://admin:password@192.168.8.210:554/stream1"
    echo ""
}

# Menú de ayuda
show_help() {
    echo "Uso: $0 [OPCIÓN]"
    echo ""
    echo "Opciones:"
    echo "  --install     Instalación completa (Ubuntu + Router)"
    echo "  --ubuntu      Solo configurar Ubuntu"
    echo "  --router      Solo configurar Router GL.iNet"
    echo "  --verify      Verificar conectividad"
    echo "  --remove      Eliminar configuración"
    echo "  --help        Mostrar esta ayuda"
    echo ""
    echo "Variables de entorno:"
    echo "  SENSOR_NETWORK   Red de sensores (default: 192.168.8.0/24)"
    echo "  SENSOR_GATEWAY   IP del router (default: 192.168.50.2)"
    echo "  USB_INTERFACE    Interfaz USB (auto-detectada)"
    echo "  ROUTER_USER      Usuario SSH del router (default: root)"
    echo ""
}

# Eliminar configuración
remove_configuration() {
    log_info "Eliminando configuración..."
    
    # Eliminar ruta
    ip route del $SENSOR_NETWORK via $SENSOR_GATEWAY 2>/dev/null || true
    log_success "Ruta eliminada"
    
    # Eliminar script
    rm -f /etc/networkd-dispatcher/routable.d/50-sensor-route
    log_success "Script persistente eliminado"
    
    log_warning "Las reglas del router deben eliminarse manualmente"
}

#===============================================================================
# MAIN
#===============================================================================

case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --install)
        check_root
        echo "=============================================="
        echo "  Configuración de Red para Sensores"
        echo "=============================================="
        echo ""
        detect_usb_interface
        check_ip_forwarding
        add_route_temporary
        add_route_persistent
        configure_router
        verify_connectivity
        show_summary
        ;;
    --ubuntu)
        check_root
        detect_usb_interface
        check_ip_forwarding
        add_route_temporary
        add_route_persistent
        verify_connectivity
        ;;
    --router)
        detect_usb_interface
        configure_router
        ;;
    --verify)
        detect_usb_interface
        verify_connectivity
        ;;
    --remove)
        check_root
        remove_configuration
        ;;
    *)
        # Instalación interactiva por defecto
        check_root
        echo "=============================================="
        echo "  Configuración de Red para Sensores"
        echo "  Galgo School Manager"
        echo "=============================================="
        echo ""
        detect_usb_interface
        check_ip_forwarding
        add_route_temporary
        add_route_persistent
        configure_router
        verify_connectivity
        show_summary
        ;;
esac

exit 0
