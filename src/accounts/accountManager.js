export default class AccountManager {
    static accounts = [];
    
    static addAccount(account) {
        this.accounts.push(account);
    }
    
    static getAccounts() {
        return this.accounts;
    }
    
    static clearAccounts() {
        this.accounts = [];
    }
}
