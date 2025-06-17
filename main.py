# main.py - Backend principal KraveAI (actualizado completo)

import os
import json
import asyncio
import subprocess
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from nombre_utils import generar_usuario, generar_nombre

load_dotenv()
app = FastAPI()
cl = login_instagram()

# Configurar CORS para frontend
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
async def crear_cuentas_sse(request: Request, count: int = 1, force_email_type: str = None):
    async def event_stream():
        created_count = 0
        stats = {"gmail": 0, "instaddr": 0, "errors": 0}

        for i in range(count):
            if await request.is_disconnected():
                break
            try:
                cuenta = crear_cuenta_instagram(force_email_type=force_email_type)

                if cuenta.get("success"):
                    email_type = cuenta.get("email_type", "unknown")
                    stats[email_type] += 1
                    notify_telegram(f"✅ Hola Karmean, cuenta creada: @{cuenta['username']} con {cuenta.get('proxy') or 'sin proxy'}")
                    yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
                    created_count += 1
                else:
                    stats["errors"] += 1
                    error_msg = cuenta.get("error", "Error desconocido")
                    notify_telegram(f"⚠️ Fallo cuenta {i+1}: {error_msg}")
                    yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
            except Exception as e:
                stats["errors"] += 1
                error_msg = f"Excepción inesperada: {str(e)}"
                notify_telegram(f"⚠️ Error crítico: {error_msg}")
                yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
            await asyncio.sleep(2)

        resumen = {
            "solicitadas": count,
            "creadas": created_count,
            "gmail": stats["gmail"],
            "instaddr": stats["instaddr"],
            "errores": stats["errors"]
        }
        notify_telegram(
            f"📊 Resumen creación:\n"
            f"• Total: {count}\n"
            f"• Creadas: {created_count}\n"
            f"• Gmail: {stats['gmail']}\n"
            f"• InstAddr: {stats['instaddr']}\n"
            f"• Errores: {stats['errors']}"
        )
        yield f"event: summary\ndata: {json.dumps(resumen)}\n\n"
        yield "event: complete\ndata: {\"message\": \"Proceso terminado\"}\n\n"

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

