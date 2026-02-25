import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'InternalServerError';

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const res = exception.getResponse() as any;
            message = typeof res === 'string' ? res : res.message || res;
            error = exception.name;
        } else if (exception?.code === 'P2002') {
            // Prisma: Unique constraint failed
            statusCode = HttpStatus.CONFLICT;
            message = 'Ya existe un registro con este valor único';
            error = 'Conflict';
        } else if (exception?.code === 'P2025') {
            // Prisma: Record to update not found
            statusCode = HttpStatus.NOT_FOUND;
            message = 'Recurso no encontrado';
            error = 'Not Found';
        } else {
            // Fallback for unexpected errors
            this.logger.error(`[${request.method}] ${request.url}`, exception?.stack);
            message = exception?.message || message;
        }

        response.status(statusCode).json({
            statusCode,
            message,
            error,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
