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
MAX_CONCURRENT = 3

# Configuración CORS robusta
origins = [
    "https://kraveai.netlify.app",
    "http://localhost:3000",
    "https://kraveapi.xyz"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "https://kraveai.netlify.app"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# Inicialización de Instagram
try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")
    cl = None

@app.get("/health")
def health():
    return {
        "status": "OK",
        "version": "v2.0 - CORS Fixed",
        "service": "KraveAI Python",
        "login": "Activo" if cl and cl.user_id else "Fallido",
        "concurrent_max": MAX_CONCURRENT
    }

@app.get("/health-simple")
def health_simple():
    return PlainTextResponse(
        "OK",
        headers={
            "Access-Control-Allow-Origin": "https://kraveai.netlify.app",
            "Cache-Control": "no-cache"
        }
    )

@app.get("/cuentas")
def obtener_cuentas():
    path = os.path.join(os.path.dirname(__file__), "cuentas_creadas.json")
    if not os.path.exists(path):
        return JSONResponse(
            status_code=404,
            content=[],
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            cuentas = json.load(f)
            return JSONResponse(
                content=cuentas,
                headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
            )
    except Exception as e:
        logger.error(f"Error leyendo cuentas: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Error interno"},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )

# ... (resto de endpoints con el mismo patrón de headers) ...

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
        timeout_keep_alive=30,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
