import os
import json
import time
import random
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, PleaseWaitFewMinutes, LoginRequired

SESSIONS_DIR = "sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)

def cargar_proxies():
    path = os.path.join("src", "proxies", "proxies.txt")
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return [line.strip() for line in f if line.strip()]

def configurar_proxy(cl, proxy_str):
    proxy = {}
    try:
        if "@" in proxy_str:
            ip_port, auth = proxy_str.split("@")
            ip, port = ip_port.split(":")
            user, pwd = auth.split(":")
        else:
            ip, port, user, pwd = proxy_str.split(":")
        proxy_url = f"http://{user}:{pwd}@{ip}:{port}"
        proxy = {
            "http": proxy_url,
            "https": proxy_url,
        }
        cl.set_proxy(proxy)
        return True
    except Exception as e:
        logging.warning(f"Proxy inválido: {proxy_str} -> {e}")
        return False

def guardar_sesion(cl, username):
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    cl.dump_settings(path)

def restaurar_sesion(username):
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    if not os.path.exists(path):
        return None

    cl = Client()
    cl.load_settings(path)
    try:
        cl.get_timeline_feed()
        return cl
    except LoginRequired:
        return None

def login_instagram(username, password):
    cl = Client()
    proxies = cargar_proxies()
    proxies.insert(0, None)  # primero sin proxy

    for proxy in proxies:
        if proxy:
            success = configurar_proxy(cl, proxy)
            if not success:
                continue
        try:
            cl.login(username, password)
            guardar_sesion(cl, username)
            return cl
        except ChallengeRequired:
            print("🔐 Desafío requerido, esperando aprobación...")
            for i in range(9):
                time.sleep(10)
                try:
                    cl.get_timeline_feed()
                    print("✅ Verificado manualmente")
                    guardar_sesion(cl, username)
                    return cl
                except ChallengeRequired:
                    print(f"⌛ Esperando verificación... {10*(i+1)}s")
        except PleaseWaitFewMinutes:
            print("⏳ Espera requerida por Instagram")
            time.sleep(random.randint(60, 90))
        except Exception as e:
            print(f"❌ Login fallido con proxy {proxy}: {e}")
    raise Exception("Fallaron todos los intentos")

def cuentas_activas():
    activas = []
    for file in os.listdir(SESSIONS_DIR):
        if file.startswith("ig_session_") and file.endswith(".json"):
            username = file.replace("ig_session_", "").replace(".json", "")
            cl = restaurar_sesion(username)
            if cl:
                activas.append(username)
    return activas
