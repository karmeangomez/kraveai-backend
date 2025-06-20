// nombre_utils.js

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
  'feliz', 'amable', 'creativo', 'brillante', 'valiente', 'calmado', 'divertido', 'honesto',
  'fuerte', 'rápido', 'tranquilo', 'auténtico', 'libre', 'inquieto', 'curioso', 'atrevido'
];

const sustantivos = [
  'sol', 'luna', 'cielo', 'mar', 'rio', 'montaña', 'estrella', 'viento',
  'fuego', 'tierra', 'nube', 'noche', 'aurora', 'bosque', 'trueno', 'lluvia'
];

module.exports = {
  generar_nombre: () => {
    const nombre = nombres[Math.floor(Math.random() * nombres.length)];
    const apellido1 = apellidos[Math.floor(Math.random() * apellidos.length)];
    const apellido2 = apellidos[Math.floor(Math.random() * apellidos.length)];
    return `${nombre} ${apellido1} ${apellido2}`;
  },

  generar_usuario: () => {
    const nombre = nombres[Math.floor(Math.random() * nombres.length)].toLowerCase();
    const adjetivo = adjetivos[Math.floor(Math.random() * adjetivos.length)];
    const sustantivo = sustantivos[Math.floor(Math.random() * sustantivos.length)];
    const numero = Math.floor(Math.random() * 99999);
    return `${nombre}_${adjetivo}_${sustantivo}${numero}`;
  }
};
