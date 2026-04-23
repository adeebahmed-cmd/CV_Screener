const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      detail = data.detail || JSON.stringify(data)
    } catch {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Health & stats
  health: () => request('/health'),
  stats: () => request('/stats'),
  ollamaHealth: () => request('/health/ollama'),

  // Jobs
  listJobs: () => request('/jobs'),
  getJob: (id) => request(`/jobs/${id}`),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),

  analyzeJDText: ({ title, text }) =>
    request('/jobs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, text }),
    }),

  analyzeJDFile: ({ title, file }) => {
    const fd = new FormData()
    if (title) fd.append('title', title)
    fd.append('file', file)
    return request('/jobs/analyze-file', { method: 'POST', body: fd })
  },

  saveJob: ({ title, raw_text, jd_json }) =>
    request('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, raw_text, jd_json }),
    }),

  // CVs
  uploadCVs: (jobId, files) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return request(`/jobs/${jobId}/cvs`, { method: 'POST', body: fd })
  },

  rank: (jobId) => request(`/jobs/${jobId}/rank`, { method: 'POST' }),

  getCV: (id) => request(`/cvs/${id}`),
  evaluateCV: (id) => request(`/cvs/${id}/evaluate`, { method: 'POST' }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: ({ ollama_url, model }) =>
    request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ollama_url, model }),
    }),
}
