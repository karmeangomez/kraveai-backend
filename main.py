# main.py - Backend FastAPI completo para KraveAI con despliegue automático

import os
import asyncio
import subprocess
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from nombre_utils import generar_nombre, generar_usuario
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram

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

@app.post("/deploy/{secret}")
async def deploy(secret: str):
    if secret != os.getenv("DEPLOY_SECRET"):
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        comando = (
            "cd ~/kraveai-backend-py && "
            "git pull origin main && "
            "source env/bin/activate && "
            "pip install -r requirements.txt && "
            "sudo systemctl restart kraveai-python"
        )
        subprocess.run(comando, shell=True, check=True)
        await notify_telegram("🚀 Despliegue automático ejecutado desde GitHub")
        return {"status": "OK", "message": "Despliegue completado"}
    except Exception as e:
        await notify_telegram(f"❌ Error en despliegue automático:\n{str(e)}")
        return {"status": "ERROR", "details": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
