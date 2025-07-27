# main.py - KraveAI v8.0 (Integración Real Instagram)
import os
import logging
import json
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired, ClientError

# Configuración básica de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("KraveAI")

# 1. Crear la aplicación FastAPI
app = FastAPI(title="KraveAI Backend", version="8.0")

# 2. Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Variable global para el cliente de Instagram
cliente_principal = None

# 4. Definir endpoints básicos
@app.get("/health")
def health_check():
    """Endpoint básico de verificación de salud"""
    estado = "OK" if cliente_principal else "WARNING"
    return {"status": estado, "version": app.version}

@app.get("/test")
def test_endpoint():
    """Endpoint de prueba"""
    return {"message": "¡Backend operativo!", "status": "success"}

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

# 5. Endpoint para iniciar sesión manualmente
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
        cl = Client()
        
        # Intentar cargar sesión existente
        session_file = f"src/sessions/{usuario}.json"
        if os.path.exists(session_file):
            cl.load_settings(session_file)
            logger.info(f"Sesión cargada para {usuario}")
        else:
            logger.info(f"Iniciando nueva sesión para {usuario}")
        
        # Iniciar sesión
        cl.login(usuario, password)
        
        # Guardar sesión
        cl.dump_settings(session_file)
        
        # Establecer como cliente principal
        cliente_principal = cl
        logger.info(f"✅ Sesión iniciada correctamente: @{usuario}")
        
        return {
            "status": "success",
            "message": f"Sesión iniciada como @{usuario}",
            "user_id": cliente_principal.user_id
        }
        
    except (ChallengeRequired, LoginRequired) as e:
        logger.error(f"Error de inicio de sesión: {str(e)}")
        return JSONResponse(
            content={"error": "Verificación requerida", "code": "CHALLENGE_REQUIRED"},
            status_code=401
        )
    except Exception as e:
        logger.error(f"Error crítico: {str(e)}")
        return JSONResponse(
            content={"error": "Error en inicio de sesión"},
            status_code=500
        )

# 6. Endpoint de búsqueda con Instagram real
@app.get("/buscar-usuario")
def buscar_usuario_real(username: str = Query(..., min_length=1)):
    """Busca información real de usuario en Instagram"""
    global cliente_principal
    
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
    except (ChallengeRequired, LoginRequired) as e:
        logger.error(f"Error de sesión: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Sesión inválida. Requiere reautenticación"
        )
    except ClientError as e:
        logger.error(f"Error de cliente: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Usuario no encontrado o cuenta privada"
        )
    except Exception as e:
        logger.error(f"Error inesperado: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error interno del servidor"
        )

# 7. Evento de startup para cargar sesión automáticamente
@app.on_event("startup")
def init_app():
    global cliente_principal
    logger.info("🚀 Iniciando servicio de Instagram...")
    
    # Credenciales de kraveaibot
    USER = os.getenv("INSTAGRAM_USER", "kraveaibot")
    PASS = os.getenv("INSTAGRAM_PASS", "tu_password")
    
    try:
        cl = Client()
        
        # Intentar cargar sesión existente
        session_file = f"src/sessions/{USER}.json"
        if os.path.exists(session_file):
            logger.info(f"♻️ Intentando cargar sesión existente para {USER}")
            cl.load_settings(session_file)
            
            # Verificar si la sesión es válida
            try:
                user_info = cl.account_info()
                logger.info(f"✅ Sesión válida para @{user_info.username}")
                cliente_principal = cl
                return
            except (ChallengeRequired, LoginRequired):
                logger.warning("⚠️ Sesión expirada, iniciando nueva sesión")
        
        # Iniciar nueva sesión si no hay sesión válida
        logger.info(f"🔑 Iniciando nueva sesión para {USER}")
        cl.login(USER, PASS)
        
        # Guardar sesión
        os.makedirs("src/sessions", exist_ok=True)
        cl.dump_settings(session_file)
        
        cliente_principal = cl
        logger.info(f"✅ Sesión iniciada correctamente para @{USER}")
        
        # Verificar conexión
        user_info = cliente_principal.account_info()
        logger.info(f"👤 Usuario: @{user_info.username} | Seguidores: {user_info.follower_count}")
        
    except Exception as e:
        logger.critical(f"❌ Error crítico en inicio de sesión: {str(e)}")
        cliente_principal = None

# Mensaje de inicio
logger.info("✅ Aplicación inicializada correctamente")
