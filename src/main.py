# main.py – KraveAI v3.4
import os
import json
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from login_utils import login_instagram, cargar_sesion_guardada, guardar_sesion
from instagrapi.exceptions import LoginRequired, ChallengeRequired
from instagrapi import Client

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_USERNAME = os.getenv("INSTAGRAM_USER")
API_PASSWORD = os.getenv("INSTAGRAM_PASS")
PROXY_FILE = "src/proxies/proxies.txt"
CUENTAS_JSON = "cuentas_creadas.json"

cliente_principal = None
sesiones = {}  # {usuario: Client}

# Ruta de salud
@app.get("/health")
def health():
    return {"status": "ok"}

# Verificar sesión
@app.get("/estado-sesion")
def estado_sesion():
    if cliente_principal and cliente_principal.user_id:
        return {"status": "activo", "usuario": cliente_principal.username}
    return {"status": "inactivo"}

# Iniciar sesión manual
@app.post("/iniciar-sesion")
async def iniciar_sesion(request: Request):
    data = await request.json()
    usuario = data.get("usuario")
    contrasena = data.get("contrasena")

    try:
        cl = login_instagram(usuario, contrasena, get_proxy(usuario))
        guardar_sesion(cl, usuario)
        sesiones[usuario] = cl
        return {"exito": True, "usuario": usuario}
    except ChallengeRequired:
        return {"exito": False, "mensaje": "ChallengeRequired: Verificación necesaria"}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

# Cerrar sesión
@app.get("/cerrar-sesion")
def cerrar_sesion():
    global cliente_principal
    cliente_principal = None
    return {"exito": True, "mensaje": "Sesión cerrada"}

# Guardar cuenta manual
@app.post("/guardar-cuenta")
async def guardar_cuenta(request: Request):
    data = await request.json()
    usuario = data.get("usuario")
    contrasena = data.get("contrasena")

    try:
        cl = login_instagram(usuario, contrasena, get_proxy(usuario))
        guardar_sesion(cl, usuario)
        sesiones[usuario] = cl

        cuentas = []
        if os.path.exists(CUENTAS_JSON):
            with open(CUENTAS_JSON, "r") as f:
                cuentas = json.load(f)
        if usuario not in [c["usuario"] for c in cuentas]:
            cuentas.append({"usuario": usuario, "contrasena": contrasena})
            with open(CUENTAS_JSON, "w") as f:
                json.dump(cuentas, f, indent=2)

        return {"exito": True}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

# Buscar usuario (requiere cliente_principal)
@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    if not cliente_principal:
        return JSONResponse(content={"error": "No hay sesión activa"}, status_code=401)
    try:
        user = cliente_principal.user_info_by_username(username)
        return {
            "username": user.username,
            "nombre": user.full_name,
            "foto": user.profile_pic_url,
            "verificado": user.is_verified,
            "privado": user.is_private,
            "negocio": user.is_business,
            "seguidores": user.follower_count,
            "seguidos": user.following_count,
            "publicaciones": user.media_count,
            "biografia": user.biography
        }
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

# Listar cuentas activas
@app.get("/cuentas-activas")
def cuentas_activas():
    activas = [{"usuario": u} for u in sesiones]
    return {"cuentas": activas}

# Utilidades
def get_proxy(usuario: str) -> str:
    if not os.path.exists(PROXY_FILE):
        return None
    with open(PROXY_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]
    if not proxies:
        return None
    # Selección simple por hash de username
    return proxies[hash(usuario) % len(proxies)]

# Al iniciar el backend
@app.on_event("startup")
def cargar_sesiones():
    global cliente_principal
    try:
        cliente_principal = cargar_sesion_guardada(API_USERNAME)
        sesiones[API_USERNAME] = cliente_principal
        logger.info(f"Sesión restaurada para kraveaibot: @{API_USERNAME}")
    except Exception as e:
        logger.error(f"No se pudo restaurar la sesión principal: {e}")

    # Restaurar cuentas manuales
    if os.path.exists(CUENTAS_JSON):
        with open(CUENTAS_JSON, "r") as f:
            cuentas = json.load(f)
        for cuenta in cuentas:
            try:
                cl = cargar_sesion_guardada(cuenta["usuario"])
                sesiones[cuenta["usuario"]] = cl
                logger.info(f"Sesión restaurada: @{cuenta['usuario']}")
            except Exception as e:
                logger.warning(f"Fallo al cargar sesión de @{cuenta['usuario']}: {e}")