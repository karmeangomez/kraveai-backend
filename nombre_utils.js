// nombre_utils.js - Generador de nombres y usuarios para Instagram

const nombres = ["Juan", "Ana", "Carlos", "Luisa", "Pedro", "María"];
const apellidos = ["Gómez", "Ramos", "Pérez", "Fernández", "Ruiz", "Torres"];

function generarNombre() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
  return `${nombre} ${apellido}`;
}

function generarUsuario() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${nombre.toLowerCase()}${apellido.toLowerCase()}${num}`;
}

module.exports = {
  generar_nombre: generarNombre,
  generar_usuario: generarUsuario
};
