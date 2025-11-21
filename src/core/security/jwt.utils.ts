// src/core/security/jwt.utils.ts
import jwt, { SignOptions } from 'jsonwebtoken';

// Placeholder for JWT utility functions
class JwtUtils {
    private secret: string;

    constructor(secret: string) {
        this.secret = secret;
    }

    generateToken(payload: object, expiresIn: string = '1h'): string {
        const options: SignOptions = { expiresIn: expiresIn as any };
        return jwt.sign(payload, this.secret, options);
    }

    verifyToken(token: string): any {
        return jwt.verify(token, this.secret);
    }
}

export default JwtUtils;