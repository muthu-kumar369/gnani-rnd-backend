import helmet from 'helmet';
import { Application } from 'express';

export const configureSecurityMiddleware = (app: Application) => {
    // Use Helmet to set secure HTTP headers
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // Custom CSP configuration if needed (example)
    // app.use(
    //     helmet.contentSecurityPolicy({
    //         directives: {
    //             defaultSrc: ["'self'"],
    //             scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust based on needs
    //             styleSrc: ["'self'", "'unsafe-inline'"],
    //             imgSrc: ["'self'", "data:", "https:"],
    //         },
    //     })
    // );
};
