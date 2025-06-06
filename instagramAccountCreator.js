async function createMultipleAccounts(count, page) {
  const accounts = [];
  for (let i = 0; i < count; i++) {
    try {
      await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Aquí debes implementar la lógica para crear una cuenta
      // Por ejemplo: llenar formularios con email, nombre, contraseña, etc.
      // Esto dependerá de la estructura de la página de Instagram y tus necesidades
      const email = `test${Date.now()}${i}@example.com`; // Ejemplo de email único
      const username = `testuser${Date.now()}${i}`;
      const password = 'SecurePass123!';

      await page.type('input[name="email"]', email);
      await page.type('input[name="username"]', username);
      await page.type('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

      accounts.push({ email, username, password });
    } catch (err) {
      console.error('Error creando cuenta:', err);
      continue;
    }
  }
  return accounts;
}

module.exports = { createMultipleAccounts };