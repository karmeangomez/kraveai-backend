import random
import string

def generar_nombre():
    nombres = ["Carlos", "Ana", "Luis", "María", "Jorge", "Sofía", "Pedro", "Lucía", "Miguel", "Elena"]
    apellidos = ["García", "Martínez", "López", "Hernández", "González"]
    return f"{random.choice(nombres)} {random.choice(apellidos)}"

def generar_usuario():
    base = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"krave_{base}"
