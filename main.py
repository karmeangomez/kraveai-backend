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
MAX_CONCURRENT = 3

try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")
    cl = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Puedes cambiar esto a ["https://kraveai.netlify.app"] si prefieres restringir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "OK",
        "versión": "v1.7 - actualizado 2025-06-18",
        "service": "KraveAI Python",
        "login": "Activo" if cl and cl.user_id else "Fallido",
        "concurrent_max": MAX_CONCURRENT
    }

@app.get("/cuentas")
def obtener_cuentas():
    path = os.path.join(os.path.dirname(__file__), "cuentas_creadas.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            cuentas = json.load(f)
            return cuentas
    except Exception as e:
        logger.error(f"Error leyendo cuentas_creadas.json: {str(e)}")
        raise HTTPException(status_code=500, detail="Error leyendo archivo de cuentas")

@app.get("/test-telegram")
def test_telegram():
    try:
        notify_telegram("📲 Prueba de conexión con Telegram desde /test-telegram")
        return {"mensaje": "Telegram notificado correctamente"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        import uuid
        for i in range(count):
            try:
                result = subprocess.run([
                    "node", "crearCuentaInstagram.js"
                ], capture_output=True, text=True, timeout=180)

                if result.returncode == 0:
                    cuenta = json.loads(result.stdout)
                    if cuenta.get("status") == "success":
                        yield f"event: account-created\ndata: {json.dumps(cuenta)}\n\n"
                    else:
                        error = cuenta.get("error", "Error desconocido")
                        yield f"event: error\ndata: {json.dumps({
                            'status': 'error',
                            'message': str(error),
                            'proxy': cuenta.get('proxy', 'N/A'),
                            'usuario': cuenta.get('usuario', ''),
                            'email': cuenta.get('email', '')
                        })}\n\n"
                else:
                    error = result.stderr or result.stdout or "Error desconocido"
                    yield f"event: error\ndata: {json.dumps({
                        'status': 'error',
                        'message': error[:100]
                    })}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({
                    'status': 'error',
                    'message': str(e)[:100]
                })}\n\n"
            await asyncio.sleep(1)
        yield "event: complete\ndata: Proceso terminado\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
        timeout_keep_alive=30,
        limit_concurrency=8
    )
