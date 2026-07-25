declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    STAFF_PIN: string;
    STAFF_SESSION_SECRET: string;
  }
}
