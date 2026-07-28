declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MEDIA: R2Bucket;
    STAFF_PIN: string;
    STAFF_SESSION_SECRET: string;
    POS_BRIDGE_SECRET: string;
  }
}
