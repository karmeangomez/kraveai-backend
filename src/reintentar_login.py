#!/usr/bin/env python3
import argparse
import sys
import logging
from getpass import getpass
from login_utils import login_instagram, guardar_sesion

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("instagram_login_tool")

def main():
    print("🔐 Herramienta de Login Manual para Instagram")
    print("--------------------------------------------")
    
    # Manejo de argumentos
    parser = argparse.ArgumentParser()
    parser.add_argument("username", nargs="?", help="Usuario de Instagram")
    parser.add_argument("password", nargs="?", help="Contraseña de Instagram")
    args = parser.parse_args()
    
    # Obtener credenciales
    username = args.username if args.username else input("👤 Usuario de Instagram: ").strip()
    password = args.password if args.password else getpass("🔑 Contraseña: ").strip()
    
    if not username or not password:
        logger.error("❌ Se requiere usuario y contraseña")
        sys.exit(1)
    
    logger.info(f"🚀 Intentando login para @{username}...")
    
    try:
        cl = login_instagram(username, password)
        if cl:
            guardar_sesion(cl, username)
            logger.info(f"✅ ¡Login exitoso! Sesión guardada para @{username}")
            sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Error crítico: {e}")
    
    logger.error(f"❌ Login fallido para @{username}")
    logger.info("💡 Soluciones posibles:")
    logger.info("1. Verifica que hayas hecho clic en 'Fui yo' en la app móvil")
    logger.info("2. Espera 24 horas si Instagram ha bloqueado temporalmente la cuenta")
    logger.info("3. Revisa el formato de los proxies en src/proxies/proxies.txt")
    sys.exit(1)

if __name__ == "__main__":
    main()
