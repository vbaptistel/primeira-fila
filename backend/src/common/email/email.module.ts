import { Global, Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { resendProvider } from "./resend.provider";

@Global()
@Module({
  providers: [resendProvider, EmailService],
  exports: [EmailService]
})
export class EmailModule {}
