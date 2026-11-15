/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="astro/astro-jsx" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly SSR: boolean;
  readonly BASE_URL: string;
  readonly SITE?: string;
  readonly PUBLIC_SANITY_PROJECT_ID?: string;
  readonly PUBLIC_SANITY_DATASET?: string;
  readonly PUBLIC_SITE_ORIGIN?: string;
  readonly PUBLIC_NOINDEX?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace JSX {
  interface IntrinsicElements extends astroHTML.JSX.IntrinsicElements {}
}

type AstroJsxRuntime = {
  Fragment: unknown;
  jsx: (type: unknown, props?: Record<string, unknown>, key?: string | number) => unknown;
  jsxs: (type: unknown, props?: Record<string, unknown>, key?: string | number) => unknown;
  jsxDEV: (type: unknown, props?: Record<string, unknown>, key?: string | number) => unknown;
  JSX: typeof astroHTML.JSX;
};

declare module 'astro/jsx-runtime' {
  export const Fragment: AstroJsxRuntime['Fragment'];
  export const jsx: AstroJsxRuntime['jsx'];
  export const jsxs: AstroJsxRuntime['jsxs'];
  export const jsxDEV: AstroJsxRuntime['jsxDEV'];
  export import JSX = astroHTML.JSX;
}

declare module 'astro/jsx-dev-runtime' {
  export const Fragment: AstroJsxRuntime['Fragment'];
  export const jsx: AstroJsxRuntime['jsx'];
  export const jsxs: AstroJsxRuntime['jsxs'];
  export const jsxDEV: AstroJsxRuntime['jsxDEV'];
  export import JSX = astroHTML.JSX;
}
