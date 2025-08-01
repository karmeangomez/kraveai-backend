import os
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from login_utils import login_instagram, guardar_sesion, restaurar_sesion

app = FastAPI()

# CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cambia a tu dominio de Netlify si quieres restringir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/iniciar-sesion")
def iniciar_sesion(data: LoginRequest):
    cl = login_instagram(data.username, data.password)
    if not cl:
        raise HTTPException(status_code=401, detail="Login fallido")
    return {"status": "ok", "username": data.username}

@app.get("/estado-sesion")
def estado_sesion(username: str = Query(...)):
    cl = restaurar_sesion(username)
    if cl:
        return {"status": "ok", "username": username}
    else:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

@app.post("/guardar-cuenta")
def guardar_cuenta(data: LoginRequest):
    cl = login_instagram(data.username, data.password)
    if not cl:
        raise HTTPException(status_code=401, detail="No se pudo guardar la cuenta")
    guardar_sesion(cl, data.username)
    return {"status": "ok", "username": data.username}
