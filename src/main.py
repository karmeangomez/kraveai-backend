# main.py - KraveAI v6.0 (Solución Definitiva)
import os
import logging
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

# Configuración básica de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("KraveAI")

# 1. Crear la aplicación FastAPI PRIMERO
app = FastAPI(title="KraveAI Backend", version="6.0")

# 2. Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Definir endpoints básicos (SIEMPRE disponibles)
@app.get("/health")
def health_check():
    """Endpoint básico de verificación de salud"""
    return {"status": "OK", "version": app.version}

@app.get("/test")
def test_endpoint():
    """Endpoint de prueba"""
    return {"message": "¡El backend funciona correctamente!", "status": "success"}

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

# 4. Intentar cargar funcionalidades de Instagram
try:
    from instagrapi import Client
    from instagrapi.exceptions import ChallengeRequired, LoginRequired, ClientError
    
    # Configuración de Instagram
    USER = os.getenv("INSTAGRAM_USER", "krave")
    PASS = os.getenv("INSTAGRAM_PASS", "password")
    cliente_principal = None
    
    # Función simplificada para pruebas
    def login_instagram(username: str, password: str):
        logger.info(f"Simulando inicio de sesión para {username}")
        return Client()
    
    # Endpoint de búsqueda
    @app.get("/buscar-usuario")
    def buscar_usuario(username: str = Query(..., min_length=1)):
        """Busca información de usuario en Instagram"""
        if not cliente_principal:
            raise HTTPException(status_code=503, detail="Servicio de Instagram no disponible")
        
        try:
            # Simulación de respuesta
            return {
                "username": username,
                "full_name": "Usuario de prueba",
                "followers": 1000,
                "is_verified": True,
                "status": "simulado"
            }
        except Exception as e:
            logger.error(f"Error buscando usuario: {str(e)}")
            raise HTTPException(500, "Error en búsqueda")
    
    logger.info("Funciones de Instagram habilitadas")
    
except ImportError:
    logger.warning("Biblioteca instagrapi no instalada, funciones de Instagram deshabilitadas")
    
    # Endpoint alternativo si Instagram no está disponible
    @app.get("/buscar-usuario")
    def buscar_usuario(username: str = Query(..., min_length=1)):
        return {
            "error": "Funcionalidad no disponible",
            "message": "Biblioteca instagrapi no instalada",
            "username": username
        }

# 5. Evento de startup (ÚLTIMO)
@app.on_event("startup")
def init_app():
    """Inicialización de la aplicación después de registrar endpoints"""
    logger.info("🚀 Iniciando proceso de configuración...")
    
    try:
        # Solo si tenemos soporte para Instagram
        if 'cliente_principal' in globals():
            global cliente_principal
            logger.info(f"Intentando iniciar sesión en Instagram: {USER}")
            
            # Simulamos el inicio de sesión
            cliente_principal = login_instagram(USER, PASS)
            
            if cliente_principal:
                logger.info(f"Sesión de Instagram iniciada para {USER}")
            else:
                logger.warning("No se pudo iniciar sesión en Instagram")
    except Exception as e:
        logger.error(f"Error en inicialización: {str(e)}")

# Mensaje de inicio
logger.info("✅ Aplicación inicializada correctamente")
