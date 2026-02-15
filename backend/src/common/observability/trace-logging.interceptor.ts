import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { catchError, Observable, tap, throwError } from "rxjs";

type RequestWithTrace = FastifyRequest & {
  traceId?: string;
};

type LoggerLike = {
  info: (payload: Record<string, unknown>, message?: string) => void;
  error: (payload: Record<string, unknown>, message?: string) => void;
};

@Injectable()
export class TraceLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const traceId = this.resolveTraceId(request);
    const startedAt = Date.now();
    const logger = this.getLogger(request);

    request.traceId = traceId;
    response.header("x-request-id", traceId);

    logger.info(
      {
        trace_id: traceId,
        event: "request_started",
        method: request.method,
        path: request.url
      },
      "request_started"
    );

    return next.handle().pipe(
      tap(() => {
        logger.info(
          {
            trace_id: traceId,
            event: "request_completed",
            method: request.method,
            path: request.url,
            status_code: response.statusCode,
            duration_ms: Date.now() - startedAt
          },
          "request_completed"
        );
      }),
      catchError((error: unknown) => {
        logger.error(
          {
            trace_id: traceId,
            event: "request_failed",
            method: request.method,
            path: request.url,
            status_code: response.statusCode,
            duration_ms: Date.now() - startedAt,
            error_name: this.readErrorField(error, "name"),
            error_message: this.readErrorField(error, "message")
          },
          "request_failed"
        );
        return throwError(() => error);
      })
    );
  }

  private resolveTraceId(request: FastifyRequest): string {
    const headerValue = request.headers["x-request-id"] ?? request.headers["x-trace-id"];
    if (Array.isArray(headerValue)) {
      const first = headerValue[0]?.trim();
      if (first) {
        return first;
      }
    } else if (typeof headerValue === "string") {
      const normalized = headerValue.trim();
      if (normalized) {
        return normalized;
      }
    }

    return randomUUID();
  }

  private getLogger(request: FastifyRequest): LoggerLike {
    if (request.log) {
      return request.log as unknown as LoggerLike;
    }

    return {
      info: (payload, message) => {
        console.log(JSON.stringify({ level: "info", msg: message, ...payload }));
      },
      error: (payload, message) => {
        console.error(JSON.stringify({ level: "error", msg: message, ...payload }));
      }
    };
  }

  private readErrorField(error: unknown, field: "name" | "message"): string | undefined {
    if (typeof error !== "object" || error === null || !(field in error)) {
      return undefined;
    }

    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" ? value : undefined;
  }
}
