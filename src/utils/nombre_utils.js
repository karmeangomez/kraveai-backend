// src/utils/nombre_utils.js

const nombres = [
  'Carlos', 'María', 'Juan', 'Ana', 'Luis', 'Laura', 'Pedro', 'Sofía', 'Javier', 'Elena',
  'Andrés', 'Paola', 'Héctor', 'Gabriela', 'Fernando', 'Valeria', 'Daniel', 'Camila', 'Esteban', 'Natalia',
  'Eduardo', 'Lucía', 'Mateo', 'Renata', 'Emilio', 'Daniela', 'José', 'Carolina', 'Santiago', 'Andrea'
];

const apellidos = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Cruz', 'Ortiz', 'Morales', 'Jiménez', 'Mendoza', 'Castillo', 'Silva', 'Ruiz'
];

const adjetivos = [
  'valiente', 'alegre', 'rápido', 'tranquilo', 'fuerte', 'ligero', 'bravo', 'sencillo',
  'amable', 'tierno', 'sabio', 'listo', 'bonito', 'sereno', 'dulce', 'feliz'
];

const sustantivos = [
  'sol', 'luna', 'cielo', 'mar', 'río', 'montaña', 'estrella', 'viento',
  'fuego', 'tierra', 'nube', 'noche', 'aurora', 'bosque', 'trueno', 'lluvia'
];

function getRandomName() {
  const firstName = nombres[Math.floor(Math.random() * nombres.length)];
  const lastName = apellidos[Math.floor(Math.random() * apellidos.length)];
  return { firstName, lastName };
}

function generateRussianName() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido1 = apellidos[Math.floor(Math.random() * apellidos.length)];
  const apellido2 = apellidos[Math.floor(Math.random() * apellidos.length)];
  return `${nombre} ${apellido1} ${apellido2}`;
}

function generateUsername() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)].toLowerCase();
  const adjetivo = adjetivos[Math.floor(Math.random() * adjetivos.length)];
  const sustantivo = sustantivos[Math.floor(Math.random() * sustantivos.length)];
  const numero = Math.floor(Math.random() * 99999);
  return `${nombre}_${adjetivo}_${sustantivo}${numero}`;
}

function generateEmail() {
  return `${generateUsername()}@kraveai.xyz`;
}

// Alias por compatibilidad
const generarNombreCompleto = () => {
  const { firstName, lastName } = getRandomName();
  return `${firstName} ${lastName}`;
};

const generarNombreUsuario = () => generateUsername();

export {
  getRandomName,
  generateRussianName,
  generateUsername,
  generateEmail,
  generarNombreCompleto,
  generarNombreUsuario
};
