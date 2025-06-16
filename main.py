import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from nombre_utils import generar_nombre, generar_usuario
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from instagrapi import Client

load_dotenv()
app = FastAPI()

# Configurar CORS para permitir desde Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kraveai.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cl = Client()

# Auto-login si hay cookies
try:
    if os.path.exists("ig_session.json"):
        cl.load_settings("ig_session.json")
        cl.get_timeline_feed()
        print("✅ Sesion restaurada desde cookies")
    else:
        print("❌ No hay sesion previa")
        # Intentar login forzado usando .env
        USERNAME = os.getenv("IG_USERNAME")
        PASSWORD = os.getenv("INSTAGRAM_PASS")
        if USERNAME and PASSWORD:
            cl.login(USERNAME, PASSWORD)
            cl.dump_settings("ig_session.json")
            print(f"🔐 Login forzado exitoso como @{USERNAME}")
except Exception as e:
    print("❌ Error en login inicial:", e)
    cl = None

@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "login": "Activo" if cl and cl.user_id else "Fallido"
    }

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return {"status": "activo", "usuario": cl.username}
    return {"status": "inactivo"}

@app.post("/iniciar-sesion")
def iniciar_sesion_post(datos: dict):
    usuario = datos.get("usuario")
    contrasena = datos.get("contrasena")
    if not usuario or not contrasena:
        return {"exito": False, "mensaje": "Faltan datos"}
    global cl
    nuevo = Client()
    try:
        nuevo.login(usuario, contrasena)
        cl = nuevo
        cl.dump_settings("ig_session.json")
        return {"exito": True, "usuario": usuario}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.get("/cerrar-sesion")
def cerrar_sesion():
    try:
        global cl
        cl.logout()
        cl = None
        if os.path.exists("ig_session.json"):
            os.remove("ig_session.json")
        return {"exito": True}
    except:
        return {"exito": False, "mensaje": "No se pudo cerrar la sesion"}

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    try:
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
        return {"error": str(e)}

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(min(count, 5)):
            if await request.is_disconnected():
                break
            cuenta = crear_cuenta_instagram(cl)
            if cuenta:
                await notify_telegram(f"✅ Cuenta creada: @{cuenta['usuario']} con {cuenta['proxy'] or 'sin proxy'}")
                yield f"event: account-created\ndata: {cuenta}\n\n"
            else:
                yield f"event: error\ndata: {{\"message\": \"Falló la cuenta {i+1}\"}}\n\n"
            await asyncio.sleep(2)
        yield f"event: complete\ndata: {{\"message\": \"Proceso completado\"}}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
