# main.py - Backend FastAPI completo para KraveAI con login real y creación de cuentas

import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from nombre_utils import generar_nombre, generar_usuario
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram
from login_utils import login_instagram

load_dotenv()
app = FastAPI()

start_time = asyncio.get_event_loop().time()

@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "uptime": round(asyncio.get_event_loop().time() - start_time, 2)
    }

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(min(count, 5)):
            if await request.is_disconnected():
                break

            cuenta = crear_cuenta_instagram()
            if cuenta:
                await notify_telegram(f"✅ Cuenta creada: @{cuenta['usuario']}")
                yield f"event: account-created\ndata: {cuenta}\n\n"
            else:
                yield f"event: error\ndata: {{\"message\": \"Falló crear cuenta {i+1}\"}}\n\n"

            await asyncio.sleep(2)

        yield f"event: complete\ndata: {{\"message\": \"Proceso completado\"}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/login-check")
async def login_check():
    try:
        client = login_instagram()
        if client:
            await notify_telegram("🔐 Login exitoso en Instagram ✅")
            return {"status": "OK", "message": "Sesión activa en Instagram"}
        else:
            await notify_telegram("❌ Error en login de Instagram")
            return {"status": "ERROR", "message": "No se pudo iniciar sesión"}
    except Exception as e:
        await notify_telegram(f"❌ Excepción en login: {str(e)}")
        return {"status": "ERROR", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
