#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# SCRIPT DE CONFIGURACIÓN DE RCLONE PARA TRUENAS
# ═══════════════════════════════════════════════════════════════════════════════
#
# Este script configura rclone para conectar con un servidor TrueNAS via SFTP.
#
# USO:
#   ./setup-rclone-truenas.sh
#
# REQUISITOS:
#   - rclone instalado (sudo apt install rclone)
#   - Acceso SSH al servidor TrueNAS
#   - Usuario con permisos de escritura en el directorio de destino
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Configuración de Rclone para Backup a TrueNAS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar que rclone está instalado
if ! command -v rclone &> /dev/null; then
    echo -e "${YELLOW}⚠️  rclone no está instalado. Instalando...${NC}"
    sudo apt update && sudo apt install -y rclone
fi

echo -e "${GREEN}✓ rclone está instalado${NC}"
echo ""

# Solicitar datos del servidor
echo -e "${YELLOW}Por favor, introduce los datos del servidor TrueNAS:${NC}"
echo ""

read -p "Host (IP o hostname): " TRUENAS_HOST
read -p "Puerto SSH [22]: " TRUENAS_PORT
TRUENAS_PORT=${TRUENAS_PORT:-22}

read -p "Usuario: " TRUENAS_USER
read -s -p "Contraseña: " TRUENAS_PASS
echo ""

read -p "Ruta remota (ej: /mnt/pool/videos): " TRUENAS_PATH

read -p "Nombre del remote en rclone [truenas]: " REMOTE_NAME
REMOTE_NAME=${REMOTE_NAME:-truenas}

echo ""
echo -e "${BLUE}Configurando rclone...${NC}"

# Verificar si el remote ya existe
if rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
    echo -e "${YELLOW}⚠️  El remote '${REMOTE_NAME}' ya existe.${NC}"
    read -p "¿Deseas sobrescribirlo? (s/N): " OVERWRITE
    if [[ "$OVERWRITE" != "s" && "$OVERWRITE" != "S" ]]; then
        echo -e "${RED}Cancelado.${NC}"
        exit 1
    fi
    rclone config delete "$REMOTE_NAME"
fi

# Obscurecer contraseña
OBSCURED_PASS=$(rclone obscure "$TRUENAS_PASS")

# Crear configuración
rclone config create "$REMOTE_NAME" sftp \
    host="$TRUENAS_HOST" \
    port="$TRUENAS_PORT" \
    user="$TRUENAS_USER" \
    pass="$OBSCURED_PASS"

echo ""
echo -e "${GREEN}✓ Remote '${REMOTE_NAME}' configurado correctamente${NC}"
echo ""

# Probar conexión
echo -e "${BLUE}Probando conexión...${NC}"
if rclone lsd "${REMOTE_NAME}:${TRUENAS_PATH}" 2>/dev/null; then
    echo -e "${GREEN}✓ Conexión exitosa a ${TRUENAS_HOST}:${TRUENAS_PATH}${NC}"
else
    echo -e "${YELLOW}⚠️  No se pudo listar el directorio ${TRUENAS_PATH}${NC}"
    echo -e "${YELLOW}   Verifica que el directorio existe y tienes permisos.${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ¡Configuración completada!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Ahora actualiza tu archivo .env con estos valores:"
echo ""
echo -e "  ${YELLOW}REPLICATION_ENABLED=true${NC}"
echo -e "  ${YELLOW}REPLICATION_HOST=${TRUENAS_HOST}${NC}"
echo -e "  ${YELLOW}REPLICATION_PORT=${TRUENAS_PORT}${NC}"
echo -e "  ${YELLOW}REPLICATION_USER=${TRUENAS_USER}${NC}"
echo -e "  ${YELLOW}REPLICATION_PASSWORD=${TRUENAS_PASS}${NC}"
echo -e "  ${YELLOW}REPLICATION_PATH=${TRUENAS_PATH}${NC}"
echo -e "  ${YELLOW}REPLICATION_ENGINE=rclone${NC}"
echo -e "  ${YELLOW}REPLICATION_RCLONE_REMOTE=${REMOTE_NAME}${NC}"
echo -e "  ${YELLOW}REPLICATION_USE_MOCK=false${NC}"
echo ""
echo "Comandos útiles:"
echo "  rclone lsd ${REMOTE_NAME}:${TRUENAS_PATH}     # Listar directorios"
echo "  rclone ls ${REMOTE_NAME}:${TRUENAS_PATH}      # Listar archivos"
echo "  rclone copy ./test.txt ${REMOTE_NAME}:${TRUENAS_PATH}   # Copiar archivo"
echo ""
