
// Manually declare cloudinary if missing
declare module 'cloudinary' {
    export const v2: any;
    export interface UploadApiErrorResponse {
        message: string;
        [key: string]: any;
    }
}

// Manually declare multer if missing/unresolvable
declare module 'multer' {
    import * as express from 'express';

    interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
    }

    interface Multer {
        (options?: any): any;
        memoryStorage(): any;
        diskStorage(options: any): any;
        MulterError: any;
    }

    const multer: Multer;
    export = multer;

    namespace multer {
        export interface FileFilterCallback {
            (error: Error | null, acceptFile: boolean): void;
            (error: Error | null): void;
        }
        export type File = File; // Export File type
    }
}

// Global Express Augmentation
declare global {
    namespace Express {
        // Fix for Express.Multer.File usage in codebase
        namespace Multer {
            interface File {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                destination: string;
                filename: string;
                path: string;
                buffer: Buffer;
            }
        }

        interface Request {
            file?: Multer.File;
            files?: Multer.File[] | { [fieldname: string]: Multer.File[] } | any; // allow any for flexibility
            user?: {
                userId: string;
                id?: string;
                [key: string]: any;
            };
        }
    }
}
