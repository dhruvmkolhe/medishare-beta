import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

interface PageMetaProps {
  title: string;
  description?: string;
  canonicalPath?: string;
}

export default function PageMeta({ title, description, canonicalPath }: PageMetaProps) {
  const location = useLocation();

  useEffect(() => {
    // 1. Update Document Title
    const baseTitle = 'MediShare';
    const fullTitle = title ? `${title} | ${baseTitle}` : 'MediShare — Privacy-Preserving Digital Prescription Credentials';
    document.title = fullTitle;

    // 2. Update or create Meta Description
    if (description) {
      let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }

    // 3. Update or create Canonical Link
    const path = canonicalPath || location.pathname;
    const origin = window.location.origin;
    const fullUrl = `${origin}${path === '/' ? '' : path}`;

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = fullUrl;

    // 4. Update Open Graph Tags
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = fullTitle;

    if (description) {
      const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
      if (ogDesc) ogDesc.content = description;
    }

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = fullUrl;

    // 5. Update Twitter Card Tags
    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.content = fullTitle;

    if (description) {
      const twitterDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
      if (twitterDesc) twitterDesc.content = description;
    }

    // 6. Track Page View in Analytics
    trackPageView(path, fullTitle);
  }, [title, description, canonicalPath, location.pathname]);

  return null;
}
