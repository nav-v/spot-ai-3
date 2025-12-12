import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface InstagramEmbedProps {
  url: string;
}

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

export const InstagramEmbed = ({ url }: InstagramEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Clean URL - ensure it's a proper Instagram post/reel URL
    const cleanUrl = url.split('?')[0]; // Remove query params

    // Load Instagram embed script
    const loadScript = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = '//www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        }
        setIsLoading(false);
      };
      script.onerror = () => {
        setLoadError(true);
        setIsLoading(false);
      };
      document.body.appendChild(script);
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(loadScript, 100);

    return () => clearTimeout(timer);
  }, [url]);

  // Re-process embeds when URL changes
  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [url]);

  const cleanUrl = url.split('?')[0];

  if (loadError) {
    // Fallback to link button if embed fails
    return (
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl hover:opacity-90 transition-opacity"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
        View on Instagram
        <ExternalLink className="w-4 h-4" />
      </a>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {isLoading && (
        <div className="flex items-center justify-center py-8 bg-secondary/30 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={cleanUrl}
        data-instgrm-version="14"
        style={{
          background: '#FFF',
          border: 0,
          borderRadius: '12px',
          boxShadow: '0 0 1px 0 rgba(0,0,0,0.5), 0 1px 10px 0 rgba(0,0,0,0.15)',
          margin: '0',
          maxWidth: '100%',
          minWidth: '280px',
          padding: 0,
          width: '100%',
        }}
      >
        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View this post on Instagram
        </a>
      </blockquote>
    </div>
  );
};

