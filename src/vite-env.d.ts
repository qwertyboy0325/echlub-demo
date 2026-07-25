/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHIKI_PACK_MODE?: "public" | "live-collab";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
