#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function encrypt(text, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', 
    Buffer.from(key, 'hex'), 
    Buffer.from(iv, 'hex')
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encrypted, key, iv) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', 
    Buffer.from(key, 'hex'), 
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      params[key] = args[i + 1];
      i++;
    }
  }
  return params;
}

function main() {
  const params = parseArgs();
  const mode = process.argv[2];
  
  if (mode === 'encrypt' && params.input && params.output && params.key && params.iv) {
    const content = fs.readFileSync(params.input, 'utf8');
    const encrypted = encrypt(content, params.key, params.iv);
    fs.writeFileSync(params.output, encrypted);
    console.log(`🔐 Archivo cifrado: ${params.output}`);
    
  } else if (mode === 'decrypt' && params.input && params.output && params.key && params.iv) {
    const encrypted = fs.readFileSync(params.input, 'utf8');
    const decrypted = decrypt(encrypted, params.key, params.iv);
    fs.writeFileSync(params.output, decrypted);
    console.log(`🔓 Archivo descifrado: ${params.output}`);
    
  } else {
    console.error('Modo inválido. Uso:');
    console.error('  Para cifrar: node secureEnv.js encrypt --input archivo.env --output archivo.enc --key [HEX_KEY] --iv [HEX_IV]');
    console.error('  Para descifrar: node secureEnv.js decrypt --input archivo.enc --output archivo.env --key [HEX_KEY] --iv [HEX_IV]');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
