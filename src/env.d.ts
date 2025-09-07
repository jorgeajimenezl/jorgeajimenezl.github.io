interface ImportMetaEnv {
  readonly PUBLIC_API_BASE?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_TURNSTILE_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
