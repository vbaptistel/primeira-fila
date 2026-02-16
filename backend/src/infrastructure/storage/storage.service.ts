
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

/** Bucket no Supabase Storage para logos/favicons de tenant. Deve existir no projeto e estar público para leitura. */
const BUCKET_TENANT_ASSETS = "tenant-assets";

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private supabase: SupabaseClient;
    private readonly bucketName = BUCKET_TENANT_ASSETS;

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.getOrThrow<string>("SUPABASE_URL");
        const supabaseKey = this.configService.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY");

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async uploadFile(file: Buffer, mimeType: string, folder: string): Promise<string> {
        const extension = this.getExtensionFromMimeType(mimeType);
        const filename = `${folder}/${randomUUID()}${extension}`;

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(filename, file, {
                contentType: mimeType,
                upsert: false,
            });

        if (error) {
            this.logger.error(`Storage upload failed (bucket=${this.bucketName}): ${error.message}`, error);
            throw new Error(
                `Falha ao enviar arquivo: ${error.message}. Verifique se o bucket "${this.bucketName}" existe no Supabase Storage e se SUPABASE_SERVICE_ROLE_KEY está correta.`
            );
        }

        const { data: publicUrlData } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(filename);

        return publicUrlData.publicUrl;
    }

    private getExtensionFromMimeType(mimeType: string): string {
        switch (mimeType) {
            case 'image/jpeg': return '.jpg';
            case 'image/png': return '.png';
            case 'image/webp': return '.webp';
            case 'image/gif': return '.gif';
            case 'image/svg+xml': return '.svg';
            default: return extname(mimeType) || '';
        }
    }
}
