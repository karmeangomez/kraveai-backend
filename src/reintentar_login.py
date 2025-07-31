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
    
    # Obtener credenciales
    if len(sys.argv) >= 3:
        username = sys.argv[1]
        password = sys.argv[2]
    else:
        username = input("👤 Usuario de Instagram: ").strip()
        password = getpass("🔑 Contraseña: ").strip()
    
    logger.info(f"🚀 Intentando login para @{username}...")
    
    cl = login_instagram(username, password)
    
    if cl:
        guardar_sesion(cl, username)
        logger.info(f"✅ ¡Login exitoso! Sesión guardada para @{username}")
    else:
        logger.error(f"❌ Login fallido para @{username}")
        logger.info("💡 Posibles soluciones:")
        logger.info("1. Verifica que hayas hecho clic en 'Fui yo' en la app móvil")
        logger.info("2. Espera 24 horas si Instagram ha bloqueado temporalmente la cuenta")
        logger.info("3. Prueba con otro proxy si usas varios")

if __name__ == "__main__":
    main()
