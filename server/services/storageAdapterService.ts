import fs from "fs";
import path from "path";

export interface StorageAdapter {
  save(fileBuffer: Buffer, key: string, mimeType: string): Promise<string>; // returns URL/path
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

// ---------------------------------------------------------------------------
// LocalStorageAdapter — saves files to ./uploads/ on disk
// ---------------------------------------------------------------------------
export class LocalStorageAdapter implements StorageAdapter {
  private readonly uploadDir: string;

  constructor(uploadDir = "./uploads") {
    this.uploadDir = uploadDir;
    // Ensure the directory exists at startup
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async save(fileBuffer: Buffer, key: string, _mimeType: string): Promise<string> {
    // Sanitize the key to prevent path traversal
    const safeName = path.basename(key);
    const filePath = path.join(this.uploadDir, safeName);
    fs.writeFileSync(filePath, fileBuffer);
    return filePath;
  }

  async get(key: string): Promise<Buffer> {
    const safeName = path.basename(key);
    const filePath = path.join(this.uploadDir, safeName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    return fs.readFileSync(filePath);
  }

  async delete(key: string): Promise<void> {
    const safeName = path.basename(key);
    const filePath = path.join(this.uploadDir, safeName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Local adapter does not support real signed URLs — returns the file path directly.
   * In a production environment backed by S3 or similar, this would return a
   * time-limited pre-signed URL.
   */
  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    const safeName = path.basename(key);
    return path.join(this.uploadDir, safeName);
  }
}

// ---------------------------------------------------------------------------
// S3StorageAdapter — stub implementation
// To implement, install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
// ---------------------------------------------------------------------------
export class S3StorageAdapter implements StorageAdapter {
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET environment variable is required for S3StorageAdapter");
    }
    this.bucket = bucket;

    // TODO: Initialize the S3 client here:
    //   import { S3Client } from "@aws-sdk/client-s3";
    //   this.s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    console.warn("[S3StorageAdapter] S3 stub initialized — methods will throw until implemented");
  }

  async save(_fileBuffer: Buffer, _key: string, _mimeType: string): Promise<string> {
    // TODO: Implement with @aws-sdk/client-s3:
    //   import { PutObjectCommand } from "@aws-sdk/client-s3";
    //   await this.s3.send(new PutObjectCommand({
    //     Bucket: this.bucket,
    //     Key: _key,
    //     Body: _fileBuffer,
    //     ContentType: _mimeType,
    //   }));
    //   return `https://${this.bucket}.s3.amazonaws.com/${_key}`;
    throw new Error("S3StorageAdapter.save() is not yet implemented. See TODO comments.");
  }

  async get(_key: string): Promise<Buffer> {
    // TODO: Implement with @aws-sdk/client-s3:
    //   import { GetObjectCommand } from "@aws-sdk/client-s3";
    //   const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: _key }));
    //   const stream = response.Body as NodeJS.ReadableStream;
    //   return new Promise((resolve, reject) => { ... });
    throw new Error("S3StorageAdapter.get() is not yet implemented. See TODO comments.");
  }

  async delete(_key: string): Promise<void> {
    // TODO: Implement with @aws-sdk/client-s3:
    //   import { DeleteObjectCommand } from "@aws-sdk/client-s3";
    //   await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: _key }));
    throw new Error("S3StorageAdapter.delete() is not yet implemented. See TODO comments.");
  }

  async getSignedUrl(_key: string, _expiresInSeconds = 3600): Promise<string> {
    // TODO: Implement with @aws-sdk/s3-request-presigner:
    //   import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
    //   import { GetObjectCommand } from "@aws-sdk/client-s3";
    //   return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: _key }), {
    //     expiresIn: _expiresInSeconds,
    //   });
    throw new Error("S3StorageAdapter.getSignedUrl() is not yet implemented. See TODO comments.");
  }
}

// ---------------------------------------------------------------------------
// Factory — selects adapter based on environment
// ---------------------------------------------------------------------------
export function createStorageAdapter(): StorageAdapter {
  if (process.env.AWS_S3_BUCKET) {
    console.log("[storageAdapterService] Using S3StorageAdapter");
    return new S3StorageAdapter();
  }
  console.log("[storageAdapterService] Using LocalStorageAdapter (./uploads)");
  return new LocalStorageAdapter();
}

export const fileStorage = createStorageAdapter();
