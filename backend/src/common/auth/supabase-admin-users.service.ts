import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppRole } from "./auth.types";

export type CreateUserInput = {
  email: string;
  password: string;
  role: AppRole;
  tenantId: string;
  displayName?: string;
};

export type UpdateUserMetadataInput = {
  role?: AppRole;
  tenantId?: string;
  displayName?: string;
};

export type CreatedUser = {
  id: string;
  email: string | undefined;
  role: string;
  tenantId: string;
  displayName?: string;
};

@Injectable()
export class SupabaseAdminUsersService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new UnauthorizedException(
          "Configuracao Supabase Admin ausente. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
        );
      }
      this.client = createClient(url, key, { auth: { persistSession: false } });
    }
    return this.client;
  }

  async createUser(input: CreateUserInput): Promise<CreatedUser> {
    const supabase = this.getClient();
    const appMetadata: Record<string, unknown> = {
      role: input.role,
      tenant_id: input.tenantId
    };
    const userMetadata: Record<string, unknown> = {};
    if (input.displayName?.trim()) {
      userMetadata.full_name = input.displayName.trim();
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: appMetadata,
      ...(Object.keys(userMetadata).length > 0 && { user_metadata: userMetadata })
    });

    if (error) {
      if (error.message?.includes("already been registered") || error.message?.toLowerCase().includes("already exists")) {
        throw new ConflictException("Usuario com este email ja existe.");
      }
      throw new ConflictException(error.message ?? "Erro ao criar usuario.");
    }

    if (!data.user) {
      throw new ConflictException("Usuario nao retornado pelo Supabase.");
    }

    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: input.role,
      tenantId: input.tenantId,
      displayName: input.displayName?.trim()
    };
  }

  async updateUserMetadata(userId: string, input: UpdateUserMetadataInput): Promise<void> {
    const supabase = this.getClient();
    const appMetadata: Record<string, unknown> = {};
    if (input.role !== undefined) appMetadata.role = input.role;
    if (input.tenantId !== undefined) appMetadata.tenant_id = input.tenantId;
    const userMetadata: Record<string, unknown> = {};
    if (input.displayName !== undefined) userMetadata.full_name = input.displayName.trim();

    if (Object.keys(appMetadata).length === 0 && Object.keys(userMetadata).length === 0) {
      return;
    }

    const payload: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } = {};
    if (Object.keys(appMetadata).length > 0) payload.app_metadata = appMetadata;
    if (Object.keys(userMetadata).length > 0) payload.user_metadata = userMetadata;

    const { error } = await supabase.auth.admin.updateUserById(userId, payload);

    if (error) {
      throw new ConflictException(error.message ?? "Erro ao atualizar usuario.");
    }
  }
}
