import { describe, it, expect, beforeEach, vi } from "vitest";
import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { lastValueFrom } from "rxjs";
import { TraceLoggingInterceptor } from "./trace-logging.interceptor";

function createMockContext(overrides?: {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  type?: string;
}) {
  const responseHeaders: Record<string, string> = {};
  const request = {
    headers: overrides?.headers ?? {},
    method: overrides?.method ?? "GET",
    url: overrides?.url ?? "/v1/events",
    log: {
      info: vi.fn(),
      error: vi.fn()
    },
    traceId: undefined as string | undefined
  };
  const response = {
    statusCode: 200,
    header: vi.fn((key: string, value: string) => {
      responseHeaders[key] = value;
    })
  };

  const context = {
    getType: () => overrides?.type ?? "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as unknown as ExecutionContext;

  return { context, request, response, responseHeaders };
}

function createMockCallHandler(value?: unknown): CallHandler {
  return {
    handle: () => of(value ?? { ok: true })
  };
}

function createErrorCallHandler(error: Error): CallHandler {
  return {
    handle: () => throwError(() => error)
  };
}

describe("TraceLoggingInterceptor", () => {
  let interceptor: TraceLoggingInterceptor;

  beforeEach(() => {
    interceptor = new TraceLoggingInterceptor();
  });

  it("deve gerar trace-id quando nenhum header fornecido", async () => {
    const { context, request, response } = createMockContext();
    const next = createMockCallHandler();

    await lastValueFrom(interceptor.intercept(context, next));

    expect(request.traceId).toBeTruthy();
    expect(typeof request.traceId).toBe("string");
    expect(response.header).toHaveBeenCalledWith("x-request-id", request.traceId);
  });

  it("deve reutilizar trace-id do header x-request-id", async () => {
    const { context, request } = createMockContext({
      headers: { "x-request-id": "trace-from-client" }
    });
    const next = createMockCallHandler();

    await lastValueFrom(interceptor.intercept(context, next));

    expect(request.traceId).toBe("trace-from-client");
  });

  it("deve reutilizar trace-id do header x-trace-id quando x-request-id ausente", async () => {
    const { context, request } = createMockContext({
      headers: { "x-trace-id": "trace-from-gateway" }
    });
    const next = createMockCallHandler();

    await lastValueFrom(interceptor.intercept(context, next));

    expect(request.traceId).toBe("trace-from-gateway");
  });

  it("deve adicionar trace-id no header de resposta", async () => {
    const { context, response } = createMockContext({
      headers: { "x-request-id": "my-trace-id" }
    });
    const next = createMockCallHandler();

    await lastValueFrom(interceptor.intercept(context, next));

    expect(response.header).toHaveBeenCalledWith("x-request-id", "my-trace-id");
  });

  it("deve logar request_started e request_completed em caso de sucesso", async () => {
    const { context, request } = createMockContext();
    const next = createMockCallHandler();

    await lastValueFrom(interceptor.intercept(context, next));

    expect(request.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "request_started" }),
      "request_started"
    );
    expect(request.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "request_completed" }),
      "request_completed"
    );
  });

  it("deve logar request_failed em caso de erro e re-lancar a excecao", async () => {
    const { context, request } = createMockContext();
    const error = new Error("Algo falhou");
    const next = createErrorCallHandler(error);

    await expect(
      lastValueFrom(interceptor.intercept(context, next))
    ).rejects.toThrow("Algo falhou");

    expect(request.log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "request_failed",
        error_name: "Error",
        error_message: "Algo falhou"
      }),
      "request_failed"
    );
  });

  it("deve repassar chamada sem interceptar quando tipo nao e http", async () => {
    const { context } = createMockContext({ type: "rpc" });
    const next = createMockCallHandler({ data: "rpc-response" });

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({ data: "rpc-response" });
  });
});
