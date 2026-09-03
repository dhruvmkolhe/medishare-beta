/**
 * MediShare Application Analytics & Telemetry
 * 
 * TODO: Configure your analytics provider:
 * 1. For Google Analytics 4: Add VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX" to your .env file
 * 2. For Plausible: Set data-domain on the script tag in index.html
 * 3. By default, events are logged to the console in development and respect cookie consent.
 */

const COOKIE_CONSENT_KEY = 'medishare_cookie_consent';

export function hasAnalyticsConsent(): boolean {
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    // If user explicitly chose "essential", don't track
    return consent === 'all';
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(consent: 'all' | 'essential') {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, consent);
    if (consent === 'all') {
      initAnalytics();
    }
  } catch (err) {
    console.error('Failed to save cookie consent', err);
  }
}

export function getAnalyticsConsent(): 'all' | 'essential' | null {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) as 'all' | 'essential' | null;
  } catch {
    return null;
  }
}

export function initAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId || typeof window === 'undefined' || !hasAnalyticsConsent()) {
    return;
  }

  // Inject GA4 script tag if configured
  if (!document.getElementById('ga4-script')) {
    const script = document.createElement('script');
    script.id = 'ga4-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId, { anonymize_ip: true });
  }
}

export function trackPageView(path: string, title?: string) {
  if (typeof window === 'undefined') return;

  const resolvedTitle = title || document.title;

  if (import.meta.env.DEV) {
    console.info(`[Analytics:PageView] ${path} - "${resolvedTitle}"`);
  }

  if (!hasAnalyticsConsent()) return;

  if ((window as any).gtag && import.meta.env.VITE_GA_MEASUREMENT_ID) {
    (window as any).gtag('event', 'page_view', {
      page_path: path,
      page_title: resolvedTitle,
    });
  }
}

export function track404(attemptedPath: string) {
  if (typeof window === 'undefined') return;

  if (import.meta.env.DEV) {
    console.warn(`[Analytics:404] Missing path requested: ${attemptedPath}`);
  }

  if (!hasAnalyticsConsent()) return;

  if ((window as any).gtag && import.meta.env.VITE_GA_MEASUREMENT_ID) {
    (window as any).gtag('event', 'page_not_found', {
      event_category: 'error',
      event_label: attemptedPath,
      non_interaction: true,
    });
  }
}

export function trackCTA(ctaName: string, properties: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;

  if (import.meta.env.DEV) {
    console.info(`[Analytics:CTA] "${ctaName}"`, properties);
  }

  if (!hasAnalyticsConsent()) return;

  if ((window as any).gtag && import.meta.env.VITE_GA_MEASUREMENT_ID) {
    (window as any).gtag('event', ctaName, {
      event_category: 'cta_click',
      ...properties,
    });
  }
}
