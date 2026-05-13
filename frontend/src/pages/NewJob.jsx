import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Keyboard, Save, Sparkles } from 'lucide-react'
import FileDropzone from '../components/FileDropzone.jsx'
import KeywordEditor from '../components/KeywordEditor.jsx'
import LoadingOverlay from '../components/LoadingOverlay.jsx'
import { api } from '../api.js'

export default function NewJob() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [mode, setMode] = useState('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])

  const [loading, setLoading] = useState(isEdit)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rawText, setRawText] = useState('')
  const [llmModelName, setLlmModelName] = useState('local Ollama model')
  const [model, setModel] = useState(null)
  const analyzeInFlight = useRef(false)

  useEffect(() => {
    api
      .getSettings()
      .then((settings) => {
        if (settings?.model) {
          setLlmModelName(settings.model)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    api.getJob(id)
      .then((job) => {
        setTitle(job.title || '')
        setText(job.raw_text || '')
        setRawText(job.raw_text || '')
        setModel(job.jd_json || null)
      })
      .catch((e) => toast.error(e.message || 'Failed to load job.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  async function analyze() {
    if (analyzeInFlight.current) return
    analyzeInFlight.current = true
    try {
      setAnalyzing(true)
      let result
      if (mode === 'paste') {
        const sourceText = text.trim() || rawText.trim()
        if (!sourceText) {
          toast.error('Paste the JD text first.')
          return
        }
        result = await api.analyzeJDText({ title, text: sourceText })
      } else {
        if (files.length === 0) {
          toast.error('Upload a JD file first.')
          return
        }
        result = await api.analyzeJDFile({ title, file: files[0] })
      }
      setText(result.raw_text)
      setRawText(result.raw_text)
      setModel(result.jd_json)
      if (!title && result.title) setTitle(result.title)
      toast.success('JD analyzed. Review and adjust keyword weights.')
    } catch (e) {
      toast.error(e.message || 'Analysis failed.')
    } finally {
      analyzeInFlight.current = false
      setAnalyzing(false)
    }
  }

  async function save() {
    if (!model) {
      toast.error('Analyze or load a JD model before saving.')
      return
    }
    try {
      setSaving(true)
      const finalTitle = title?.trim() || model?.role || 'Untitled Role'
      const payload = { title: finalTitle, raw_text: rawText || text, jd_json: model }
      const job = isEdit
        ? await api.updateJob(id, payload)
        : await api.saveJob(payload)
      toast.success(isEdit ? 'Job model updated.' : 'Job model saved.')
      navigate(`/jobs/${job.id}`, isEdit ? { state: { needsRerank: true } } : {})
    } catch (e) {
      toast.error(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-slate-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <LoadingOverlay
        show={analyzing}
        message={`Extracting keywords with ${llmModelName} via Ollama. This can take a few seconds.`}
      />
      <LoadingOverlay show={saving} message={isEdit ? 'Updating job model...' : 'Saving job model...'} />

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{isEdit ? 'Edit Job' : 'Create New Job'}</h1>
        <p className="text-slate-600 mt-1">
          {isEdit
            ? 'Update the job title, JD text, and keyword model.'
            : 'Upload a Job Description and the LLM will extract a weighted keyword model.'}
        </p>
      </div>

      <div className="card p-5 space-y-5">
        <div>
          <label className="label">Job title</label>
          <input
            className="input"
            placeholder="e.g. Director - Health & Rehab"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
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
            type="button"
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
          <div>
            <label className="label">JD text</label>
            <textarea
              className="input min-h-[260px] font-mono text-sm"
              placeholder="Paste the full Job Description here..."
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setRawText(e.target.value)
              }}
            />
          </div>
        ) : (
          <FileDropzone
            multiple={false}
            files={files}
            onChange={setFiles}
            hint="A single PDF, DOCX, or TXT job description"
          />
        )}

        <div className="flex justify-end">
          <button className="btn-secondary" type="button" onClick={analyze} disabled={analyzing}>
            <Sparkles size={16} /> {model ? 'Re-analyze JD' : 'Analyze JD'}
          </button>
        </div>
      </div>

      {model && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Review keyword model</h2>
              <p className="text-sm text-slate-600">
                Edit existing keywords, add missing ones, and save when the model looks right.
              </p>
            </div>
            <div className="flex gap-2">
              {!isEdit && (
                <button className="btn-secondary" type="button" onClick={() => setModel(null)}>
                  Start over
                </button>
              )}
              <button className="btn-primary" type="button" onClick={save} disabled={saving}>
                <Save size={16} /> {isEdit ? 'Update Job' : 'Save Job Model'}
              </button>
            </div>
          </div>

          <KeywordEditor model={model} onChange={setModel} />
        </>
      )}
    </div>
  )
}
