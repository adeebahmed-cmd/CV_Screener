import { useRef, useState } from 'react'
import { UploadCloud, X, FileText } from 'lucide-react'

const ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

export default function FileDropzone({ multiple = false, maxFiles = 5, files, onChange, hint }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  function addFiles(incoming) {
    const list = Array.from(incoming)
    const next = multiple ? [...files, ...list].slice(0, maxFiles) : list.slice(0, 1)
    onChange(next)
  }

  function onDrop(e) {
    e.preventDefault()
    setOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  function removeAt(i) {
    const next = files.filter((_, idx) => idx !== i)
    onChange(next)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          over ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-brand-400'
        }`}
      >
        <UploadCloud className="mx-auto mb-2 text-slate-400" size={32} />
        <div className="text-sm font-medium text-slate-700">
          Click to upload or drag &amp; drop
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {hint || `PDF, DOCX, or TXT${multiple ? ` · up to ${maxFiles} files` : ''}`}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </button>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm truncate">{f.name}</span>
                <span className="text-xs text-slate-500 shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                onClick={() => removeAt(i)}
                className="text-slate-400 hover:text-rose-600"
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
