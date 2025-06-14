# main.py - FastAPI principal conectado a todos los módulos

import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from nombre_utils import generar_nombre, generar_usuario
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram

load_dotenv()
app = FastAPI()

@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "KraveAI Python",
        "uptime": round(asyncio.get_event_loop().time(), 2)
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
