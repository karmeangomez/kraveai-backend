// nombre_utils.js
const nombres = ["Juan", "Ana", "Carlos", "Luisa", "Pedro", "María"];
const apellidos = ["Gómez", "Ramos", "Pérez", "Fernández", "Ruiz", "Torres"];

function generarNombre() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
  return `${nombre}${apellido}${Math.floor(Math.random() * 1000)}`;
}

module.exports = { generarNombre };
