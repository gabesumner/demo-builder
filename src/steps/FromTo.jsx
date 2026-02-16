import ImageUpload from '../components/ImageUpload'
import AutoHideTitle from '../components/AutoHideTitle'

export default function FromTo({ data, onChange, showTitles }) {
  const { from = { image: '', text: '' }, to = { image: '', text: '' } } = data || {}

  function updateSide(side, fields) {
    onChange({ ...data, [side]: { ...data[side], ...fields } })
  }

  return (
    <div className="max-w-5xl mx-auto pt-4">
      {/* Page title */}
      <AutoHideTitle className="text-center mb-12" visible={showTitles}>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">From / To Shift</h1>
        <p className="text-lg text-slate-400 font-light mt-2">Show the before and after — life without and with the product.</p>
      </AutoHideTitle>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
        {/* Without Product */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-200 text-lg">Life without the product</h3>
          </div>
          <ImageUpload
            value={from.image}
            onChange={img => updateSide('from', { image: img })}
            className="aspect-video mb-5"
          />
          <textarea
            value={from.text}
            onChange={e => updateSide('from', { text: e.target.value })}
            placeholder="Describe the pain point..."
            rows={4}
            className="w-full bg-transparent border border-transparent rounded-xl px-4 py-3 text-slate-300 text-[15px] leading-relaxed placeholder-slate-600 resize-none focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
          />
        </div>

        {/* Arrow */}
        <div className="hidden md:flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-sf-blue/10 border border-sf-blue/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-sf-blue-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
        <div className="flex md:hidden items-center justify-center py-2">
          <div className="w-10 h-10 rounded-full bg-sf-blue/10 border border-sf-blue/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-sf-blue-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </div>
        </div>

        {/* With Product */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-200 text-lg">Life with the product</h3>
          </div>
          <ImageUpload
            value={to.image}
            onChange={img => updateSide('to', { image: img })}
            className="aspect-video mb-5"
          />
          <textarea
            value={to.text}
            onChange={e => updateSide('to', { text: e.target.value })}
            placeholder="Describe the improved state..."
            rows={4}
            className="w-full bg-transparent border border-transparent rounded-xl px-4 py-3 text-slate-300 text-[15px] leading-relaxed placeholder-slate-600 resize-none focus:outline-none focus:bg-dark-bg/50 focus:border-sf-blue/30 hover:border-dark-border/50 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}
