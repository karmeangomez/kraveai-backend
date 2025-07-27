# login_utils.py – KraveAI v3.4
import os
import json
from instagrapi import Client
from instagrapi.exceptions import LoginRequired

SESSIONS_DIR = "sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)

def session_path(usuario):
    return os.path.join(SESSIONS_DIR, f"ig_session_{usuario}.json")

def login_instagram(usuario, contrasena, proxy=None):
    cl = Client()
    if proxy:
        cl.set_proxy(proxy)
    cl.login(usuario, contrasena)
    guardar_sesion(cl, usuario)
    return cl

def guardar_sesion(cl: Client, usuario: str):
    cl.dump_settings(session_path(usuario))

def cargar_sesion_guardada(usuario: str):
    cl = Client()
    path = session_path(usuario)
    if os.path.exists(path):
        cl.load_settings(path)
        try:
            cl.get_timeline_feed()
            return cl
        except LoginRequired:
            # Reintento con login completo si expiró
            raise Exception(f"Sesión expirada para @{usuario}")
    raise Exception(f"No hay sesión guardada para @{usuario}")