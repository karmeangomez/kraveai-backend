const faker = require('faker/locale/es_MX');

module.exports.generarDatosUsuario = () => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const username = faker.internet.userName(firstName, lastName)
    .toLowerCase()
    .replace(/[^a-z0-9_\.]/g, '');  // Corregí el regex (faltaba 'g' para reemplazo global)

  // Opciones de subdominios + dominio base
  const subdominios = ['', 'mail.', 'in.', 'web.', 'app.']; 
  const dominio = 'kraveapi.xyz';
  
  // Genera email con subdominio aleatorio
  const subdominio = subdominios[Math.floor(Math.random() * subdominios.length)];
  const email = `${username}@${subdominio}${dominio}`;

  return {
    nombre: `${firstName} ${lastName}`,
    username,
    email,
    password: faker.internet.password(16, false, /[a-zA-Z0-9!@#$%^&*]/)
  };
};
