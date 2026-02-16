import AutoHideTitle from '../components/AutoHideTitle'

function extractEmbedUrl(url) {
  // Vidyard patterns
  const vidyardPatterns = [
    /share\.vidyard\.com\/watch\/([a-zA-Z0-9_-]+)/,
    /play\.vidyard\.com\/([a-zA-Z0-9_-]+)/,
    /video\.vidyard\.com\/watch\/([a-zA-Z0-9_-]+)/,
    /vidyard\.com\/(?:share|watch)\/([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of vidyardPatterns) {
    const match = url.match(pattern)
    if (match) return `https://play.vidyard.com/${match[1]}`
  }

  // Google Drive patterns
  const drivePatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of drivePatterns) {
    const match = url.match(pattern)
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  }

  return null
}

export default function Watch({ data, onChange, showTitles }) {
  const { driveUrl = '', embedUrl = '' } = data || {}

  function handleLoad() {
    const embed = extractEmbedUrl(driveUrl)
    onChange({ ...data, embedUrl: embed || '' })
  }

  return (
    <div className="max-w-4xl mx-auto pt-4">
      {/* Page title */}
      <AutoHideTitle className="text-center mb-12" visible={showTitles}>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Watch</h1>
        <p className="text-lg text-slate-400 font-light mt-2">Embed and review your recorded demo video.</p>
      </AutoHideTitle>

      {/* URL input */}
      <div className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={driveUrl}
            onChange={e => onChange({ ...data, driveUrl: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            placeholder="Paste a Vidyard or Google Drive link"
            className="flex-1 bg-dark-surface border border-dark-border rounded-xl px-5 py-3 text-slate-200 text-[15px] placeholder-slate-600 focus:outline-none focus:border-sf-blue/40 transition-colors"
          />
          <button
            onClick={handleLoad}
            className="bg-sf-blue hover:bg-sf-blue-light text-white px-6 py-3 rounded-xl font-medium transition-colors cursor-pointer border-none text-[15px]"
          >
            Load
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 pl-1">Paste a Vidyard or Google Drive video link. Make sure the file is shared.</p>
      </div>

      {/* Video area */}
      {embedUrl ? (
        <div className="rounded-lg overflow-hidden border border-dark-border bg-black shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <iframe
            src={embedUrl}
            width="100%"
            allow="autoplay"
            allowFullScreen
            className="block aspect-video"
            title="Demo video"
          />
        </div>
      ) : driveUrl ? (
        <div className="text-center py-20 rounded-2xl border border-red-500/20 bg-red-500/[0.04]">
          <p className="text-red-400 font-medium">Could not extract video ID from URL</p>
          <p className="text-sm text-slate-500 mt-2">Please use a Vidyard or Google Drive share link</p>
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl border border-dashed border-dark-border">
          <svg className="w-16 h-16 mx-auto text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500">Paste a Vidyard or Google Drive URL above to preview your video</p>
        </div>
      )}
    </div>
  )
}
