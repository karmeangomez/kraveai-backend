import os
import random
import time
from pathlib import Path
from instagrapi import Client
from dotenv import load_dotenv
from instagrapi.exceptions import (
    LoginRequired, BadPassword, PleaseWaitFewMinutes,
    ChallengeRequired, FeedbackRequired, ClientError
)

# 1. Configuración de rutas y credenciales
ENV_PATH = Path("/home/karmean/kraveai-backend/.env")
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    print(f"✅ .env cargado desde {ENV_PATH}")
else:
    print(f"❌ ERROR CRÍTICO: .env no encontrado en {ENV_PATH}")
    raise SystemExit("Archivo .env no encontrado")

SESSION_FILE = Path("/home/karmean/kraveai-backend/sesiones/ig_session_kraveaibot.json")
PROXY_FILE = Path("/home/karmean/kraveai-backend/src/proxies/proxies.txt")

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")
if not USERNAME or not PASSWORD:
    print("❌ ERROR CRÍTICO: Credenciales faltantes en .env")
    raise SystemExit("Credenciales faltantes en .env")

# 2. Carga de proxies
def load_proxies():
    proxies = []
    if PROXY_FILE.exists():
        with open(PROXY_FILE, "r") as f:
            for i, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    if line.count(":") == 3:
                        host, port, user, pwd = line.split(":")
                        proxy_str = f"http://{user}:{pwd}@{host}:{port}"
                    elif "@" in line and ":" in line:
                        proxy_str = f"http://{line}"
                    elif line.count(":") == 1:
                        proxy_str = f"http://{line}"
                    else:
                        raise ValueError("Formato desconocido")
                    proxies.append(proxy_str)
                    print(f"🔌 Proxy #{i}: {line} → {proxy_str}")
                except Exception as e:
                    print(f"⚠️ Proxy inválido línea {i}: '{line}' – {e}")
    print(f"📊 Total proxies válidos: {len(proxies)}")
    return proxies

def get_random_proxy(proxies):
    return random.choice(proxies) if proxies else None

# 3. Login con reintentos inteligentes
def login_instagram(max_attempts=3):
    cl = Client()
    cl.delay_range = [3, 7]

    proxies = load_proxies()
    proxy = get_random_proxy(proxies)

    for attempt in range(1, max_attempts + 1):
        print(f"\n🔑 INTENTO #{attempt}/{max_attempts}")

        # Proxy
        proxy_used = "None"
        if proxy:
            try:
                cl.set_proxy(proxy)
                proxy_used = proxy.split('@')[-1] if '@' in proxy else proxy
                print(f"🌐 Proxy: {proxy_used}")
            except Exception as e:
                print(f"⚠️ Error proxy: {str(e)[:100]}… Sin proxy")
                cl.set_proxy(None)

        # Recuperar sesión
        if SESSION_FILE.exists():
            try:
                cl.load_settings(SESSION_FILE)
                user_info = cl.user_info(cl.user_id)
                print(f"✅ Sesión restaurada @{user_info.username}")
                return cl
            except Exception as e:
                print(f"⚠️ Sesión corrupta: {str(e)[:100]}…")
                SESSION_FILE.unlink(missing_ok=True)

        # Login nuevo
        try:
            print(f"🔓 Login nuevo como @{USERNAME}")
            if cl.login(USERNAME, PASSWORD):
                cl.dump_settings(SESSION_FILE)
                user_info = cl.user_info(cl.user_id)
                print(f"🎉 Login OK @{user_info.username}")
                return cl
            else:
                print("❌ Login sin excepción")
        except (BadPassword, ChallengeRequired) as e:
            print(f"🔒 ERROR CRÍTICO: {str(e)[:200]}")
            break
        except (PleaseWaitFewMinutes, FeedbackRequired, ClientError) as e:
            wait = 30 * attempt
            print(f"⏳ Límite de IG. Esperando {wait}s…")
            time.sleep(wait)
        except Exception as e:
            print(f"⚠️ Error inesperado: {type(e).__name__} – {str(e)[:200]}")

        # Rotar proxy
        if proxies:
            proxy = get_random_proxy(proxies)
            print("🔄 Rotando proxy…")

    print("❌ LOGIN FALLIDO")
    return None
