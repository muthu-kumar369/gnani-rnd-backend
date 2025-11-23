// src/utils/crypto.util.ts
import crypto from 'crypto';

class CryptoUtil {
    // Hashes a string using SHA256
    static hashSha256(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Generates a random string of specified length
    static generateRandomString(length: number): string {
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }

    // Compares a plaintext string with a SHA256 hash
    static compareSha256(plaintext: string, hash: string): boolean {
        return CryptoUtil.hashSha256(plaintext) === hash;
    }
}

export default CryptoUtil;