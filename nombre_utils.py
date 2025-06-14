import random
import string

def generar_nombre():
    nombres = [
        "Alan", "Murat", "Azad", "Necati", "Aaron", "Aarón", "Adán", "Adrián", "Agustín", "Aitor",
        "Alberto", "Alejandro", "Alonso", "Álvaro", "Andrés", "Antonio", "Armando", "Arturo", "Benjamín",
        "Bruno", "Carlos", "César", "Cristian", "Daniel", "David", "Diego", "Eduardo", "Emilio", "Enrique",
        "Ernesto", "Esteban", "Fabián", "Facundo", "Federico", "Felipe", "Fernando", "Francisco", "Gabriel",
        "Gael", "Gerardo", "Germán", "Gonzalo", "Guillermo", "Gustavo", "Héctor", "Hugo", "Ignacio", "Iker",
        "Isaac", "Ismael", "Iván", "Javier", "Jesús", "Joaquín", "Jorge", "José", "Juan", "Julio", "Leandro",
        "Leonardo", "Lorenzo", "Lucas", "Luis", "Manuel", "Marcos", "Martín", "Mateo", "Matías", "Mauricio",
        "Miguel", "Nicolás", "Óscar", "Pablo", "Patricio", "Rafael", "Ramón", "Raúl", "Ricardo", "Roberto",
        "Rodrigo", "Rubén", "Salvador", "Samuel", "Santiago", "Sergio", "Simón", "Tadeo", "Tomás", "Vicente"
    ]
    
    apellidos = [
        "García", "Martínez", "López", "Hernández", "González", "Rodríguez", "Pérez", "Sánchez", "Ramírez",
        "Torres", "Flores", "Díaz", "Cruz", "Morales", "Rojas", "Ortiz", "Gutiérrez", "Vargas", "Mendoza",
        "Aguilar", "Medina", "Castillo", "Jiménez", "Moreno", "Romero", "Álvarez", "Ruiz", "Delgado", "Castro",
        "Méndez", "Ríos", "Guerrero", "Herrera", "Vega", "Reyes", "Campos", "Fuentes", "Carrasco", "Santos",
        "Peña", "Cortés", "Núñez", "Ortega", "Silva", "Marín", "Iglesias", "Rubio", "Ibarra", "Serrano",
        "Lara", "Molina", "Valenzuela", "Vera", "Pizarro", "Godoy", "Contreras", "Salazar", "Vidal", "Cáceres"
    ]

    return f"{random.choice(nombres)} {random.choice(apellidos)}"

def generar_usuario():
    palabras = [
        "viajero", "estelar", "urbano", "digital", "libre", "creative", "luminoso", "sereno", "feliz", "vivo",
        "dream", "magia", "cafe", "arte", "style", "peace", "bliss", "garden", "sol", "luna", "cielo", "mar",
        "montaña", "viento", "fuego", "agua", "tierra", "natural", "puro", "simple", "bello", "verde", "azul",
        "rojo", "amarillo", "naranja", "violeta", "blanco", "negro", "gris", "brillo", "color", "sueños", "ideas",
        "momentos", "recuerdos", "sonrisas", "amor", "vida", "alma", "espíritu", "corazon", "mente", "cuerpo",
        "energia", "calma", "zen", "yoga", "medita", "flow", "chill", "vibe", "viaje", "ruta", "camino", "aventura",
        "explora", "descubre", "siente", "conoce", "crea", "inspira", "imagina", "diseña", "pinta", "escribe",
        "lee", "aprende", "enseña", "comparte", "conecta"
    ]

    patrones = [
        lambda: random.choice(palabras) + random.choice(palabras),
        lambda: random.choice(palabras) + str(random.randint(1, 99)),
        lambda: random.choice(palabras) + '_' + random.choice(palabras),
        lambda: random.choice(palabras) + '.' + random.choice(palabras),
        lambda: random.choice(palabras) + random.choice(['_', '.']) + str(random.randint(10, 999))
    ]

    usuario = random.choice(patrones)()

    # Limitar longitud total
    usuario = usuario[:random.randint(8, 25)]

    # Validar caracteres permitidos
    usuario = ''.join(c for c in usuario if c in string.ascii_lowercase + string.digits + '._')
    usuario = usuario.strip('_.').lower()

    # Evitar combinaciones inválidas como "..", "__", etc.
    while any(invalid in usuario for invalid in ['__', '..', '_.', '._']):
        usuario = usuario.replace('__', '_').replace('..', '.').replace('_.', '.').replace('._', '_')

    return usuario
