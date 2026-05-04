import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Save, Plug } from 'lucide-react'
import { api } from '../api.js'

export default function Settings() {
  const [form, setForm] = useState({ ollama_url: '', model: '' })
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setForm(s))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function test() {
    try {
      setTesting(true)
      const r = await api.ollamaHealth()
      setStatus(r)
      if (r.ok) {
        toast.success(`Connected. ${r.models_available.length} model(s) available.`)
      } else {
        toast.error(r.error || 'Ollama not reachable.')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setTesting(false)
    }
  }

  async function save() {
    try {
      setSaving(true)
      await api.updateSettings(form)
      toast.success('Settings saved.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-slate-500">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Configure the local Ollama endpoint and the model used for all LLM calls.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Ollama URL</label>
          <input
            className="input"
            value={form.ollama_url}
            onChange={(e) => setForm((f) => ({ ...f, ollama_url: e.target.value }))}
            placeholder="http://localhost:11434"
          />
        </div>
        <div>
          <label className="label">Model</label>
          <input
            className="input"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder="phi3:mini"
          />
          <p className="text-xs text-slate-500 mt-1">
            Any model pulled with <code>ollama pull &lt;name&gt;</code> will work.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={test} disabled={testing}>
            <Plug size={16} /> Test connection
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      {status && (
        <div className={`card p-5 ${status.ok ? 'border-emerald-200' : 'border-rose-200'}`}>
          <div className="flex items-center gap-2 font-semibold">
            {status.ok ? (
              <CheckCircle2 className="text-emerald-600" size={18} />
            ) : (
              <XCircle className="text-rose-600" size={18} />
            )}
            {status.ok ? 'Ollama is reachable' : 'Cannot reach Ollama'}
          </div>
          {status.ok ? (
            <div className="mt-3">
              <div className="text-sm text-slate-600 mb-2">Models available:</div>
              <div className="flex flex-wrap gap-2">
                {status.models_available.length === 0 && (
                  <span className="text-sm text-slate-500">
                    None pulled yet. Run <code>ollama pull phi3:mini</code>.
                  </span>
                )}
                {status.models_available.map((m) => (
                  <span key={m} className="chip-blue">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-rose-700">{status.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
