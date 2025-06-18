# main.py - Backend KraveAI (Versión Optimizada para Raspberry Pi 5)
import os
import json
import asyncio
import subprocess
import logging
import concurrent.futures
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from verification_utils import obtener_codigo_verificacion_hibrido

# Configuración avanzada de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler("kraveai.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KraveAI-Backend")
logger.setLevel(logging.DEBUG if os.getenv("DEBUG") else logging.INFO)

load_dotenv()
app = FastAPI()

# Configuración específica para Raspberry Pi 5
RASPBERRY_MODE = True  # Siempre activo para Pi
MAX_CONCURRENT = 3     # Máximo seguro para Pi 5 con 4GB RAM

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

# ======= MÁXIMA OPTIMIZACIÓN ======= #
# Variables críticas para rendimiento
PROXY_ROTATION_ENABLED = True
MEMORY_OPTIMIZATION = True
# =================================== #

@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "version": "2.5-max",
        "raspberry_mode": RASPBERRY_MODE,
        "max_concurrent": MAX_CONCURRENT,
        "instagram": "active" if cl and cl.user_id else "inactive",
        "memory_optimized": MEMORY_OPTIMIZATION,
        "proxy_rotation": PROXY_ROTATION_ENABLED
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
        logger.error(f"Error inicio sesión: {str(e)}", exc_info=True)
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
        logger.error(f"Error cerrando sesión: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"exito": False, "mensaje": f"No se pudo cerrar sesión: {str(e)}"}
        )

@app.get("/buscar-usuario/{username}")
def buscar_usuario(username: str):
    try:
        if not cl or not cl.user_id:
            raise HTTPException(status_code=401, detail="Sesión de Instagram no activa")
        
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
        raise HTTPException(
            status_code=404,
            detail=f"No se pudo obtener información del usuario: {str(e)}"
        )

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1, concurrency: int = MAX_CONCURRENT):
    """Endpoint SSE con control de concurrencia optimizado para Raspberry Pi"""
    logger.info(f"🚀 Iniciando creación de {count} cuentas (Concurrencia: {concurrency})")
    
    # Limitar concurrencia automáticamente
    concurrency = min(concurrency, MAX_CONCURRENT)
    
    async def event_stream():
        completed = 0
        success = 0
        errors = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = {executor.submit(crear_cuenta_instagram): i for i in range(count)}
            
            for future in concurrent.futures.as_completed(futures):
                if await request.is_disconnected():
                    logger.info("Cliente desconectado, cancelando operaciones")
                    for f in futures:
                        f.cancel()
                    break
                
                try:
                    cuenta = future.result()
                    if cuenta and cuenta.get("usuario"):
                        # Notificación optimizada
                        proxy_info = cuenta.get('proxy', 'sin proxy')[:30] + "..."  # Acortar para Telegram
                        notify_telegram(
                            f"✅ Cuenta @{cuenta['usuario'][:15]} creada\n"
                            f"🛡️ Proxy: {proxy_info}"
                        )
                        yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
                        success += 1
                    else:
                        error_msg = cuenta.get("error", "Error desconocido")[:100]  # Limitar longitud
                        errors.append(error_msg)
                        notify_telegram(f"⚠️ Error cuenta: {error_msg}")
                        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
                except Exception as e:
                    error_msg = f"Excepción: {str(e)[:100]}"
                    errors.append(error_msg)
                    notify_telegram(f"⚠️ Error crítico: {error_msg}")
                    yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
                
                completed += 1
                # Actualización de progreso optimizada
                if completed % 2 == 0 or completed == count:
                    yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': count})}\n\n"
            
            # Resumen final ligero
            summary = {
                "solicitadas": count,
                "completadas": completed,
                "exitosas": success,
                "errores": len(errors)
            }
            notify_telegram(
                f"📊 Resumen: {success}/{count} cuentas creadas\n"
                f"💥 Errores: {len(errors)}"
            )
            yield f"event: summary\ndata: {json.dumps(summary)}\n\n"
            yield "event: complete\ndata: {\"message\": \"Proceso terminado\"}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Raspberry-Mode": "true"
        }
    )

class CrearCuentasRequest(BaseModel):
    cantidad: int
    concurrency: int = MAX_CONCURRENT  # Usa el máximo por defecto

@app.post("/crear-cuentas-real")
def crear_cuentas_real(body: CrearCuentasRequest):
    try:
        # Comando seguro para Raspberry Pi
        comando = [
            "node", 
            "main.js", 
            str(body.cantidad),
            str(min(body.concurrency, MAX_CONCURRENT))
        ]
        
        # Ejecutar en segundo plano
        process = subprocess.Popen(
            comando,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8'
        )
        
        # Guardar PID para monitoreo
        pid = process.pid
        logger.info(f"Proceso Node.js iniciado (PID: {pid}) para {body.cantidad} cuentas")
        
        return {
            "exito": True,
            "mensaje": f"Creación de {body.cantidad} cuentas iniciada",
            "pid": pid,
            "concurrency": min(body.concurrency, MAX_CONCURRENT)
        }
    except Exception as e:
        logger.error(f"Error iniciando proceso Node.js: {str(e)}", exc_info=True)
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
        logger.error(f"Error leyendo cuentas: {str(e)}", exc_info=True)
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
            text=True,
            encoding='utf-8'
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
            text=True,
            encoding='utf-8'
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
            text=True,
            encoding='utf-8'
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
            text=True,
            encoding='utf-8'
        )
        return result.stdout
    except Exception as e:
        logger.error(f"Error leyendo logs: {str(e)}")
        return PlainTextResponse(f"❌ Error al leer logs: {str(e)}", status_code=500)

# Nuevo endpoint para verificación de códigos
@app.get("/get-verification-code")
async def get_verification_code():
    """Endpoint para el sistema híbrido de verificación"""
    try:
        logger.info("Solicitando código de verificación...")
        result = obtener_codigo_verificacion_hibrido()
        if result and "code" in result:
            logger.info(f"Código obtenido con {result.get('service', 'desconocido')}")
            return result
        else:
            logger.warning("No se pudo obtener código de verificación")
            return {"error": "No se pudo obtener el código"}
    except Exception as e:
        logger.error(f"Error en verificación híbrida: {str(e)}", exc_info=True)
        return {"error": f"Error interno: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    
    # Configuración optimizada para Raspberry Pi
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
        timeout_keep_alive=30,  # Reducido para ahorro de memoria
        log_config=None,
        loop="asyncio",
        limit_concurrency=8,     # Evitar sobrecarga
        limit_max_requests=100   # Reinicio periódico para limpiar memoria
    )
