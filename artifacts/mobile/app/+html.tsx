import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML template for the Expo web build.
 * Sets lang="pt-BR" and notranslate to prevent Chrome from
 * auto-translating the Portuguese UI to wrong/garbled text.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Disable Chrome auto-translate — the app is already in pt-BR */}
        <meta name="google" content="notranslate" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
