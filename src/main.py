# backend/src/main.py
import os
import json
import subprocess
import logging
import concurrent.futures
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
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
        logging.FileHandler("../kraveai.log", encoding='utf-8'),  # Logs en la raíz de backend/
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KraveAI-Backend")

# Cargar variables de entorno desde la raíz
load_dotenv("../.env")  # Leer .env desde la raíz de backend/
app = FastAPI(title="KraveAI Backend", version="1.8")
MAX_CONCURRENT = 3
cl = None

try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.middleware("http")
async def cors_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
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
        logger.error(f"Error en test-telegram: {str(e)}")
        raise HTTPException(status_code=500, detail="Error enviando notificación a Telegram")

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return {"status": "activo", "usuario": cl.username}
    return {"status": "inactivo"}

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
        if nuevo.is_logged_in:
            cl = nuevo
            cl.dump_settings("ig_session.json")
            notify_telegram(f"✅ Sesión iniciada como @{datos.usuario}")
            logger.info(f"Sesión Instagram iniciada: @{datos.usuario}")
            return {"exito": True, "usuario": datos.usuario}
        else:
            raise Exception("Login no completado, posible verificación requerida")
    except Exception as e:
        logger.error(f"Error inicio sesión: {str(e)}")
        if os.path.exists("ig_session.json"):
            cl = Client()
            cl.load_settings("ig_session.json")
            if cl.is_logged_in:
                return {"exito": True, "usuario": cl.username, "mensaje": "Sesión cargada desde archivo"}
        return JSONResponse(status_code=401, content={"exito": False, "mensaje": f"Error: {str(e)}. Podría requerir verificación manual en la app de Instagram."})

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
        return {"exito": True}
    except Exception as e:
        logger.error(f"Error cerrando sesión: {str(e)}")
        return JSONResponse(status_code=500, content={"exito": False, "mensaje": f"Error: {str(e)}"})

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    try:
        if not cl or not cl.user_id:
            return JSONResponse(status_code=401, content={"error": "Sesión no activa"})
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
        return JSONResponse(status_code=404, content={"error": str(e)})

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        completed = 0
        success = 0
        errors = 0
        futures = []

        if count <= 0 or count > 100:
            yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': 'Cantidad inválida (1-100)'})}\n\n"
            return

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
                futures = [executor.submit(run_crear_cuenta) for _ in range(count)]

                for future in concurrent.futures.as_completed(futures):
                    if await request.is_disconnected():
                        logger.warning("Cliente desconectado antes de completar el proceso")
                        break

                    try:
                        result = future.result()
                        if result.get("status") == "success":
                            yield f"event: account-created\ndata: {json.dumps(result)}\n\n"
                            success += 1
                        else:
                            error_msg = result.get("error", "Error desconocido")
                            yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': error_msg})}\n\n"
                            errors += 1
                    except Exception as e:
                        yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                        errors += 1
                    finally:
                        completed += 1
                        if completed % 2 == 0 or completed == count:
                            yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': count, 'success': success, 'errors': errors})}\n\n"

            if not await request.is_disconnected():
                yield "event: complete\ndata: Proceso terminado\n\n"
            else:
                yield "event: complete\ndata: Proceso interrumpido por desconexión\n\n"

        except Exception as e:
            logger.error(f"Error en el streaming SSE: {str(e)}")
            yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': 'Error interno del servidor'})}\n\n"
        finally:
            for future in futures:
                if not future.done():
                    future.cancel()

    return StreamingResponse(event_stream(), media_type="text/event-stream")

def run_crear_cuenta():
    try:
        # Ruta ajustada desde src/ a src/accounts/crearCuentaInstagram.js
        script_path = os.path.join(os.path.dirname(__file__), "accounts/crearCuentaInstagram.js")
        if not os.path.exists(script_path):
            return {"status": "error", "error": f"Script no encontrado en {script_path}"}
        result = subprocess.run(
            ["node", script_path],
            capture_output=True,
            text=True,
            timeout=180
        )
        if result.returncode == 0:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {"status": "error", "error": "Respuesta del script no es JSON válido. Salida: " + result.stdout}
        else:
            return {"status": "error", "error": result.stderr or "Error desconocido en el script"}
    except subprocess.TimeoutExpired as e:
        return {"status": "error", "error": "Tiempo de ejecución excedido (180s)"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )