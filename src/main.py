# backend/src/main.py
import os
import json
import subprocess
import logging
import concurrent.futures
import asyncio
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
        logging.FileHandler("../kraveai.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KraveAI-Backend")

# Cargar variables de entorno desde la raíz
load_dotenv("../.env")
app = FastAPI(title="KraveAI Backend", version="1.8")
MAX_CONCURRENT = 3
cl = None

try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")

# Middleware CORS ajustado para túneles (permitir dominios dinámicos)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ajusta esto si usas un dominio específico de ngrok o personalizado
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.middleware("http")
async def cors_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"  # Permitir conexiones desde cualquier origen (ajústalos si es necesario)
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
async def crear_cuentas_sse(request: Request, count: int = 50):  # Default de run.js
    async def event_stream():
        completed = 0
        success = 0
        errors = 0
        cuentas_exitosas = []
        cuentas_fallidas = []
        fallos_totales = 0
        max_fallos = 10

        if count <= 0 or count > 100:
            yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': 'Cantidad inválida (1-100)'})}\n\n"
            return

        yield f"event: start\ndata: {json.dumps({'message': '🔥 Iniciando KraveAI-Granja Rusa 🔥'})}\n\n"

        try:
            base_path = os.path.dirname(os.path.dirname(__file__))  # Sube a backend/ desde src/
            script_path = os.path.join(base_path, "src", "accounts", "crearCuentaInstagram.js")
            proxy_script_path = os.path.join(base_path, "src", "proxies", "ultimateProxyMaster.js")
            if not os.path.exists(script_path):
                yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': f'Script no encontrado en {script_path}'})}\n\n"
                return
            if not os.path.exists(proxy_script_path):
                yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': f'Proxy master no encontrado en {proxy_script_path}'})}\n\n"
                return

            # Inicializar proxies (simulación; ajusta según ultimateProxyMaster.js)
            yield f"event: progress\ndata: {json.dumps({'message': 'Inicializando proxies...'})}\n\n"
            proxy_master = subprocess.run(
                ["node", proxy_script_path, "--init"],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=base_path
            )
            if proxy_master.returncode != 0:
                yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': 'Error inicializando proxies: ' + proxy_master.stderr})}\n\n"
                return

            for i in range(count):
                if await request.is_disconnected():
                    logger.warning("Cliente desconectado antes de completar el proceso")
                    break

                yield f"event: progress\ndata: {json.dumps({'message': f'🚀 Creando cuenta {i + 1}/{count}'})}\n\n"
                # Obtener próximo proxy (simulación; ajusta según ultimateProxyMaster.js)
                proxy_result = subprocess.run(
                    ["node", proxy_script_path, "--next"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                    cwd=base_path
                )
                proxy = proxy_result.stdout.strip() if proxy_result.returncode == 0 else "http://default-proxy:8080"

                result = await run_single_account(base_path, proxy)

                if result.get("status") == "success":
                    cuentas_exitosas.append(result)
                    yield f"event: account-created\ndata: {json.dumps(result)}\n\n"
                    success += 1
                else:
                    cuentas_fallidas.append(result)
                    yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': result.get('error', 'Error desconocido')})}\n\n"
                    errors += 1
                    fallos_totales += 1

                if fallos_totales >= max_fallos:
                    yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': f'🛑 Proceso detenido por alcanzar {max_fallos} fallos'})}\n\n"
                    break

                await asyncio.sleep(3)  # Delay de 3 segundos como en run.js

                completed += 1
                if completed % 2 == 0 or completed == count:
                    yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': count, 'success': success, 'errors': errors})}\n\n"

            if not await request.is_disconnected():
                output_path = os.path.join(os.path.dirname(__file__), "cuentas_creadas.json")
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(cuentas_exitosas, f, indent=2)
                yield f"event: complete\ndata: {json.dumps({'message': f'📦 Resultado final: ✅ Creadas: {success}, ❌ Fallidas: {errors}, 💾 Guardadas en: {output_path}'})}\n\n"
            else:
                yield f"event: complete\ndata: {json.dumps({'message': 'Proceso interrumpido por desconexión'})}\n\n"

        except Exception as e:
            logger.error(f"Error en el streaming SSE: {str(e)}")
            yield f"event: error\ndata: {json.dumps({'status': 'error', 'message': 'Error interno del servidor'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

async def run_single_account(base_path, proxy):
    try:
        script_path = os.path.join(base_path, "src", "accounts", "crearCuentaInstagram.js")
        if not os.path.exists(script_path):
            return {"status": "error", "error": f"Script no encontrado en {script_path}"}
        result = subprocess.run(
            ["node", script_path, "--proxy", proxy],
            capture_output=True,
            text=True,
            timeout=180,
            cwd=base_path
        )
        if result.returncode == 0:
            try:
                output = result.stdout.strip()
                if not output:
                    return {"status": "error", "error": "Script no devolvió salida"}
                return json.loads(output)
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