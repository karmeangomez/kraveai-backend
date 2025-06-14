# main.py - Backend FastAPI para KraveAI
import os
import random
import asyncio
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv
from telegram_utils import notify_telegram
from nombre_utils import generar_nombre, generar_usuario

load_dotenv()

app = FastAPI()

@app.get("/health")
async def health():
    return {
        "status": "OK",
        "service": "KraveAI FastAPI",
        "version": "1.0",
        "uptime": os.times().elapsed
    }

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(min(count, 5)):
            if await request.is_disconnected():
                break

            nombre = generar_nombre()
            username = generar_usuario()
            cuenta = {
                "nombre": nombre,
                "usuario": username,
                "clave": f"Krave{random.randint(1000,9999)}!"
            }

            await notify_telegram(f"✅ Cuenta generada: {cuenta['usuario']}")
            yield f"event: account-created\ndata: {cuenta}\n\n"
            await asyncio.sleep(3)

        yield f"event: complete\ndata: {{\"message\": \"Proceso finalizado\"}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
