import os
import json
from instagrapi import Client
from instagrapi.exceptions import LoginRequired
from dotenv import load_dotenv

load_dotenv()

SESSION_DIR = "sessions"
PROXY_FILE = "src/proxies/proxies.txt"

def get_proxy(usuario: str) -> str:
    if not os.path.exists(PROXY_FILE):
        return None
    with open(PROXY_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]
    return proxies[hash(usuario) % len(proxies)] if proxies else None

def login_instagram(usuario: str, contraseña: str) -> Client:
    cl = Client()
    proxy = get_proxy(usuario)
    if proxy:
        cl.set_proxy(proxy)
    cl.load_settings({})  # Resetea configuración previa
    try:
        cl.login(usuario, contraseña)
        guardar_sesion(cl, usuario)
        return cl
    except Exception as e:
        print(f"❌ Error login {usuario}: {str(e)}")
        return None

def guardar_sesion(cliente: Client, usuario: str):
    if not os.path.exists(SESSION_DIR):
        os.makedirs(SESSION_DIR)
    cliente.dump_settings(f"{SESSION_DIR}/ig_session_{usuario}.json")

def restaurar_sesion(usuario: str) -> Client:
    ruta = f"{SESSION_DIR}/ig_session_{usuario}.json"
    if not os.path.exists(ruta):
        return None
    cl = Client()
    proxy = get_proxy(usuario)
    if proxy:
        cl.set_proxy(proxy)
    try:
        cl.load_settings(ruta)
        cl.login(usuario, os.getenv("INSTAGRAM_PASS"))
        return cl
    except LoginRequired:
        return None
