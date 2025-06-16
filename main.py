# main.py - Backend FastAPI KraveAI

import os
import json
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from nombre_utils import generar_nombre, generar_usuario
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from instagrapi import Client

load_dotenv()
app = FastAPI()

# CORS para permitir conexión desde Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

cl = Client()

# Restaurar sesión si hay cookies
try:
    if os.path.exists("ig_session.json"):
        cl.load_settings("ig_session.json")
        cl.get_timeline_feed()
        print("✅ Sesión restaurada desde cookies")
    else:
        print("❌ No hay sesión previa guardada")
except Exception as e:
    print("❌ Error al cargar sesión:", e)
    cl = None

@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "login": "Activo" if cl and cl.user_id else "Fallido"
    }

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return {"status": "activo", "usuario": cl.username}
    else:
        return {"status": "inactivo"}

@app.post("/iniciar-sesion")
def iniciar_sesion_post(datos: dict):
    usuario = datos.get("usuario")
    contrasena = datos.get("contrasena")
    if not usuario or not contrasena:
        return {"exito": False, "mensaje": "Faltan datos"}

    global cl
    nuevo = Client()
    try:
        nuevo.login(usuario, contrasena)
        cl = nuevo
        cl.dump_settings("ig_session.json")
        return {"exito": True, "usuario": usuario}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.get("/cerrar-sesion")
def cerrar_sesion():
    try:
        global cl
        cl.logout()
        cl = None
        if os.path.exists("ig_session.json"):
            os.remove("ig_session.json")
        return {"exito": True}
    except:
        return {"exito": False, "mensaje": "No se pudo cerrar la sesión"}

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    try:
        user = cl.user_info_by_username(username)
        return {
            "username": user.username,
            "nombre": user.full_name,
            "foto": user.profile_pic_url,
            "publicaciones": user.media_count,
            "seguidores": user.follower_count,
            "seguidos": user.following_count,
            "biografia": user.biography,
            "privado": user.is_private,
            "verificado": user.is_verified,
            "negocio": user.is_business
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(min(count, 5)):
            if await request.is_disconnected():
                break
            cuenta = crear_cuenta_instagram(cl)
            if cuenta and cuenta.get("usuario"):
                await notify_telegram(f"✅ Hola Karmean, cuenta creada: @{cuenta['usuario']} con {cuenta.get('proxy', 'sin proxy')}")
                yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
            else:
                yield f"event: error\ndata: {{\"message\": \"Falló la cuenta {i+1}\"}}\n\n"
            await asyncio.sleep(2)
        yield f"event: complete\ndata: {{\"message\": \"Proceso completado\"}}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/test-telegram")
async def test_telegram():
    try:
        await notify_telegram("📢 Hola Karmean, esta es una prueba de conexión desde `/test-telegram`.")
        return {"exito": True, "mensaje": "Notificación enviada"}
    except Exception as e:
        return {"exito": False, "error": str(e)}

@app.get("/cuentas")
def obtener_cuentas():
    try:
        if not os.path.exists("cuentas_creadas.json"):
            return []
        with open("cuentas_creadas.json", "r") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.
