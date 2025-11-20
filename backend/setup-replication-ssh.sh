#!/bin/bash

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Configuración de SSH para Replicación ===${NC}"
echo "Este script te ayudará a generar claves SSH y copiarlas al servidor remoto."
echo ""

# 1. Verificar si ya existe una clave SSH
KEY_PATH="$HOME/.ssh/id_rsa"
if [ -f "$KEY_PATH" ]; then
    echo -e "${YELLOW}Ya existe una clave SSH en $KEY_PATH${NC}"
else
    echo "Generando nueva clave SSH..."
    ssh-keygen -t rsa -b 4096 -f "$KEY_PATH" -N ""
    echo -e "${GREEN}Clave generada correctamente.${NC}"
fi

echo ""
echo "Ahora necesitamos copiar la clave pública al servidor remoto."
echo "Por favor, introduce los datos del servidor remoto:"

read -p "Usuario remoto (ej: ubuntu): " REMOTE_USER
read -p "IP/Host remoto (ej: 192.168.1.50): " REMOTE_HOST

if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ]; then
    echo "Error: Usuario y Host son requeridos."
    exit 1
fi

echo ""
echo "Intentando copiar clave a $REMOTE_USER@$REMOTE_HOST..."
echo "Te pedirá la contraseña del usuario remoto una vez."

ssh-copy-id -i "$KEY_PATH.pub" "$REMOTE_USER@$REMOTE_HOST"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ¡Éxito! La clave se ha copiado.${NC}"
    echo "Ahora actualiza tu archivo .env con estos valores:"
    echo ""
    echo "REPLICATION_HOST=$REMOTE_HOST"
    echo "REPLICATION_USER=$REMOTE_USER"
    echo "REPLICATION_SSH_KEY=$KEY_PATH"
    echo ""
    echo "Puedes probar la conexión con: ssh -i $KEY_PATH $REMOTE_USER@$REMOTE_HOST"
else
    echo ""
    echo -e "${YELLOW}❌ Hubo un error copiando la clave.${NC}"
    echo "Asegúrate de que el servidor remoto es accesible y las credenciales son correctas."
fi
