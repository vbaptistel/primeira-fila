import { Global, Module } from "@nestjs/common";
import { MagicLinkTokenService } from "./magic-link-token.service";

@Global()
@Module({
  providers: [MagicLinkTokenService],
  exports: [MagicLinkTokenService]
})
export class MagicLinkModule {}
