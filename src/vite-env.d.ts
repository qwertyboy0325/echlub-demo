/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHIKI_PACK_MODE?: "public" | "live-collab";
  readonly VITE_PRESENTER_MODE?: "true" | "1" | "0" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
