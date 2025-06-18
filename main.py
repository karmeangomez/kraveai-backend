# main.py - Backend principal KraveAI - Versión Maximizada
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
from verification_utils import obtener_codigo_verificacion_hibrido  # Nuevo módulo

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

@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "version": "2.0-max",
        "raspberry_mode": RASPBERRY_MODE,
        "max_concurrent": MAX_CONCURRENT,
        "instagram": "active" if cl and cl.user_id else "inactive"
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
        raise HTTPException(status_code=404, detail=f"No se pudo encontrar el usuario: {str(e)}")

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1, concurrency: int = MAX_CONCURRENT):
    """Endpoint SSE con control de concurrencia optimizado para Raspberry Pi"""
    logger.info(f"Iniciando creación de {count} cuentas con concurrencia {concurrency}")
    
    # Limitar concurrencia en Raspberry Pi
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
                        # Notificación detallada
                        proxy_info = cuenta.get('proxy', 'sin proxy')
                        email_type = cuenta.get('email_type', 'desconocido')
                        notify_telegram(
                            f"✅ Cuenta creada: @{cuenta['usuario']}\n"
                            f"📧 Email: {cuenta['email']} ({email_type})\n"
                            f"🛡️ Proxy: {proxy_info}"
                        )
                        yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
                        success += 1
                    else:
                        error_msg = cuenta.get("error", "Error desconocido")
                        errors.append(error_msg)
                        notify_telegram(f"⚠️ Error cuenta: {error_msg}")
                        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
                except Exception as e:
                    error_msg = f"Excepción inesperada: {str(e)}"
                    errors.append(error_msg)
                    notify_telegram(f"⚠️ Error crítico: {error_msg}")
                    yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
                
                completed += 1
                # Actualización periódica de progreso
                if completed % 2 == 0 or completed == count:
                    yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': count})}\n\n"
            
            # Resumen final
            summary = {
                "solicitadas": count,
                "completadas": completed,
                "exitosas": success,
                "errores": errors
            }
            notify_telegram(
                f"📊 Resumen creación:\n"
                f"• Solicitadas: {count}\n"
                f"• Creadas: {success}\n"
                f"• Errores: {len(errors)}"
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

# ... (resto de endpoints se mantienen igual, pero con mejor manejo de errores)

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
        timeout_keep_alive=60,
        log_config=None,
        loop="asyncio"  # Mejor rendimiento en Pi
    )
