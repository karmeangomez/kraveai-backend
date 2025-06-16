import os
import asyncio
import subprocess
from fastapi import FastAPI, Request, Query
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from dotenv import load_dotenv
from nombre_utils import generar_nombre, generar_usuario
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from login_utils import iniciar_sesion

# 📦 Cargar .env
load_dotenv()

# 🚀 Iniciar FastAPI
app = FastAPI()

# 🔐 Iniciar sesión en Instagram
cl = iniciar_sesion()

# ✅ Healthcheck
@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "login": "Activo" if cl else "Fallido"
    }

# 📡 SSE para crear cuentas desde frontend
@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(min(count, 5)):
            if await request.is_disconnected():
                break
            cuenta = crear_cuenta_instagram(cl)
            if cuenta and cuenta.get("exito"):
                await notify_telegram(f"✅ Cuenta creada: @{cuenta['usuario']} con {cuenta['proxy'] or 'sin proxy'}")
                yield f"event: account-created\ndata: {cuenta}\n\n"
            else:
                yield f"event: error\ndata: {{\"message\": \"Falló la cuenta {i+1}\"}}\n\n"
            await asyncio.sleep(2)
        yield f"event: complete\ndata: {{\"message\": \"Proceso completado\"}}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ▶️ Iniciar servicio crear-cuentas
@app.post("/servicio/crear-cuentas/start", response_class=PlainTextResponse)
def iniciar_creacion():
    try:
        subprocess.run(["sudo", "systemctl", "start", "crear-cuentas.service"], check=True)
        return "✅ Servicio de creación de cuentas INICIADO"
    except subprocess.CalledProcessError:
        return PlainTextResponse("❌ Error al iniciar el servicio", status_code=500)

# ⏹ Detener servicio
@app.post("/servicio/crear-cuentas/stop", response_class=PlainTextResponse)
def detener_creacion():
    try:
        subprocess.run(["sudo", "systemctl", "stop", "crear-cuentas.service"], check=True)
        return "⏹️ Servicio de creación de cuentas DETENIDO"
    except subprocess.CalledProcessError:
        return PlainTextResponse("❌ Error al detener el servicio", status_code=500)

# 📊 Estado del servicio
@app.get("/servicio/crear-cuentas/status", response_class=PlainTextResponse)
def estado_creacion():
    try:
        output = subprocess.check_output(["systemctl", "is-active", "crear-cuentas.service"]).decode().strip()
        return f"📊 Estado del servicio: {output}"
    except subprocess.CalledProcessError:
        return PlainTextResponse("❌ No se pudo obtener el estado", status_code=500)

# 📄 Últimos logs
@app.get("/servicio/crear-cuentas/logs", response_class=PlainTextResponse)
def logs_creacion():
    try:
        output = subprocess.check_output(["tail", "-n", "40", "logs/creacion.log"]).decode()
        return output
    except Exception as e:
        return PlainTextResponse(f"❌ Error al leer logs: {str(e)}", status_code=500)

# 🔐 Ver estado de sesión Instagram
@app.get("/estado-sesion", response_class=JSONResponse)
def estado_sesion():
    if cl:
        usuario = cl.username or os.getenv("IG_USERNAME")
        return {
            "status": "activo",
            "usuario": usuario
        }
    return {
        "status": "inactivo",
        "mensaje": "No se pudo iniciar sesión en Instagram"
    }

# 🔍 Buscar usuario por username
@app.get("/buscar-usuario", response_class=JSONResponse)
def buscar_usuario(username: str = Query(...)):
    try:
        user = cl.user_info_by_username(username)
        return {
            "username": user.username,
            "nombre": user.full_name,
            "seguidores": user.follower_count,
            "seguidos": user.following_count,
            "biografia": user.biography,
            "verificado": user.is_verified,
            "privado": user.is_private,
            "foto": user.profile_pic_url
        }
    except Exception as e:
        return JSONResponse(status_code=404, content={"error": f"No se pudo encontrar el usuario: {str(e)}"})

# 🧠 Iniciar servidor
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

