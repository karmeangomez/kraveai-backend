import os
import json
import logging
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from dotenv import load_dotenv
from login_utils import login_instagram, restaurar_sesion

# Configuración inicial
load_dotenv()
logger = logging.getLogger("KraveAI")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Crear aplicación FastAPI
app = FastAPI(title="KraveAI Backend", version="1.0")

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

# ================ ENDPOINTS ================
@app.get("/health")
def health_check():
    """Endpoint de verificación de salud"""
    estado = "OK" if cliente_principal and cliente_principal.user_id else "WARNING"
    return {
        "status": estado, 
        "version": app.version,
        "usuario": cliente_principal.username if cliente_principal else None
    }

@app.get("/test")
def test_endpoint():
    """Endpoint de prueba"""
    return {"message": "¡Backend operativo!", "status": "success"}

@app.get("/debug-rutas")
def debug_rutas():
    """Endpoint para depuración: muestra todas las rutas registradas"""
    rutas = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            rutas.append({
                "ruta": route.path,
                "metodos": list(route.methods),
                "nombre": route.name
            })
    return {"rutas": rutas}

@app.get("/estado-sesion")
def estado_sesion():
    """Verifica el estado de la sesión de Instagram"""
    if cliente_principal and cliente_principal.user_id:
        return {
            "status": "activa",
            "usuario": cliente_principal.username,
            "user_id": cliente_principal.user_id,
            "seguidores": cliente_principal.account_info().follower_count
        }
    return JSONResponse(
        content={"status": "inactiva", "error": "No hay sesión activa"},
        status_code=401
    )

@app.post("/iniciar-sesion")
async def iniciar_sesion(request: Request):
    """Inicia sesión en Instagram manualmente"""
    global cliente_principal
    
    try:
        data = await request.json()
        usuario = data.get("usuario")
        password = data.get("password")
        
        if not usuario or not password:
            raise HTTPException(400, "Faltan credenciales")
        
        # Crear nuevo cliente
        cl = login_instagram(usuario, password)
        if not cl:
            raise HTTPException(401, "No se pudo iniciar sesión")
        
        # Establecer como cliente principal
        cliente_principal = cl
        logger.info(f"✅ Sesión iniciada correctamente: @{usuario}")
        
        return {
            "status": "success",
            "message": f"Sesión iniciada como @{usuario}",
            "user_id": cliente_principal.user_id
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error crítico: {str(e)}")
        return JSONResponse(
            content={"error": "Error en inicio de sesión"},
            status_code=500
        )

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(..., min_length=1)):
    """Busca información de usuario en Instagram"""
    if not cliente_principal or not cliente_principal.user_id:
        raise HTTPException(
            status_code=503,
            detail="Servicio de Instagram no disponible"
        )
    
    try:
        user = cliente_principal.user_info_by_username(username)
        return {
            "username": user.username,
            "full_name": user.full_name,
            "followers": user.follower_count,
            "following": user.following_count,
            "biography": user.biography,
            "is_verified": user.is_verified,
            "profile_pic_url": user.profile_pic_url,
            "is_private": user.is_private,
            "media_count": user.media_count
        }
    except Exception as e:
        logger.error(f"Error buscando usuario: {str(e)}")
        raise HTTPException(500, "Error en búsqueda")

@app.get("/cuentas-activas")
def cuentas_activas():
    """Lista de cuentas activas"""
    # En esta versión solo manejamos una cuenta
    if cliente_principal and cliente_principal.user_id:
        return {
            "cuentas": [{
                "usuario": cliente_principal.username,
                "user_id": cliente_principal.user_id
            }]
        }
    return {"cuentas": []}

# ================ INICIALIZACIÓN ================
@app.on_event("startup")
def init_app():
    global cliente_principal
    logger.info("🚀 Iniciando servicio de Instagram...")
    
    # Credenciales de kraveaibot
    USER = os.getenv("INSTAGRAM_USER")
    PASS = os.getenv("INSTAGRAM_PASS")
    
    if not USER or not PASS:
        logger.error("❌ Faltan variables de entorno: INSTAGRAM_USER o INSTAGRAM_PASS")
        return
    
    try:
        cliente_principal = login_instagram(USER, PASS)
        if cliente_principal:
            user_info = cliente_principal.account_info()
            logger.info(f"✅ Sesión activa: @{user_info.username}")
            logger.info(f"👤 Seguidores: {user_info.follower_count}")
        else:
            logger.error("❌ No se pudo iniciar sesión en Instagram")
    except Exception as e:
        logger.error(f"❌ Error en inicialización: {str(e)}")

# Mensaje de inicio
logger.info("✅ Aplicación inicializada correctamente")

# Función para verificar rutas
def verificar_rutas():
    rutas_esperadas = {"/health", "/test", "/debug-rutas", "/estado-sesion", 
                      "/iniciar-sesion", "/buscar-usuario", "/cuentas-activas"}
    rutas_registradas = {route.path for route in app.routes if isinstance(route, APIRoute)}
    
    if not rutas_esperadas.issubset(rutas_registradas):
        missing = rutas_esperadas - rutas_registradas
        logger.error(f"❌ Rutas faltantes: {missing}")
    else:
        logger.info("✅ Todas las rutas registradas correctamente")

# Verificar rutas al iniciar
verificar_rutas()
