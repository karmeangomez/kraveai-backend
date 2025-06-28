// ... importaciones ...

async function main() {
  try {
    // ⭐ 1. Crear instancia de UltimateProxyMaster
    const proxySystem = new UltimateProxyMaster();
    
    // ⭐ 2. Inicializar el sistema de proxies
    await proxySystem.initialize();
    
    console.log('✅ Sistema de proxies listo\n');
    
    for (let i = 1; i <= TOTAL_CUENTAS; i++) {
      console.log(chalk.blue(`🚀 Creando cuenta ${i}/${TOTAL_CUENTAS}`));

      // ⭐ 3. Obtener proxy usando el sistema heredado
      const proxy = proxySystem.getNextProxy();
      
      if (!proxy) {
        console.error(`❌ Sin proxies válidos disponibles. Deteniendo.`);
        break;
      }

      try {
        const cuenta = await crearCuentaInstagram(proxy);
        
        if (cuenta?.usuario && cuenta?.password) {
          creadas++;
          AccountManager.addAccount(cuenta);
          console.log(chalk.green(`✅ Cuenta creada: @${cuenta.usuario}`));
        } else {
          throw new Error('Cuenta inválida');
        }
      } catch (error) {
        errores++;
        console.log(chalk.red(`🔥 Error creando cuenta #${i}: ${error.message || error}`));
        
        // ⭐ 4. Marcar proxy como malo
        proxySystem.markProxyAsBad(proxy);

        if (errores >= MAX_ERRORES) {
          console.log(chalk.bgRed(`🛑 Se alcanzaron ${errores} errores. Deteniendo producción.`));
          await notifyTelegram(`❌ Detenido tras ${errores} errores. Se crearon ${creadas} cuentas.`);
          break;
        }
      }
    }
    
    // ... resto del código ...
  } catch (error) {
    console.error('❌ Error general:', error);
    await notifyTelegram(`❌ Error crítico: ${error.message}`);
  }
}

// Iniciar la aplicación
main();
