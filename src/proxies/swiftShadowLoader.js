import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

export default class SwiftShadowLoader {
  static get swiftPath() {
    return path.join(__dirname, 'swiftshadow');
  }

  static get outputFile() {
    return path.join(this.swiftPath, 'proxies.txt');
  }

  static refreshProxies() {
    try {
      execSync(`cd ${this.swiftPath} && python3 swiftshadow.py --http --https`, {
        timeout: 120000
      });
      return this.parseProxies();
    } catch (error) {
      console.error('Error SwiftShadow:', error);
      return [];
    }
  }

  static parseProxies() {
    try {
      const data = fs.readFileSync(this.outputFile, 'utf8');
      return data.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          const [ip, port] = line.split(':');
          return `${ip}:${port}`;
        });
    } catch (error) {
      console.error('Error parsing proxies:', error);
      return [];
    }
  }
}
