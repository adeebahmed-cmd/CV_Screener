const BASE = '/api'

function getToken() {
  return localStorage.getItem('hr_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('hr_token')
    window.location.href = '/login'
    return
  }
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

  // Auth
  authConfig: () => fetch('/auth/config').then((r) => r.json()),
  getMe: () => request('/me'),

  // Jobs
  listJobs: () => request('/jobs'),
  getJob: (id) => request(`/jobs/${id}`),
  updateJob: (id, { title, raw_text, jd_json }) =>
    request(`/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, raw_text, jd_json }),
    }),
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
  deleteCV: (id) => request(`/cvs/${id}`, { method: 'DELETE' }),
  deleteAllCVs: (jobId) => request(`/cvs/job/${jobId}/all`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: ({ ollama_url, model, ranking_model }) =>
    request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ollama_url, model, ranking_model }),
    }),

  // Analytics
  getAnalytics: () => request('/analytics'),
  getLLMLogs: (limit = 30) => request(`/analytics/llm-logs?limit=${limit}`),

  // Candidate decisions
  getDecisions: (jobId) => request(`/jobs/${jobId}/decisions`),
  setDecision: (jobId, candidateName, decision, note = '') =>
    request(`/jobs/${jobId}/decisions/${encodeURIComponent(candidateName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note }),
    }),

  // Keyword Repository
  listRepository: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.category) qs.set('category', params.category)
    return request(`/repository${qs.toString() ? '?' + qs : ''}`)
  },
  createKeyword: (data) =>
    request('/repository', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateKeyword: (id, data) =>
    request(`/repository/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteKeyword: (id) => request(`/repository/${id}`, { method: 'DELETE' }),
  approveKeyword: (id) =>
    request(`/repository/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    }),

  // Users (Admin)
  listUsers: () => request('/users'),
  updateUserRole: (id, role) =>
    request(`/users/${id}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }),
}
