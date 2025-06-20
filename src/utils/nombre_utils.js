export const nombres = [
  'Carlos', 'María', 'Juan', 'Ana', 'Luis', 'Laura', 'Pedro', 'Sofía', 'Javier', 'Elena',
  'Andrés', 'Paola', 'Héctor', 'Gabriela', 'Fernando', 'Valeria', 'Daniel', 'Camila', 'Esteban', 'Natalia',
  'Eduardo', 'Lucía', 'Mateo', 'Renata', 'Emilio', 'Daniela', 'José', 'Carolina', 'Santiago', 'Andrea'
];

export const apellidos = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Cruz', 'Ortiz', 'Morales', 'Jiménez', 'Mendoza', 'Castillo', 'Silva', 'Ruiz'
];

export const adjetivos = [
  'feliz', 'amable', 'creativo', 'brillante', 'valiente', 'calmado', 'divertido', 'honesto',
  'fuerte', 'rápido', 'tranquilo', 'auténtico', 'libre', 'inquieto', 'curioso', 'atrevido'
];

export const sustantivos = [
  'sol', 'luna', 'cielo', 'mar', 'rio', 'montaña', 'estrella', 'viento',
  'fuego', 'tierra', 'nube', 'noche', 'aurora', 'bosque', 'trueno', 'lluvia'
];

export function generarNombreCompleto() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido1 = apellidos[Math.floor(Math.random() * apellidos.length)];
  const apellido2 = apellidos[Math.floor(Math.random() * apellidos.length)];
  return `${nombre} ${apellido1} ${apellido2}`;
}

export function generarNombreUsuario() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)].toLowerCase();
  const adjetivo = adjetivos[Math.floor(Math.random() * adjetivos.length)];
  const sustantivo = sustantivos[Math.floor(Math.random() * sustantivos.length)];
  const numero = Math.floor(Math.random() * 99999);
  return `${nombre}_${adjetivo}_${sustantivo}${numero}`.replace(/\s+/g, '');
}

export function generarEmail(username) {
  const dominios = ['gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com'];
  const dominio = dominios[Math.floor(Math.random() * dominios.length)];
  return `${username}@${dominio}`.toLowerCase().replace(/\s+/g, '');
}
