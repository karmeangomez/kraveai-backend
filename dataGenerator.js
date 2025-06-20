const faker = require('faker/locale/es_MX');

module.exports.generarDatosUsuario = () => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const username = faker.internet.userName(firstName, lastName).toLowerCase().replace(/[^a-z0-9_\.]/, '');
  
  // 50% instaddr, 50% catch-all
  const emailProvider = Math.random() > 0.5 ? 'instaddr.ch' : 'tu-dominio.com';
  const email = `${username}@${emailProvider}`;
  
  return {
    nombre: `${firstName} ${lastName}`,
    username,
    email,
    password: faker.internet.password(16, false, /[a-zA-Z0-9!@#$%^&*]/)
  };
};
