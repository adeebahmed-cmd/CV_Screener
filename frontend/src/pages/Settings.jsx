import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Save, Plug, RefreshCw } from 'lucide-react'
import { api } from '../api.js'

function LLMLogTable() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    api.getLLMLogs(30).then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading logs…</div>
  if (logs.length === 0) return <div className="text-slate-400 text-sm p-4">No LLM calls recorded yet.</div>

  return (
    <div>
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Recent LLM Calls</h2>
        <button className="btn-secondary py-1 text-xs" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Time', 'Operation', 'Model', 'Prompt', 'Response', 'Latency', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs font-medium text-slate-700">{l.operation}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{l.model}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{l.prompt_chars.toLocaleString()} ch</td>
                <td className="px-4 py-2 text-xs text-slate-500">{l.resp_chars.toLocaleString()} ch</td>
                <td className="px-4 py-2 text-xs text-slate-500">{l.latency_ms.toLocaleString()} ms</td>
                <td className="px-4 py-2">
                  {l.success ? (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">OK</span>
                  ) : (
                    <span className="text-xs font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded" title={l.error}>Error</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Settings() {
  const [form, setForm] = useState({ ollama_url: '', model: '', ranking_model: '' })
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
          <label className="label">Default Model</label>
          <input
            className="input"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder="qwen2.5:1.5b"
          />
          <p className="text-xs text-slate-500 mt-1">
            Used for JD analysis and all other operations. Any model pulled with <code>ollama pull &lt;name&gt;</code> will work.
          </p>
        </div>
        <div>
          <label className="label">Ranking Model <span className="text-slate-400 font-normal">(optional)</span></label>
          <input
            className="input"
            value={form.ranking_model}
            onChange={(e) => setForm((f) => ({ ...f, ranking_model: e.target.value }))}
            placeholder="Leave blank to use Default Model"
          />
          <p className="text-xs text-slate-500 mt-1">
            Uses a separate, more capable model only when ranking CVs. E.g. <code>phi3:mini</code> for better ranking quality.
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

      <div className="card overflow-hidden">
        <LLMLogTable />
      </div>
    </div>
  )
}
