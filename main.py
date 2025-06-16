# main.py - Backend principal KraveAI

import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from nombre_utils import generar_usuario, generar_nombre
import subprocess

load_dotenv()

app = FastAPI()
cl = login_instagram()

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    from instagrapi import Client
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
            "negocio": user.is_business,
            "tick_azul": user.is_verified
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(count):
            if await request.is_disconnected():
                break
            cuenta = crear_cuenta_instagram(cl)
            if cuenta and cuenta.get("usuario"):
                await notify_telegram(f"✅ Hola Karmean, cuenta creada: @{cuenta['usuario']} con {cuenta['proxy'] or 'sin proxy'}")
                yield f"event: account-created\ndata: {cuenta}\n\n"
            else:
                yield f"event: error\ndata: {{\"message\": \"Falló la cuenta {i+1}\"}}\n\n"
            await asyncio.sleep(2)
        yield f"event: complete\ndata: {{\"message\": \"Proceso completado\"}}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

class CrearCuentasRequest(BaseModel):
    cantidad: int

@app.post("/crear-cuentas-real")
def crear_cuentas_real(body: CrearCuentasRequest):
    try:
        comando = f"node main.js {body.cantidad}"
        subprocess.Popen(comando, shell=True)
        return {"exito": True, "mensaje": f"🔁 Creación de {body.cantidad} cuentas iniciada"}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.get("/test-telegram")
async def test_telegram():
    await notify_telegram("📣 Hola Karmean, esta es una notificación de prueba desde KraveAI 🚀")
    return {"mensaje": "Notificación enviada a Telegram"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
