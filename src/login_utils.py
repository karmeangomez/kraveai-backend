import os
import random
import json
import time
import logging
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired, ClientError
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig()
logger = logging.getLogger("instagrapi")
logger.setLevel(logging.INFO)

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 5
ESPERA_CHALLENGE_SEGUNDOS = 120  # Aumentado a 120 segundos

def obtener_proxies():
    if not os.path.exists(PROXY_FILE):
        return []
    with open(PROXY_FILE, "r") as f:
        return [line.strip() for line in f if line.strip()]

def configurar_cliente(cl):
    """Configura el cliente para simular un dispositivo móvil real"""
    settings = {
        "user_agent": "Instagram 269.0.0.18.75 Android (28/9.0; 480dpi; 1080x2260; HUAWEI; CLT-L29; HWCLT; kirin970; en_US; 367496856)",
        "device_settings": {
            "android_version": 28,
            "android_release": "9.0",
            "manufacturer": "Huawei",
            "model": "CLT-L29",
            "cpu": "kirin970"
        },
        "locale": "en_US",
        "timezone_offset": time.timezone // 3600,
        "country": "US",
        "country_code": 1
    }
    cl.set_settings(settings)
    return cl

def login_instagram(username, password):
    proxies = obtener_proxies()
    random.shuffle(proxies)
    intentos = 0

    for raw_proxy in proxies[:MAX_REINTENTOS]:  # Limitar a MAX_REINTENTOS
        intentos += 1
        cl = Client()
        configurar_cliente(cl)
        
        # Configuración de proxy mejorada
        try:
            if ":" in raw_proxy and "@" in raw_proxy:
                # Formato: usuario:contraseña@host:puerto
                creds, hostport = raw_proxy.split("@")
                user, password_proxy = creds.split(":")
                host, port = hostport.split(":")
                proxy_url = f"http://{user}:{password_proxy}@{host}:{port}"
            elif ":" in raw_proxy:
                # Formato: host:puerto
                host, port = raw_proxy.split(":")
                proxy_url = f"http://{host}:{port}"
            else:
                print(f"❌ Formato de proxy inválido: {raw_proxy}")
                continue
            
            cl.set_proxy(proxy_url)
            print(f"🔌 Intento {intentos} con proxy {host}:{port}")
        except Exception as e:
            print(f"❌ Error configurando proxy {raw_proxy}: {e}")
            continue

        try:
            # Intento de login con manejo de desafíos
            login_result = cl.login(username, password)
            
            if login_result:
                print(f"✅ Login exitoso para {username}")
                return cl
            else:
                print(f"❌ Login fallido para {username}")
                continue
                
        except ChallengeRequired as e:
            print(f"⚠️ Instagram requiere verificación manual para {username}")
            print(f"🔒 Por favor abre la app de Instagram en tu móvil y confirma que fuiste tú")
            print(f"⏳ Esperando {ESPERA_CHALLENGE_SEGUNDOS} segundos para que completes la verificación...")
            
            # Espera inteligente para la verificación
            verificacion_exitosa = False
            for i in range(ESPERA_CHALLENGE_SEGUNDOS // 10):
                time.sleep(10)
                try:
                    # Verificación silenciosa sin forzar login
                    cl.get_timeline_feed()
                    verificacion_exitosa = True
                    print(f"✅ Verificación manual completada para {username}")
                    break
                except (ChallengeRequired, ClientError):
                    print(f"⌛ Esperando confirmación... ({10*(i+1)}s)")
                except Exception as e:
                    print(f"⚠️ Error temporal: {str(e)}")
            
            if verificacion_exitosa:
                return cl
            else:
                print(f"❌ Tiempo agotado para la verificación de {username}")
                continue
                
        except ClientError as e:
            if "internal server error" in str(e).lower():
                print(f"🌐 Error interno de Instagram (probable bloqueo temporal). Esperando 60 segundos...")
                time.sleep(60)
                continue
            else:
                print(f"❌ Error de cliente: {e}")
                continue
                
        except Exception as e:
            print(f"❌ Error inesperado con proxy {raw_proxy}: {e}")
            continue

    print(f"❌ Fallaron todos los intentos para {username}")
    return None

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.json"
    try:
        settings = cl.get_settings()
        with open(path, "w") as f:
            json.dump(settings, f)
        print(f"💾 Sesión guardada para {username}")
    except Exception as e:
        print(f"⚠️ Error guardando sesión: {e}")

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    configurar_cliente(cl)
    
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                settings = json.load(f)
                cl.set_settings(settings)
            
            # Verificación de sesión con método seguro
            try:
                cl.account_info()
                print(f"🔑 Sesión restaurada para {username}")
                return cl
            except (LoginRequired, ChallengeRequired):
                print(f"⚠️ Sesión expirada. Intentando relogin...")
                return login_instagram(username, password)
        except Exception as e:
            print(f"⚠️ Error restaurando sesión: {e}")
    
    # Si no hay sesión guardada o falló la restauración
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        # Método ligero para verificar sesión
        cl.get_timeline_feed()
        return True
    except (LoginRequired, ChallengeRequired):
        return False
    except Exception as e:
        print(f"⚠️ Error verificando sesión: {e}")
        return False
