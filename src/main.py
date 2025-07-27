# main.py - KraveAI v4.0 (Corregido y Optimizado)
import os
import json
import logging
import sys
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from dotenv import load_dotenv
from login_utils import login_instagram, restaurar_sesion
from instagrapi.exceptions import ChallengeRequired, LoginRequired, ClientError

# Configuración inicial
load_dotenv()
logger = logging.getLogger("KraveAI")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Crear aplicación FastAPI
app = FastAPI(title="KraveAI Backend", version="4.0")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variable global para el cliente principal
cliente_principal = None

# ================ EVENTO DE INICIO ================
@app.on_event("startup")
def inicializar_aplicacion():
    """Inicializa la aplicación y la sesión de Instagram"""
    global cliente_principal
    usuario = os.getenv("INSTAGRAM_USER")
    password = os.getenv("INSTAGRAM_PASS")
    
    if not usuario or not password:
        logger.critical("❌ Faltan variables de entorno: INSTAGRAM_USER o INSTAGRAM_PASS")
        sys.exit(1)
    
    try:
        # 1. Intentar restaurar sesión existente
        cliente_principal = restaurar_sesion(usuario)
        
        # 2. Si no hay sesión, iniciar nueva sesión
        if not cliente_principal:
            logger.info("⚡ Iniciando nueva sesión...")
            cliente_principal = login_instagram(usuario, password)
        
        # 3. Verificar conexión
        if cliente_principal and cliente_principal.user_id:
            user_info = cliente_principal.account_info()
            logger.info(f"✅ Sesión activa: @{user_info.username} (ID: {user_info.pk})")
        else:
            logger.error("❌ No se pudo establecer sesión con Instagram")
            sys.exit(1)
            
    except (ChallengeRequired, LoginRequired) as e:
        logger.critical(f"❌ Requiere verificación: {str(e)}")
        sys.exit(1)
    except ClientError as e:
        logger.critical(f"❌ Error de cliente: {str(e)}")
        sys.exit(1)
    except Exception as e:
        logger.critical(f"❌ Error crítico: {str(e)}")
        sys.exit(1)

# ================ ENDPOINTS ================
@app.get("/health")
def verificar_salud():
    """Endpoint de verificación de estado del servicio"""
    estado = "OK" if cliente_principal and cliente_principal.user_id else "ERROR"
    return {
        "status": estado,
        "version": app.version,
        "accounts": ["krave"] if estado == "OK" else []
    }

@app.get("/estado-sesion")
def estado_sesion():
    """Verifica el estado de la sesión de Instagram"""
    if cliente_principal and cliente_principal.user_id:
        return {
            "status": "activa",
            "usuario": cliente_principal.username,
            "user_id": cliente_principal.user_id
        }
    return JSONResponse(
        content={"status": "inactiva", "error": "No hay sesión activa"},
        status_code=401
    )

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(..., min_length=3)):
    """Busca información de un usuario en Instagram"""
    if not cliente_principal or not cliente_principal.user_id:
        return JSONResponse(
            content={"error": "No hay sesión activa con Instagram"},
            status_code=401
        )
    
    try:
        # Obtener información del usuario con timeout
        user = cliente_principal.user_info_by_username(username, timeout=10)
        
        return {
            "username": user.username,
            "full_name": user.full_name,
            "followers": user.follower_count,
            "following": user.following_count,
            "biography": user.biography,
            "is_verified": user.is_verified,
            "profile_pic": user.profile_pic_url,
            "is_private": user.is_private,
            "media_count": user.media_count
        }
        
    except (ChallengeRequired, LoginRequired):
        return JSONResponse(
            content={"error": "Sesión inválida. Requiere nueva autenticación"},
            status_code=401
        )
    except ClientError as e:
        logger.error(f"Error de cliente al buscar usuario: {str(e)}")
        return JSONResponse(
            content={"error": "Usuario no encontrado o cuenta privada"},
            status_code=404
        )
    except Exception as e:
        logger.error(f"Error al buscar usuario: {str(e)}")
        return JSONResponse(
            content={"error": "Error interno del servidor"},
            status_code=500
        )

@app.get("/debug-rutas")
def debug_rutas():
    """Endpoint para depuración: muestra todas las rutas registradas"""
    rutas = [
        {
            "ruta": route.path, 
            "metodos": list(route.methods),
            "nombre": route.name
        }
        for route in app.routes if isinstance(route, APIRoute)
    ]
    return {"rutas": rutas}
