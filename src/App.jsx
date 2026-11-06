import { useEffect, useState } from 'react';

function loadLegacyHead(legacyDocument) {
  const head = Array.from(legacyDocument.head.children);
  return head.reduce(
    (chain, node) =>
      chain.then(
        () =>
          new Promise((resolve, reject) => {
            if (node.tagName === 'SCRIPT') {
              const element = document.createElement('script');
              for (const attribute of node.attributes) {
                element.setAttribute(attribute.name, attribute.value);
              }
              element.textContent = node.textContent;
              if (node.src) {
                element.onload = resolve;
                element.onerror = () => reject(new Error(`Unable to load ${node.src}`));
              }
              document.head.appendChild(element);
              if (!node.src) resolve();
            } else {
              const element = document.importNode(node, false);
              document.head.appendChild(element);
              resolve();
            }
          }),
      ),
    Promise.resolve(),
  );
}

export default function App() {
  const [markup, setMarkup] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadApplication() {
      try {
        const response = await fetch('/legacy.html');
        if (!response.ok) throw new Error(`Unable to load application (${response.status})`);
        const source = await response.text();
        const legacyDocument = new DOMParser().parseFromString(source, 'text/html');
        await loadLegacyHead(legacyDocument);
        document.documentElement.className = legacyDocument.documentElement.className;
        document.body.className = legacyDocument.body.className;
        if (active) setMarkup(legacyDocument.body.innerHTML);
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }

    loadApplication();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (markup === null) return undefined;
    const script = document.createElement('script');
    script.src = '/js/app.js';
    script.onerror = () => setError('Unable to load application interactions.');
    document.body.appendChild(script);
    return () => script.remove();
  }, [markup]);

  if (error) return <p role="alert">{error}</p>;
  if (markup === null) return <p role="status">Loading LostConnect…</p>;
  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
