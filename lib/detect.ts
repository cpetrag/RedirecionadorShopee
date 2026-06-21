export type Detect = {
  inApp: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isBot: boolean;
  platform: 'android' | 'ios' | 'desktop' | 'other';
};

/**
 * Analisa o User-Agent para decidir como entregar o redirect.
 * O único sinal confiável de webview do Instagram/Facebook é o UA.
 */
export function detect(ua: string): Detect {
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Messenger/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isBot =
    /facebookexternalhit|facebot|bot|crawler|spider|preview|curl|wget|HeadlessChrome/i.test(
      ua
    );
  const platform = isAndroid
    ? 'android'
    : isIOS
      ? 'ios'
      : /Macintosh|Windows|Linux/i.test(ua)
        ? 'desktop'
        : 'other';

  return { inApp, isAndroid, isIOS, isBot, platform };
}
