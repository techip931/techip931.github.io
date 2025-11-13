const SUPABASE_URL = 'https://ykkdjrptxixjyxwncpgb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlra2RqcnB0eGl4anl4d25jcGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2Mzc1NTcsImV4cCI6MjA3ODIxMzU1N30.W-rrBBdDYat-VR4-4cq_kLMAMqnmPgg5cS1J7Eo640w'

const supabase = supabaseJs.createClient(https://ykkdjrptxixjyxwncpgb.supabase.cohttps://ykkdjrptxixjyxwncpgb.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlra2RqcnB0eGl4anl4d25jcGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2Mzc1NTcsImV4cCI6MjA3ODIxMzU1N30.W-rrBBdDYat-VR4-4cq_kLMAMqnmPgg5cS1J7Eo640w')

                                         const { error } = await supabase.auth.signUp({ email, password })
if (error) {
  console.error('Sign-up error:', error)
  status.textContent = error.message
} else {
  status.textContent = 'Sign-up successful. Check your email.'
}
const emailEl = document.getElementById('email')
const passEl = document.getElementById('password')
const signupBtn = document.getElementById('signup')
const loginBtn = document.getElementById('login')
const logoutBtn = document.getElementById('logout')
const uploader = document.getElementById('uploader')
const csvFile = document.getElementById('csvFile')
const envelopeSize = document.getElementById('envelopeSize')
const includeReturn = document.getElementById('includeReturn')
const uploadBtn = document.getElementById('uploadBtn')
const status = document.getElementById('status')
const downloadDiv = document.getElementById('download')
const downloadZip = document.getElementById('downloadZip')
const preview = document.getElementById('preview')

async function setUserState() {
  const s = await supabase.auth.getSession()
  const user = s?.data?.session?.user || null
  if (user) {
    uploader.style.display = 'block'
    logoutBtn.style.display = 'inline-block'
    loginBtn.style.display = 'none'
    signupBtn.style.display = 'none'
    status.textContent = 'Signed in as ' + (user.email || user.id)
  } else {
    uploader.style.display = 'none'
    logoutBtn.style.display = 'none'
    loginBtn.style.display = 'inline-block'
    signupBtn.style.display = 'inline-block'
    status.textContent = 'Not signed in'
  }
}

signupBtn.addEventListener('click', async () => {
  const { error } = await supabase.auth.signUp({ email: emailEl.value, password: passEl.value })
  status.textContent = error ? error.message : 'Sign up email sent'
})

loginBtn.addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithPassword({ email: emailEl.value, password: passEl.value })
  status.textContent = error ? error.message : 'Logged in'
  await setUserState()
})

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
  await setUserState()
})

uploadBtn.addEventListener('click', async () => {
  const file = csvFile.files?.[0]
  if (!file) return status.textContent = 'Select a CSV file'
  const path = `uploads/${Date.now()}-${file.name}`
  status.textContent = 'Uploading file...'
  const { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
  if (upErr) return status.textContent = 'Upload failed: ' + upErr.message

  status.textContent = 'Creating upload record and job...'
  const session = await supabase.auth.getSession()
  const token = session?.data?.session?.access_token

  const fnRes = await fetch('https://ykkdjrptxixjyxwncpgb.functions.supabase.co/upload-addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ file_path: path, envelope_size: envelopeSize.value, include_return: includeReturn.checked })
  })

  const text = await fnRes.text()
  if (!fnRes.ok) return status.textContent = 'Function error: ' + fnRes.status + ' ' + text
  const payload = JSON.parse(text || '{}')
  status.textContent = 'Job created. Polling status...'
  pollJob(payload.upload_id)
})

async function pollJob(uploadId) {
  const start = Date.now()
  while (Date.now() - start < 1000 * 60 * 5) {
    const { data, error } = await supabase.from('envelope_jobs').select('*').eq('upload_id', uploadId).order('created_at', { ascending: false }).limit(1)
    if (error) { status.textContent = 'Status check error: ' + error.message; return }
    const job = data?.[0]
    if (job) {
      status.textContent = 'Job status: ' + job.status
      if (job.status === 'complete' && job.result_path) {
        downloadDiv.style.display = 'block'
        preview.innerHTML = 'Result ready'
        downloadZip.onclick = () => window.open(`${SUPABASE_URL}/storage/v1/object/public/${job.result_path}`, '_blank')
        return
      }
    }
    await new Promise(r => setTimeout(r, 3000))
  }
  status.textContent = 'Timed out waiting for job'
}

setUserState()
