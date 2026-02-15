import { Resend } from "resend";

export const RESEND_CLIENT = Symbol("RESEND_CLIENT");

export const resendProvider = {
  provide: RESEND_CLIENT,
  useFactory: (): Resend => {
    const apiKey = process.env["RESEND_API_KEY"];

    if (!apiKey) {
      throw new Error("Variavel de ambiente RESEND_API_KEY nao configurada.");
    }

    return new Resend(apiKey);
  }
};
