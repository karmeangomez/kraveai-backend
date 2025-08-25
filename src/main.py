import os
import json
import requests
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv
from src.login_utils import (
    login_instagram,
    restaurar_sesion,
    guardar_sesion,
    guardar_cuenta_api,
    cerrar_sesion,
    cuentas_activas,
    cliente_por_usuario,
    buscar_usuario
)

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/estado-sesion")
def estado_sesion():
    cuentas = cuentas_activas()
    if not cuentas:
        return {"sesion_activa": False}
    return {"sesion_activa": True, "cuentas": cuentas}

@app.post("/iniciar-sesion")
async def iniciar_sesion(request: Request):
    datos = await request.json()
    username = datos.get("username")
    password = datos.get("password")
    if not username or not password:
        return {"error": "Faltan credenciales"}

    try:
        cl = login_instagram(username, password)
        if cl:
            guardar_sesion(cl, username)
            guardar_cuenta_api(username, password)
            return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

    return {"error": "Login fallido"}

@app.get("/cuentas-activas")
def obtener_cuentas():
    return {"cuentas": cuentas_activas()}

@app.post("/guardar-cuenta")
async def guardar_cuenta(request: Request):
    datos = await request.json()
    username = datos.get("username")
    password = datos.get("password")
    if not username or not password:
        return {"error": "Faltan datos"}
    guardar_cuenta_api(username, password)
    return {"status": "guardado"}

@app.post("/cerrar-sesion")
async def cerrar(request: Request):
    datos = await request.json()
    username = datos.get("username")
    if not username:
        return {"error": "Falta el username"}
    cerrar_sesion(username)
    return {"status": "sesión cerrada"}

@app.get("/buscar-usuario")
def buscar(username: str = Query(...)):
    try:
        resultado = buscar_usuario(username)
        return {"usuario": resultado}
    except Exception as e:
        return {"error": str(e)}

# ======================
# NUEVO ENDPOINT: Avatar
# ======================
@app.get("/avatar")
def avatar(username: str = Query(...)):
    """
    Devuelve la foto de perfil pública de Instagram como bytes (image/jpeg/png).
    - Intenta primero con el endpoint web de Instagram
    - Si falla, usa Unavatar
    - Si ambos fallan, responde 204
    """
    ig_api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "x-ig-app-id": "936619743392459",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.instagram.com/"
    }

    try:
        r = requests.get(ig_api, headers=headers, timeout=6)
        if r.status_code == 200:
            data = r.json()
            user = data.get("data", {}).get("user", {})
            pic = user.get("profile_pic_url_hd") or user.get("profile_pic_url")

            if pic:
                ir = requests.get(pic, headers=headers, timeout=8)
                if ir.status_code == 200 and ir.content:
                    ctype = ir.headers.get("Content-Type", "image/jpeg")
                    return Response(
                        content=ir.content,
                        media_type=ctype,
                        headers={"Cache-Control": "public, max-age=21600"}  # cache 6h
                    )
    except Exception:
        pass

    # Fallback: Unavatar
    try:
        ua = f"https://unavatar.io/instagram/{username}"
        ur = requests.get(ua, timeout=6)
        if ur.status_code == 200 and ur.content:
            ctype = ur.headers.get("Content-Type", "image/png")
            return Response(
                content=ur.content,
                media_type=ctype,
                headers={"Cache-Control": "public, max-age=21600"}
            )
    except Exception:
        pass

    return Response(status_code=204)