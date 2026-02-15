import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  GoneException
} from "@nestjs/common";
import { TraceExceptionFilter } from "./trace-exception.filter";

function createMockArgumentsHost(overrides?: {
  traceId?: string;
  type?: string;
}) {
  let sentBody: unknown;
  let sentStatus: number | undefined;
  const responseHeaders: Record<string, string> = {};

  const request = {
    traceId: overrides?.traceId ?? "trace-test-001"
  };
  const response = {
    header: vi.fn((key: string, value: string) => {
      responseHeaders[key] = value;
      return response;
    }),
    status: vi.fn((code: number) => {
      sentStatus = code;
      return response;
    }),
    send: vi.fn((body: unknown) => {
      sentBody = body;
    })
  };

  const host = {
    getType: () => overrides?.type ?? "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as unknown as ArgumentsHost;

  return { host, request, response, getSentBody: () => sentBody, getSentStatus: () => sentStatus, responseHeaders };
}

describe("TraceExceptionFilter", () => {
  let filter: TraceExceptionFilter;

  beforeEach(() => {
    filter = new TraceExceptionFilter();
  });

  it("deve formatar HttpException com trace-id e mensagem correta", () => {
    const { host, getSentBody, getSentStatus } = createMockArgumentsHost({
      traceId: "trace-abc"
    });

    filter.catch(new NotFoundException("Recurso nao encontrado."), host);

    expect(getSentStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(getSentBody()).toEqual({
      code: "NOT_FOUND",
      message: "Recurso nao encontrado.",
      details: undefined,
      trace_id: "trace-abc"
    });
  });

  it("deve tratar erro generico como 500 com mensagem padrao", () => {
    const { host, getSentBody, getSentStatus } = createMockArgumentsHost({
      traceId: "trace-500"
    });

    filter.catch(new Error("Erro inesperado"), host);

    expect(getSentStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(getSentBody()).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Erro interno do servidor.",
      details: undefined,
      trace_id: "trace-500"
    });
  });

  it("deve mapear BadRequest para code BAD_REQUEST", () => {
    const { host, getSentBody } = createMockArgumentsHost();
    filter.catch(new BadRequestException("Campo invalido."), host);
    expect((getSentBody() as Record<string, unknown>).code).toBe("BAD_REQUEST");
  });

  it("deve mapear Unauthorized para code AUTH_INVALID_TOKEN", () => {
    const { host, getSentBody } = createMockArgumentsHost();
    filter.catch(new UnauthorizedException("Token invalido."), host);
    expect((getSentBody() as Record<string, unknown>).code).toBe("AUTH_INVALID_TOKEN");
  });

  it("deve mapear Forbidden para code AUTH_FORBIDDEN", () => {
    const { host, getSentBody } = createMockArgumentsHost();
    filter.catch(new ForbiddenException("Acesso negado."), host);
    expect((getSentBody() as Record<string, unknown>).code).toBe("AUTH_FORBIDDEN");
  });

  it("deve mapear Conflict para code CONFLICT", () => {
    const { host, getSentBody } = createMockArgumentsHost();
    filter.catch(new ConflictException("Recurso em conflito."), host);
    expect((getSentBody() as Record<string, unknown>).code).toBe("CONFLICT");
  });

  it("deve mapear Gone para code RESOURCE_GONE", () => {
    const { host, getSentBody } = createMockArgumentsHost();
    filter.catch(new GoneException("Recurso expirado."), host);
    expect((getSentBody() as Record<string, unknown>).code).toBe("RESOURCE_GONE");
  });

  it("deve adicionar trace-id no header de resposta", () => {
    const { host, response } = createMockArgumentsHost({
      traceId: "trace-header-check"
    });

    filter.catch(new NotFoundException("Test"), host);

    expect(response.header).toHaveBeenCalledWith("x-request-id", "trace-header-check");
  });

  it("deve formatar validationErrors quando message e array", () => {
    const exception = new BadRequestException({
      message: ["campo1 e obrigatorio", "campo2 deve ser numero"],
      error: "Bad Request",
      statusCode: 400
    });

    const { host, getSentBody } = createMockArgumentsHost();
    filter.catch(exception, host);

    const body = getSentBody() as Record<string, unknown>;
    expect(body.message).toBe("Erro de validacao.");
    expect(body.details).toEqual({
      validationErrors: ["campo1 e obrigatorio", "campo2 deve ser numero"]
    });
  });

  it("deve re-lancar excecao quando tipo nao e http", () => {
    const { host } = createMockArgumentsHost({ type: "rpc" });
    const error = new Error("Erro RPC");

    expect(() => filter.catch(error, host)).toThrow("Erro RPC");
  });
});
