#!/usr/bin/env python3
import argparse
import sys
import logging
from getpass import getpass
from login_utils import login_instagram, guardar_sesion

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("instagram_login_tool")

def main():
    print("🔐 Herramienta de Login Manual para Instagram", flush=True)
    print("--------------------------------------------", flush=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("username", nargs="?", help="Usuario de Instagram")
    parser.add_argument("password", nargs="?", help="Contraseña de Instagram")
    args = parser.parse_args()

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
    logger.info("💡 Verifica en la app móvil si debes aprobar el acceso.")
    sys.exit(1)

if __name__ == "__main__":
    main()
