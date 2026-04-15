import { useEffect, useRef, useState } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { useEditorStore }              from '../store/editorStore';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop : '100%',
  tablet  : '768px',
  mobile  : '390px',
};

const TAILWIND_FONT_SIZE_MAP: Record<string, string> = {
  'text-xs':   '0.75rem',  'text-sm':   '0.875rem', 'text-base': '1rem',
  'text-lg':   '1.125rem', 'text-xl':   '1.25rem',  'text-2xl':  '1.5rem',
  'text-3xl':  '1.875rem', 'text-4xl':  '2.25rem',  'text-5xl':  '3rem',
  'text-6xl':  '3.75rem',  'text-7xl':  '4.5rem',   'text-8xl':  '6rem',
  'text-9xl':  '8rem',
};

const TAILWIND_FONT_WEIGHT_MAP: Record<string, string> = {
  'font-thin':       '100', 'font-extralight': '200', 'font-light':    '300',
  'font-normal':     '400', 'font-medium':     '500', 'font-semibold': '600',
  'font-bold':       '700', 'font-extrabold':  '800', 'font-black':    '900',
};

function buildPreviewHtml(rawHtml: string): string {
  const tailwindScript = `<script src="https://cdn.tailwindcss.com"><\/script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        animation: { marquee: 'marquee 20s linear infinite' },
        keyframes: {
          marquee: {
            '0%':   { transform: 'translateX(0%)' },
            '100%': { transform: 'translateX(-50%)' },
          },
        },
      },
    },
  };
<\/script>`;

  let html = rawHtml
    .replace(/<link[^>]+href=["']\.\/public\/[^"']+["'][^>]*>/gi, '')
    .replace(/<link[^>]+href=["']public\/[^"']+["'][^>]*>/gi, '')
    .replace(/<script[^>]+src=["']\.\/public\/[^"']+["'][^>]*><\/script>/gi, '')
    .replace(/<script[^>]+src=["']public\/[^"']+["'][^>]*><\/script>/gi, '');

  html = html.replace(/<script[^>]+cdn\.tailwindcss\.com[^>]*><\/script>/gi, '');

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${tailwindScript}\n</head>`);
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${tailwindScript}`);
  } else {
    html = `<!DOCTYPE html><html><head>${tailwindScript}</head><body>` + html + '</body></html>';
  }

  const typographyScript = `
<script>
  (function () {
    var FSM = ${JSON.stringify(TAILWIND_FONT_SIZE_MAP)};
    var FWM = ${JSON.stringify(TAILWIND_FONT_WEIGHT_MAP)};
    function applyTypo(el) {
      var classes = (el.className || '').split(' ');
      classes.forEach(function(cls) {
        var base = cls.includes(':') ? cls.split(':').pop() : cls;
        if (FSM[base]) el.style.setProperty('font-size',   FSM[base], 'important');
        if (FWM[base]) el.style.setProperty('font-weight', FWM[base], 'important');
      });
    }
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('[class]').forEach(applyTypo);
    });
  })();
<\/script>`;

  return html.includes('</body>')
    ? html.replace('</body>', typographyScript + '\n</body>')
    : html + typographyScript;
}

export default function PreviewPage() {
  const navigate            = useNavigate();
  const { currentTemplate } = useEditorStore();
  const iframeRef           = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceMode>('desktop');

  const blockCount = currentTemplate?.blocks?.length ?? 0;
  const hasContent = blockCount > 0;

  // ── Write processed HTML into iframe ───────────────────────
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !currentTemplate?.rawHtml) return;

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;

    const finalHtml = buildPreviewHtml(currentTemplate.rawHtml);
    doc.open();
    doc.write(finalHtml);
    doc.close();
  }, [currentTemplate?.rawHtml, device]);

  // ── ✅ THE FIX: pass templateId in state when going back ───
  // Without this, EditorPage gets no location.state.templateId
  // and may reload the original unedited template from localStorage
const handleBackToEditor = () => {
  navigate("/editor", {
    state: { templateId: currentTemplate?.id ?? null },
  });
};

// Use handleBackToEditor on BOTH buttons (Back to Editor + Go to Editor)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50
                      bg-gray-900 text-white px-4 py-2.5
                      flex items-center justify-between gap-4 shadow-lg">

        <div className="flex items-center gap-3 min-w-0">

          {/* ✅ Use handleBackToEditor instead of navigate('/editor') */}
          <button
            onClick={handleBackToEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                       bg-gray-800 hover:bg-gray-700 rounded-lg transition border border-gray-700"
          >
            <svg width="13" height="13" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to Editor
          </button>

          <div className="w-px h-5 bg-gray-700 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate max-w-48">
              👁️ {currentTemplate?.templateName ?? 'Preview'}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {blockCount} block{blockCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Device switcher */}
        {hasContent && (
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button onClick={() => setDevice('desktop')} title="Desktop"
              className={`p-1.5 rounded-md transition ${device === 'desktop' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </button>
            <button onClick={() => setDevice('tablet')} title="Tablet"
              className={`p-1.5 rounded-md transition ${device === 'tablet' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/>
              </svg>
            </button>
            <button onClick={() => setDevice('mobile')} title="Mobile"
              className={`p-1.5 rounded-md transition ${device === 'mobile' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/>
              </svg>
            </button>
          </div>
        )}

        {hasContent && (
          <span className="hidden sm:block text-xs text-gray-400 font-medium shrink-0">
            {device === 'desktop' ? 'Desktop' : device === 'tablet' ? '768px' : '390px'}
          </span>
        )}
      </div>

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center pt-14 pb-8 px-4">

        {!hasContent && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] text-center px-6">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">Nothing to preview</h2>
            <p className="text-gray-400 text-sm mb-6">Add some blocks in the editor first.</p>
            <button onClick={handleBackToEditor}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition">
              Go to Editor
            </button>
          </div>
        )}

        {hasContent && (
          <div className="transition-all duration-300 w-full" style={{ maxWidth: DEVICE_WIDTHS[device] }}>
            <div className={`bg-white rounded-xl overflow-hidden shadow-2xl ${device !== 'desktop' ? 'ring-4 ring-gray-800' : ''}`}>
              <iframe
                ref       = {iframeRef}
                title     = "Page Preview"
                className = "w-full border-0"
                style     = {{ height: '100vh', minHeight: '600px' }}
                sandbox   = "allow-scripts allow-same-origin"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}