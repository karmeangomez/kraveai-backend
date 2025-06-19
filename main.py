# main.py - Backend principal KraveAI (Versión Corregida)
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

# Configuración específica para Raspberry Pi
MAX_CONCURRENT = 3  # Máximo seguro para Raspberry Pi

# Inicialización segura de cliente Instagram
cl = None
try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")

# Configuración CORS robusta
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    """Middleware para asegurar headers CORS en todas las respuestas"""
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@app.get("/health")
def health():
    return {
        "status": "OK",
        "versión": "v1.8 - estable",
        "service": "KraveAI Python",
        "login": "Activo" if cl and cl.user_id else "Fallido",
        "concurrent_max": MAX_CONCURRENT
    }

@app.get("/cuentas")
def obtener_cuentas():
    path = os.path.join(os.path.dirname(__file__), "cuentas_creadas.json")
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content=[])
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            cuentas = json.load(f)
            return JSONResponse(content=cuentas)
    except Exception as e:
        logger.error(f"Error leyendo cuentas_creadas.json: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Error leyendo archivo de cuentas"}
        )

@app.get("/test-telegram")
def test_telegram():
    try:
        notify_telegram("📲 Prueba de conexión con Telegram desde /test-telegram")
        return {"mensaje": "Telegram notificado correctamente"}
    except Exception as e:
        logger.error(f"Error en test-telegram: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Error enviando notificación a Telegram"}
        )

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    """Endpoint SSE optimizado con manejo de concurrencia"""
    async def event_stream():
        completed = 0
        success = 0
        errors = 0
        
        # Usamos ThreadPoolExecutor para control de concurrencia
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
            futures = [executor.submit(run_crear_cuenta) for _ in range(count)]
            
            for future in concurrent.futures.as_completed(futures):
                if await request.is_disconnected():
                    logger.info("Cliente desconectado, cancelando operaciones")
                    break
                
                try:
                    result = future.result()
                    if result.get("status") == "success":
                        yield f"event: account-created\ndata: {json.dumps(result)}\n\n"
                        success += 1
                    else:
                        error_msg = result.get("error", "Error desconocido")
                        yield f"event: error\ndata: {json.dumps({
                            'status': 'error',
                            'message': error_msg,
                            'proxy': result.get('proxy', 'N/A')
                        })}\n\n"
                        errors += 1
                except Exception as e:
                    error_msg = str(e)[:100]
                    yield f"event: error\ndata: {json.dumps({
                        'status': 'error',
                        'message': error_msg
                    })}\n\n"
                    errors += 1
                
                completed += 1
                # Actualización de progreso
                if completed % 2 == 0 or completed == count:
                    yield f"event: progress\ndata: {json.dumps({
                        'completed': completed,
                        'total': count,
                        'success': success,
                        'errors': errors
                    })}\n\n"
        
        yield "event: complete\ndata: Proceso terminado\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

def run_crear_cuenta():
    """Función para ejecutar crearCuentaInstagram.js con manejo de errores"""
    try:
        result = subprocess.run(
            ["node", "crearCuentaInstagram.js"],
            capture_output=True,
            text=True,
            timeout=180
        )
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            error = result.stderr or result.stdout or "Error desconocido"
            return {
                "status": "error",
                "error": error[:200],
                "proxy": "N/A"
            }
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "error": "Tiempo de ejecución excedido (180s)"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)[:200]
        }

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
        timeout_keep_alive=30,
        limit_concurrency=8,
        proxy_headers=True  # Importante para Cloudflare
    )
