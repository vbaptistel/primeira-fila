import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

type RequestWithTrace = FastifyRequest & {
  traceId?: string;
};

@Catch()
export class TraceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TraceExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== "http") {
      throw exception;
    }

    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithTrace>();
    const response = context.getResponse<FastifyReply>();
    const traceId = request.traceId ?? randomUUID();

    const status = this.resolveStatus(exception);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception [${traceId}]: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined
      );
    }

    const payload = this.resolvePayload(exception, status, traceId);

    response.header("x-request-id", traceId);
    response.status(status).send(payload);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolvePayload(exception: unknown, status: number, traceId: string) {
    const fallbackMessage =
      status === HttpStatus.INTERNAL_SERVER_ERROR ? "Erro interno do servidor." : "Falha na requisicao.";

    if (!(exception instanceof HttpException)) {
      return {
        code: "INTERNAL_SERVER_ERROR",
        message: fallbackMessage,
        details: undefined,
        trace_id: traceId
      };
    }

    const response = exception.getResponse();
    let code = this.defaultCode(status);
    let message = fallbackMessage;
    let details: unknown;

    if (typeof response === "string") {
      message = response;
    } else if (typeof response === "object" && response !== null) {
      const body = response as Record<string, unknown>;
      if (typeof body.code === "string") {
        code = body.code;
      }

      if (Array.isArray(body.message)) {
        message = "Erro de validacao.";
        details = {
          validationErrors: body.message
        };
      } else if (typeof body.message === "string") {
        message = body.message;
      }

      if ("details" in body) {
        details = body.details;
      }
    }

    return {
      code,
      message,
      details,
      trace_id: traceId
    };
  }

  private defaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "AUTH_INVALID_TOKEN";
      case HttpStatus.FORBIDDEN:
        return "AUTH_FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.GONE:
        return "RESOURCE_GONE";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }
}
