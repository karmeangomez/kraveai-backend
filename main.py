# main.py - Backend principal KraveAI (Versión Maximizada)
import os
import json
import asyncio
import subprocess
import logging
import concurrent.futures
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler("kraveai.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KraveAI-Backend")

load_dotenv()
app = FastAPI()

# Configuración específica para Raspberry Pi
MAX_CONCURRENT = 3  # Máximo seguro para Raspberry Pi

# Inicialización segura de cliente Instagram
try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")
    cl = None

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
        "login": "Activo" if cl and cl.user_id else "Fallido",
        "concurrent_max": MAX_CONCURRENT
    }

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return {"status": "activo", "usuario": cl.username}
    return {"status": "inactivo", "detalle": "Sesión no iniciada o expirada"}

class LoginRequest(BaseModel):
    usuario: str
    contrasena: str

@app.post("/iniciar-sesion")
def iniciar_sesion_post(datos: LoginRequest):
    from instagrapi import Client
    global cl
    
    try:
        nuevo = Client()
        nuevo.login(datos.usuario, datos.contrasena)
        cl = nuevo
        cl.dump_settings("ig_session.json")
        notify_telegram(f"✅ Sesión iniciada como @{datos.usuario}")
        logger.info(f"Sesión Instagram iniciada: @{datos.usuario}")
        return {"exito": True, "usuario": datos.usuario}
    except Exception as e:
        logger.error(f"Error inicio sesión: {str(e)}")
        return JSONResponse(
            status_code=401,
            content={"exito": False, "mensaje": f"Error de autenticación: {str(e)}"}
        )

@app.get("/cerrar-sesion")
def cerrar_sesion():
    try:
        global cl
        if cl:
            cl.logout()
            cl = None
        if os.path.exists("ig_session.json"):
            os.remove("ig_session.json")
        notify_telegram("👋 Sesión cerrada correctamente")
        logger.info("Sesión Instagram cerrada")
        return {"exito": True}
    except Exception as e:
        logger.error(f"Error cerrando sesión: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"exito": False, "mensaje": f"No se pudo cerrar sesión: {str(e)}"}
        )

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    try:
        if not cl or not cl.user_id:
            return JSONResponse(
                status_code=401,
                content={"error": "Sesión de Instagram no activa"}
            )
        
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
        logger.error(f"Error buscando usuario @{username}: {str(e)}")
        return JSONResponse(
            status_code=404,
            content={"error": f"No se pudo obtener información del usuario: {str(e)}"}
        )

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    """Endpoint SSE optimizado para Raspberry Pi"""
    async def event_stream():
        completed = 0
        success = 0
        
        # Usamos ThreadPoolExecutor para control de concurrencia
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
            futures = [executor.submit(crear_cuenta_instagram) for _ in range(count)]
            
            for future in concurrent.futures.as_completed(futures):
                if await request.is_disconnected():
                    logger.info("Cliente desconectado, cancelando operaciones")
                    break
                
                try:
                    cuenta = future.result()
                    if cuenta and cuenta.get("usuario"):
                        # Notificación optimizada
                        proxy_info = cuenta.get('proxy', 'sin proxy')[:30] + "..."
                        notify_telegram(
                            f"✅ Cuenta @{cuenta['usuario'][:15]} creada\n"
                            f"🛡️ Proxy: {proxy_info}"
                        )
                        yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
                        success += 1
                    else:
                        error_msg = cuenta.get("error", "Error desconocido")[:100]
                        notify_telegram(f"⚠️ Error cuenta: {error_msg}")
                        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
                except Exception as e:
                    error_msg = f"Excepción: {str(e)[:100]}"
                    notify_telegram(f"⚠️ Error crítico: {error_msg}")
                    yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
                
                completed += 1
                # Actualización de progreso
                if completed % 2 == 0 or completed == count:
                    yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': count})}\n\n"
            
            # Resumen final
            yield f"event: summary\ndata: {json.dumps({'solicitadas': count, 'completadas': completed, 'exitosas': success})}\n\n"
            yield "event: complete\ndata: {\"message\": \"Proceso terminado\"}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

class CrearCuentasRequest(BaseModel):
    cantidad: int

@app.post("/crear-cuentas-real")
def crear_cuentas_real(body: CrearCuentasRequest):
    try:
        # Comando más seguro usando lista
        comando = [
            "node", 
            "main.js", 
            str(body.cantidad),
            str(MAX_CONCURRENT)  # Pasar concurrencia máxima
        ]
        
        # Ejecutar en segundo plano
        process = subprocess.Popen(
            comando,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        return {
            "exito": True,
            "mensaje": f"🔁 Creación de {body.cantidad} cuentas iniciada",
            "pid": process.pid
        }
    except Exception as e:
        logger.error(f"Error iniciando proceso Node.js: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"exito": False, "mensaje": f"Error iniciando proceso: {str(e)}"}
        )

@app.get("/test-telegram")
def test_telegram():
    try:
        notify_telegram("📣 Notificación de prueba desde KraveAI 🚀")
        return {"mensaje": "Notificación enviada"}
    except Exception as e:
        logger.error(f"Error enviando test Telegram: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Error enviando notificación: {str(e)}"}
        )

@app.get("/cuentas")
def obtener_cuentas():
    try:
        path = "cuentas_creadas.json"
        if not os.path.exists(path):
            return JSONResponse(status_code=404, content=[])
        
        with open(path, "r", encoding="utf-8") as f:
            cuentas = json.load(f)
        
        return cuentas
    except Exception as e:
        logger.error(f"Error leyendo cuentas: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Error leyendo archivo de cuentas: {str(e)}"}
        )

# Endpoints para control de servicio
@app.post("/servicio/crear-cuentas/start", response_class=PlainTextResponse)
def iniciar_creacion():
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "start", "crear-cuentas.service"],
            check=True,
            capture_output=True,
            text=True
        )
        logger.info("Servicio crear-cuentas iniciado")
        return "✅ Servicio de creación de cuentas INICIADO"
    except subprocess.CalledProcessError as e:
        logger.error(f"Error iniciando servicio: {e.stderr}")
        return PlainTextResponse(f"❌ Error al iniciar el servicio: {e.stderr}", status_code=500)

@app.post("/servicio/crear-cuentas/stop", response_class=PlainTextResponse)
def detener_creacion():
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "stop", "crear-cuentas.service"],
            check=True,
            capture_output=True,
            text=True
        )
        logger.info("Servicio crear-cuentas detenido")
        return "⏹️ Servicio de creación de cuentas DETENIDO"
    except subprocess.CalledProcessError as e:
        logger.error(f"Error deteniendo servicio: {e.stderr}")
        return PlainTextResponse(f"❌ Error al detener el servicio: {e.stderr}", status_code=500)

@app.get("/servicio/crear-cuentas/status", response_class=PlainTextResponse)
def estado_creacion():
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "crear-cuentas.service"],
            capture_output=True,
            text=True
        )
        status = result.stdout.strip()
        logger.info(f"Estado del servicio: {status}")
        return f"📊 Estado del servicio: {status}"
    except Exception as e:
        logger.error(f"Error obteniendo estado: {str(e)}")
        return PlainTextResponse(f"❌ No se pudo obtener el estado: {str(e)}", status_code=500)

@app.get("/servicio/crear-cuentas/logs", response_class=PlainTextResponse)
def logs_creacion():
    try:
        result = subprocess.run(
            ["journalctl", "-u", "crear-cuentas.service", "-n", "40", "--no-pager"],
            capture_output=True,
            text=True
        )
        return result.stdout
    except Exception as e:
        logger.error(f"Error leyendo logs: {str(e)}")
        return PlainTextResponse(f"❌ Error al leer logs: {str(e)}", status_code=500)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    
    # Configuración optimizada para Raspberry Pi
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,  # Para Raspberry Pi
        timeout_keep_alive=30,
        limit_concurrency=8
    )
