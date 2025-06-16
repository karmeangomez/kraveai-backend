# main.py - Backend principal de KraveAI
import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from login_utils import iniciar_sesion
from instagram_utils import crear_cuenta_instagram
from telegram_utils import notify_telegram

load_dotenv()
app = FastAPI()

# CORS para Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kraveai.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cl = iniciar_sesion()

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
    return {"status": "inactivo"}

@app.post("/iniciar-sesion")
def iniciar_sesion_post(data: dict):
    from instagrapi import Client
    usuario = data.get("usuario")
    contrasena = data.get("contrasena")
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
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    try:
        user = cl.user_info_by_username(username)
        return {
            "username": user.username,
            "nombre": user.full_name,
            "foto": user.profile_pic_url_hd or user.profile_pic_url,
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
        for i in range(count):
            if await request.is_disconnected():
                break
            cuenta = crear_cuenta_instagram(cl)
            if cuenta and cuenta.get("usuario"):
                await notify_telegram(f"✅ Cuenta creada: @{cuenta['usuario']} ({cuenta['email']}) con {cuenta['proxy'] or 'sin proxy'}")
                yield f"event: account-created\ndata: {cuenta}\n\n"
            else:
                yield f"event: error\ndata: {{\"message\": \"Falló la cuenta {i+1}\"}}\n\n"
            await asyncio.sleep(1)
        yield f"event: complete\ndata: {{\"message\": \"Proceso completado\"}}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

class CrearCuentasRequest(BaseModel):
    cantidad: int

@app.post("/crear-cuentas-real")
def crear_cuentas_real(data: CrearCuentasRequest):
    try:
        import subprocess
        comando = f"node main.js {data.cantidad}"
        subprocess.Popen(comando, shell=True)
        return {"exito": True, "mensaje": f"🔁 Creación de {data.cantidad} cuentas iniciada"}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.get("/test-telegram")
async def test_telegram():
    try:
        await notify_telegram("🔔 Test de conexión con Telegram exitoso.")
        return {"exito": True}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

