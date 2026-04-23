import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Keyboard, Save, Sparkles } from 'lucide-react'
import FileDropzone from '../components/FileDropzone.jsx'
import KeywordEditor from '../components/KeywordEditor.jsx'
import LoadingOverlay from '../components/LoadingOverlay.jsx'
import { api } from '../api.js'

export default function NewJob() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])

  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rawText, setRawText] = useState('')
  const [model, setModel] = useState(null)

  async function analyze() {
    try {
      setAnalyzing(true)
      let result
      if (mode === 'paste') {
        if (!text.trim()) {
          toast.error('Paste the JD text first.')
          return
        }
        result = await api.analyzeJDText({ title, text })
      } else {
        if (files.length === 0) {
          toast.error('Upload a JD file first.')
          return
        }
        result = await api.analyzeJDFile({ title, file: files[0] })
      }
      setRawText(result.raw_text)
      setModel(result.jd_json)
      if (!title && result.title) setTitle(result.title)
      toast.success('JD analyzed. Review and adjust keyword weights.')
    } catch (e) {
      toast.error(e.message || 'Analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function save() {
    try {
      setSaving(true)
      const finalTitle = title?.trim() || model?.role || 'Untitled Role'
      const job = await api.saveJob({ title: finalTitle, raw_text: rawText, jd_json: model })
      toast.success('Job model saved.')
      navigate(`/jobs/${job.id}`)
    } catch (e) {
      toast.error(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <LoadingOverlay
        show={analyzing}
        message="Extracting keywords with local LLM… this can take 10–60 seconds on CPU."
      />
      <LoadingOverlay show={saving} message="Saving job model…" />

      <div>
        <h1 className="text-3xl font-bold text-slate-900">Create New Job</h1>
        <p className="text-slate-600 mt-1">
          Upload a Job Description and the local LLM will extract a weighted keyword model.
        </p>
      </div>

      {!model && (
        <div className="card p-5 space-y-5">
          <div>
            <label className="label">Job title (optional)</label>
            <input
              className="input"
              placeholder="e.g. Director – Health & Rehab"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setMode('paste')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                mode === 'paste'
                  ? 'border-brand-700 text-brand-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard size={14} className="inline mr-1" /> Paste text
            </button>
            <button
              onClick={() => setMode('file')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                mode === 'file'
                  ? 'border-brand-700 text-brand-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14} className="inline mr-1" /> Upload file
            </button>
          </div>

          {mode === 'paste' ? (
            <textarea
              className="input min-h-[260px] font-mono text-sm"
              placeholder="Paste the full Job Description here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <FileDropzone
              multiple={false}
              files={files}
              onChange={setFiles}
              hint="A single PDF, DOCX, or TXT job description"
            />
          )}

          <div className="flex justify-end">
            <button className="btn-primary" onClick={analyze} disabled={analyzing}>
              <Sparkles size={16} /> Analyze JD
            </button>
          </div>
        </div>
      )}

      {model && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Review keyword model</h2>
              <p className="text-sm text-slate-600">
                Tweak weights and must/good-to-have flags before saving.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setModel(null)}>
                Start over
              </button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                <Save size={16} /> Save Job Model
              </button>
            </div>
          </div>

          <div>
            <label className="label">Job title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <KeywordEditor model={model} onChange={setModel} />
        </>
      )}
    </div>
  )
}
