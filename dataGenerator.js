const { faker } = require('@faker-js/faker/locale/es_MX');

module.exports.generarDatosUsuario = () => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const username = faker.internet.userName({ 
    firstName, 
    lastName 
  }).toLowerCase().replace(/[^a-z0-9_\.]/g, '');

  // Subdominios aleatorios
  const subdominios = ['', 'mail.', 'in.', 'web.', 'app.']; 
  const dominio = 'kraveapi.xyz';
  
  return {
    nombre: `${firstName} ${lastName}`,
    username,
    email: `${username}@${subdominios[Math.floor(Math.random() * subdominios.length)]}${dominio}`,
    password: faker.internet.password({ 
      length: 16, 
      memorable: false, 
      pattern: /[a-zA-Z0-9!@#$%^&*]/ 
    })
  };
};
