# main.py - Versión Corregida con Todos los Endpoints
# ... (imports y configuraciones previas)

@app.get("/test-telegram")
def test_telegram():
    try:
        notify_telegram("📲 Prueba de conexión con Telegram desde /test-telegram")
        return JSONResponse(
            content={"mensaje": "Telegram notificado correctamente"},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )
    except Exception as e:
        logger.error(f"Error en test-telegram: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Error enviando notificación a Telegram"},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    """Endpoint SSE para creación de cuentas"""
    async def event_stream():
        # ... (tu implementación de SSE aquí)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Access-Control-Allow-Origin": "https://kraveai.netlify.app",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

# Añade también estos endpoints esenciales que faltan:

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return JSONResponse(
            content={"status": "activo", "usuario": cl.username},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )
    return JSONResponse(
        content={"status": "inactivo"},
        headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
    )

@app.post("/iniciar-sesion")
def iniciar_sesion_post(datos: dict):
    # ... (tu implementación de inicio de sesión)
    
@app.get("/cerrar-sesion")
def cerrar_sesion():
    # ... (tu implementación de cierre de sesión)

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    # ... (tu implementación de búsqueda de usuario)

# ... (resto de endpoints)

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
