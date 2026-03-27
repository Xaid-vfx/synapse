import { useEffect } from 'react';

const DEFAULT_DESCRIPTION =
  'Connect your X account, sync followers, and search with semantic AI enrichment. Understand your audience with Synapse.';

type Props = {
  title: string;
  description?: string;
};

export default function Seo({ title, description = DEFAULT_DESCRIPTION }: Props) {
  useEffect(() => {
    document.title = title;
    const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
      const el = document.querySelector(`${selector}[${attr}="${key}"]`);
      if (el) el.setAttribute('content', value);
    };
    setMeta('meta', 'name', 'description', description);
    setMeta('meta', 'name', 'title', title);
    setMeta('meta', 'property', 'og:title', title);
    setMeta('meta', 'property', 'og:description', description);
    setMeta('meta', 'name', 'twitter:title', title);
    setMeta('meta', 'name', 'twitter:description', description);
  }, [title, description]);

  return null;
}
