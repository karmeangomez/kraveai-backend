# main.py - KraveAI v4.1 (Corrección Definitiva)
import os
import json
import logging
import sys
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from dotenv import load_dotenv
from login_utils import login_instagram, restaurar_sesion
from instagrapi.exceptions import ChallengeRequired, LoginRequired, ClientError

# 1. Configuración inicial
load_dotenv()
logger = logging.getLogger("KraveAI")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# 2. Crear aplicación FastAPI PRIMERO
app = FastAPI(title="KraveAI Backend", version="4.1")

# 3. Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Endpoints DEBEN definirse ANTES del startup
@app.get("/health")
def verificar_salud():
    """Endpoint de salud siempre accesible"""
    return {"status": "OK", "version": app.version}

@app.get("/test")
def test_endpoint():
    """Endpoint de prueba básico"""
    return {"message": "¡Funciona!", "status": "success"}

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(..., min_length=1)):
    """Busca información de usuario (sin depender de cliente_principal)"""
    return {
        "username": username,
        "status": "endpoint activo",
        "message": "La funcionalidad completa se cargará después del startup"
    }

@app.get("/debug-rutas")
def debug_rutas():
    """Endpoint de depuración para ver rutas registradas"""
    rutas = [
        {
            "ruta": route.path, 
            "metodos": list(route.methods),
            "nombre": route.name
        }
        for route in app.routes if isinstance(route, APIRoute)
    ]
    return {"rutas": rutas}

# 5. Variable global para el cliente
cliente_principal = None

# 6. Evento startup DEFINIDO AL FINAL
@app.on_event("startup")
def inicializar_aplicacion():
    """Inicializa la aplicación después de registrar endpoints"""
    global cliente_principal
    logger.info("⚡ Iniciando proceso de startup...")
    
    usuario = os.getenv("INSTAGRAM_USER")
    password = os.getenv("INSTAGRAM_PASS")
    
    if not usuario or not password:
        logger.error("❌ Variables de entorno faltantes")
        return  # No salir, mantener API funcional

    try:
        # Intentar restaurar sesión existente
        cliente_principal = restaurar_sesion(usuario)
        
        # Si no hay sesión, iniciar nueva
        if not cliente_principal:
            logger.info("🔑 Iniciando nueva sesión...")
            cliente_principal = login_instagram(usuario, password)
        
        # Verificar conexión
        if cliente_principal and cliente_principal.user_id:
            user_info = cliente_principal.account_info()
            logger.info(f"✅ Sesión activa como @{user_info.username}")
            
            # Actualizar endpoint /health
            app.get("/health")(lambda: {
                "status": "OK", 
                "usuario": user_info.username,
                "seguidores": user_info.follower_count
            })
            
            # Actualizar endpoint /buscar-usuario
            def buscar_usuario_actualizado(username: str = Query(..., min_length=1)):
                try:
                    user = cliente_principal.user_info_by_username(username, timeout=10)
                    return {
                        "username": user.username,
                        "full_name": user.full_name,
                        "followers": user.follower_count,
                        "is_verified": user.is_verified
                    }
                except Exception as e:
                    logger.error(f"Error buscando usuario: {str(e)}")
                    raise HTTPException(500, "Error en búsqueda")
            
            app.get("/buscar-usuario")(buscar_usuario_actualizado)
            
        else:
            logger.warning("⚠️ Sesión de Instagram no activa, algunas funciones limitadas")
            
    except Exception as e:
        logger.critical(f"🔥 Error crítico en startup: {str(e)}")
        # Mantener API funcionando sin funcionalidad de Instagram
