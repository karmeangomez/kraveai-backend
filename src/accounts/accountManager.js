export default class AccountManager {
    static accounts = [];
    
    static addAccount(account) {
        this.accounts.push(account);
        console.log(`✅ Cuenta añadida: ${account.username || account.email}`);
    }
    
    static getAccounts() {
        return [...this.accounts]; // Devuelve copia para evitar modificaciones externas
    }
    
    static clearAccounts() {
        console.log(`🧹 Limpiando ${this.accounts.length} cuentas...`);
        this.accounts = [];
    }
    
    static getAccountById(id) {
        return this.accounts.find(acc => acc.id === id);
    }
}
