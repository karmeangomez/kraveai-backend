# main.py - Backend principal KraveAI

import os
import json
import asyncio
import subprocess
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from nombre_utils import generar_usuario, generar_nombre

load_dotenv()
app = FastAPI()
cl = login_instagram()

# CORS
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
        notify_telegram(f"✅ Hola Karmean, sesión iniciada como @{usuario}")
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
        notify_telegram("👋 Hola Karmean, sesión cerrada correctamente.")
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
        for i in range(count):
            if await request.is_disconnected():
                break
            cuenta = crear_cuenta_instagram(cl)
            if cuenta and cuenta.get("usuario"):
                notify_telegram(f"✅ Hola Karmean, cuenta creada: @{cuenta['usuario']} con {cuenta['proxy'] or 'sin proxy'}")
                yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
            else:
                error = cuenta.get("error", "Desconocido")
                notify_telegram(f"⚠️ Karmean, error en cuenta {i+1}: {error}")
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
def test_telegram():
    notify_telegram("📣 Hola Karmean, esta es una notificación de prueba desde KraveAI 🚀")
    return {"mensaje": "Notificación enviada"}

@app.get("/cuentas")
def obtener_cuentas():
    try:
        path = "cuentas_creadas.json"
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as f:
            cuentas = json.load(f)
        return cuentas
    except Exception as e:
        return {"error": str(e)}

# ⬇️ Endpoints para controlar crear-cuentas.service desde frontend

@app.post("/servicio/crear-cuentas/start", response_class=PlainTextResponse)
def iniciar_creacion():
    try:
        subprocess.run(["sudo", "systemctl", "start", "crear-cuentas.service"], check=True)
        return "✅ Servicio de creación de cuentas INICIADO"
    except subprocess.CalledProcessError:
        return PlainTextResponse("❌ Error al iniciar el servicio", status_code=500)

@app.post("/servicio/crear-cuentas/stop", response_class=PlainTextResponse)
def detener_creacion():
    try:
        subprocess.run(["sudo", "systemctl", "stop", "crear-cuentas.service"], check=True)
        return "⏹️ Servicio de creación de cuentas DETENIDO"
    except subprocess.CalledProcessError:
        return PlainTextResponse("❌ Error al detener el servicio", status_code=500)

@app.get("/servicio/crear-cuentas/status", response_class=PlainTextResponse)
def estado_creacion():
    try:
        output = subprocess.check_output(["systemctl", "is-active", "crear-cuentas.service"]).decode().strip()
        return f"📊 Estado del servicio: {output}"
    except subprocess.CalledProcessError:
        return PlainTextResponse("❌ No se pudo obtener el estado", status_code=500)

@app.get("/servicio/crear-cuentas/logs", response_class=PlainTextResponse)
def logs_creacion():
    try:
        output = subprocess.check_output(["tail", "-n", "40", "logs/creacion.log"]).decode()
        return output
    except Exception as e:
        return PlainTextResponse(f"❌ Error al leer logs: {str(e)}", status_code=500)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
