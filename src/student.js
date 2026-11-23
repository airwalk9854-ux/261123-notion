import './style.css'
import './student.css'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { deleteObject, ref, uploadBytes } from 'firebase/storage'
import { auth, db, isFirebaseConfigured, storage } from './firebaseConfig.js'

const root = document.querySelector('#student-app')

root.innerHTML = `
  <header class="site-header">
    <a class="brand" href="/" aria-label="마음온 홈"><span class="brand-mark">온</span> 마음온</a>
    <div class="student-header-right">
      <div class="student-account" id="student-account" hidden><strong id="student-name"></strong><span id="student-email"></span></div>
      <a class="header-note" href="/">처음으로</a>
    </div>
  </header>
  <main class="student-main">
    <section class="student-intro">
      <p class="eyebrow"><span class="eyebrow-dot"></span> 나를 알아가는 오늘의 시간</p>
      <h1>오늘 하루는 어땠나요?</h1>
      <p>학교에서 있었던 일을 천천히 이야기하고, 오늘의 마음을 그림으로 표현해 봐요.</p>
    </section>

    <section class="auth-gate" id="auth-gate" role="status" aria-live="polite">Google 로그인 상태를 확인하고 있어요…</section>

    <section class="key-card" id="key-card" aria-labelledby="key-title" hidden>
      <div class="key-card-icon" aria-hidden="true">✦</div>
      <div class="key-card-copy">
        <h2 id="key-title">대화를 시작해 볼까요?</h2>
        <p>OpenAI API Key를 입력하면 대화와 그림 그리기가 열려요. 키는 이 탭에서만 사용하고 저장하지 않아요.</p>
      </div>
      <form id="key-form" class="key-form">
        <label class="sr-only" for="api-key">OpenAI API Key</label>
        <input id="api-key" type="password" placeholder="OpenAI API Key (sk-...)" autocomplete="off" spellcheck="false" required />
        <button class="button button-primary" id="key-submit" type="submit">키 확인하기 <span aria-hidden="true">→</span></button>
      </form>
      <p class="key-warning"><span aria-hidden="true">ⓘ</span> 개인 키는 브라우저에서 노출될 수 있어요. 공개·공용 기기에서 사용하지 말고, 다른 사람과 공유하지 마세요. 학생의 이름·학교명 등 개인 정보는 대화에 입력하지 않도록 해주세요.</p>
      <p class="form-status" id="key-status" role="status" aria-live="polite"></p>
    </section>

    <section id="chat-section" class="activity-card" hidden>
      <div class="activity-heading">
        <div><span class="section-kicker">STEP 1 · TALK</span><h2>오늘의 이야기</h2></div>
        <span class="turn-count" id="turn-count">학생 대화 0 / 7</span>
      </div>
      <div class="chat-guidance">편하게 이야기해 주세요. 짧게 말해도 괜찮고, 답하고 싶지 않은 질문은 건너뛰어도 돼요.</div>
      <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form id="chat-form" class="chat-form">
        <label class="sr-only" for="chat-input">오늘 하루에 대한 답변</label>
        <textarea id="chat-input" rows="2" maxlength="1000" placeholder="오늘 학교에서 기억에 남는 일이 있었나요?" required></textarea>
        <button class="send-button" id="send-button" type="submit" aria-label="메시지 보내기">보내기 <span aria-hidden="true">↑</span></button>
      </form>
      <div class="chat-bottom"><p id="chat-hint">그림으로 넘어가려면 최소 3번 이야기해 주세요.</p><button type="button" class="button button-finish" id="finish-chat" disabled>Chatbot과의 대화 끝내기 <span aria-hidden="true">→</span></button></div>
    </section>

    <section id="drawing-section" class="activity-card drawing-card" hidden>
      <div class="activity-heading">
        <div><span class="section-kicker">STEP 2 · DRAW</span><h2>오늘의 마음 그리기</h2></div>
        <span class="drawing-badge"><span aria-hidden="true">✿</span> 잘 표현하고 있어요</span>
      </div>
      <p class="draw-intro">오늘 하루를 떠올리며 자유롭게 그려보세요. 무엇을 그려도 괜찮아요.</p>
      <div class="drawing-toolbar" aria-label="그림 도구">
        <div class="tool-group palette-group"><span class="tool-label">색상</span><div class="color-palette" role="group" aria-label="펜 색상">
          <button type="button" class="color-swatch selected" data-color="#55785e" style="--swatch:#55785e" aria-label="숲 초록" aria-pressed="true"></button>
          <button type="button" class="color-swatch" data-color="#6589aa" style="--swatch:#6589aa" aria-label="맑은 파랑" aria-pressed="false"></button>
          <button type="button" class="color-swatch" data-color="#d78d79" style="--swatch:#d78d79" aria-label="따뜻한 산호색" aria-pressed="false"></button>
          <button type="button" class="color-swatch" data-color="#d2a64f" style="--swatch:#d2a64f" aria-label="햇살 노랑" aria-pressed="false"></button>
          <button type="button" class="color-swatch" data-color="#9a82ac" style="--swatch:#9a82ac" aria-label="포근한 보라" aria-pressed="false"></button>
          <button type="button" class="color-swatch" data-color="#50514e" style="--swatch:#50514e" aria-label="차분한 회색" aria-pressed="false"></button>
        </div></div>
        <label class="tool-group range-group" for="brightness"><span class="range-label">펜 명도 <output id="brightness-value">100%</output></span><input id="brightness" type="range" min="25" max="100" value="100" /></label>
        <label class="tool-group range-group" for="opacity"><span class="range-label">불투명도 <output id="opacity-value">100%</output></span><input id="opacity" type="range" min="10" max="100" value="100" /></label>
        <label class="tool-group range-group" for="brush-size"><span class="range-label">브러쉬 크기 <output id="brush-value">8px</output></span><input id="brush-size" type="range" min="2" max="36" value="8" /></label>
        <button type="button" class="clear-button" id="clear-canvas"><span aria-hidden="true">⌫</span> 모두 지우기</button>
      </div>
      <div class="canvas-wrap"><canvas id="drawing-canvas" aria-label="오늘 하루를 그리는 흰 도화지"></canvas><span id="canvas-placeholder" class="canvas-placeholder">여기에 오늘의 마음을 그려보세요</span></div>
      <div class="drawing-footer"><p class="canvas-note">제출하면 이름·이메일, 전체 대화, 활동 시간과 그림이 학교 Firebase에 저장돼요.</p><button type="button" id="submit-drawing" class="button button-primary submit-drawing" disabled>그림 제출하기 <span aria-hidden="true">→</span></button></div>
      <p class="form-status" id="drawing-status" role="status" aria-live="polite"></p>
    </section>
    <footer class="site-footer"><span>마음온</span><span>오늘의 마음도 소중하니까</span></footer>
  </main>
`

const $ = (selector) => root.querySelector(selector)
const keyForm = $('#key-form')
const keyInput = $('#api-key')
const keySubmit = $('#key-submit')
const keyStatus = $('#key-status')
const chatSection = $('#chat-section')
const drawingSection = $('#drawing-section')
const chatForm = $('#chat-form')
const chatInput = $('#chat-input')
const sendButton = $('#send-button')
const messagesEl = $('#chat-messages')
const turnCountEl = $('#turn-count')
const chatHint = $('#chat-hint')
const finishButton = $('#finish-chat')
const canvas = $('#drawing-canvas')
const canvasContext = canvas.getContext('2d')
const submitDrawing = $('#submit-drawing')
const drawingStatus = $('#drawing-status')
const authGate = $('#auth-gate')
const keyCard = $('#key-card')
const studentAccount = $('#student-account')

let apiKey = ''
let conversation = []
let studentTurns = 0
let isSending = false
let selectedColor = '#55785e'
let brightness = 100
let opacity = 100
let brushSize = 8
let drawing = false
let hasDrawing = false
let lastPoint = null
let activeUser = null
let chatStartedPerf = null
let chatStartedAt = null
let chatEndedPerf = null
let chatEndedAt = null
let drawingStartedAt = null
let submissionInProgress = false
let submissionComplete = false

if (!isFirebaseConfigured || !auth) {
  authGate.textContent = 'Firebase 설정이 아직 완료되지 않았어요. .env.local 설정을 확인해 주세요.'
} else {
  onAuthStateChanged(auth, (user) => {
    activeUser = user
    if (!user) {
      studentAccount.hidden = true
      keyCard.hidden = true
      chatSection.hidden = true
      drawingSection.hidden = true
      authGate.hidden = false
      authGate.innerHTML = '학생 활동을 이용하려면 먼저 <a href="/">Google 로그인</a>을 해 주세요.'
      return
    }

    $('#student-name').textContent = user.displayName || '이름 미등록'
    $('#student-email').textContent = user.email || '이메일 미등록'
    studentAccount.hidden = false
    authGate.hidden = true
    keyCard.hidden = false
  }, (error) => {
    authGate.textContent = `로그인 상태를 확인할 수 없어요. ${error.message}`
  })
}

const baseInstructions = '너는 중고등학생의 하루를 차분히 들어주는 사회정서학습 대화 도우미야. 한국어로 짧고 따뜻하게 한 번에 질문 하나만 해. 감정을 판단하거나 진단하지 말고, 조언을 서두르지 말며 학생이 말한 내용을 먼저 공감해. 오늘 학교에서 공부하며 느낀 점, 기억에 남는 순간, 힘들거나 뿌듯했던 점을 자연스럽게 묻고 사용자의 답에 맞춰 대화를 이어가. 개인 정보는 묻지 마. 학생이 위험하거나 누군가에게 해를 입을 수 있다는 말을 하면 믿을 수 있는 보호자나 선생님에게 바로 알리도록 차분하게 권해.'

function addMessage(role, text, pending = false) {
  const message = document.createElement('article')
  message.className = `chat-message ${role === 'assistant' ? 'assistant-message' : 'student-message'}${pending ? ' pending' : ''}`
  const avatar = document.createElement('span')
  avatar.className = 'message-avatar'
  avatar.setAttribute('aria-hidden', 'true')
  avatar.textContent = role === 'assistant' ? '온' : '나'
  const bubble = document.createElement('p')
  bubble.className = 'message-bubble'
  bubble.textContent = text
  message.append(avatar, bubble)
  messagesEl.append(message)
  messagesEl.scrollTop = messagesEl.scrollHeight
  return message
}

function setStatus(element, message, isError = false) {
  element.textContent = message
  element.classList.toggle('status-error', isError)
}

async function requestResponse(input, instructions = baseInstructions, outputTokens = 180) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-5-mini', instructions, input, max_output_tokens: outputTokens }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = result?.error?.message || `API 요청에 실패했어요. (HTTP ${response.status})`
    throw new Error(message)
  }
  const text = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('').trim()
  if (!text) throw new Error('응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.')
  return text
}

keyForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const candidateKey = keyInput.value.trim()
  if (!candidateKey) return
  keySubmit.disabled = true
  keySubmit.textContent = '키를 확인하고 있어요…'
  keyStatus.classList.remove('status-error')
  setStatus(keyStatus, 'OpenAI에 연결하고 있어요. 잠시 기다려 주세요.')
  apiKey = candidateKey
  try {
    const greeting = await requestResponse('학생과 첫 인사를 나누고, 오늘 학교에서 기억에 남는 일이 있었는지 한 가지 질문으로 물어봐.', undefined, 100)
    keyForm.hidden = true
    $('.key-warning').hidden = true
    $('#key-title').textContent = '연결됐어요. 편하게 이야기해 주세요.'
    $('.key-card-copy > p').textContent = '학생 대화는 3회 이상 7회 이하로 진행할 수 있어요. 대화는 이 탭 안에서만 유지돼요.'
    chatSection.hidden = false
    conversation = [{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }]
    addMessage('assistant', greeting)
    chatInput.focus()
    setStatus(keyStatus, '')
  } catch (error) {
    apiKey = ''
    setStatus(keyStatus, error.message || '연결에 실패했어요. 키와 네트워크를 확인해 주세요.', true)
    keySubmit.disabled = false
    keySubmit.innerHTML = '키 확인하기 <span aria-hidden="true">→</span>'
  }
})

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const text = chatInput.value.trim()
  if (!text || isSending || studentTurns >= 7) return
  if (chatStartedPerf === null) {
    chatStartedPerf = performance.now()
    chatStartedAt = new Date()
  }
  isSending = true
  sendButton.disabled = true
  chatInput.disabled = true
  const nextConversation = [...conversation, { role: 'user', content: text, timestamp: new Date().toISOString() }]
  addMessage('user', text)
  const pendingMessage = addMessage('assistant', '생각을 정리하고 있어요…', true)
  chatInput.value = ''
  try {
    const reply = await requestResponse(nextConversation.map(({ role, content }) => ({ role, content })))
    pendingMessage.remove()
    conversation = [...nextConversation, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]
    studentTurns += 1
    addMessage('assistant', reply)
    turnCountEl.textContent = `학생 대화 ${studentTurns} / 7`
    if (studentTurns >= 3) {
      finishButton.disabled = false
      chatHint.textContent = studentTurns >= 7 ? '대화를 7회 나눴어요. 그림으로 오늘의 마음을 표현해 볼까요?' : '원한다면 지금 대화를 마무리하고 그림을 그릴 수 있어요.'
    }
    if (studentTurns >= 7) {
      chatInput.placeholder = '대화 횟수에 도달했어요. 그림 그리기로 넘어가 주세요.'
      chatInput.disabled = true
      sendButton.disabled = true
    } else {
      chatInput.disabled = false
      sendButton.disabled = false
      chatInput.focus()
    }
  } catch (error) {
    pendingMessage.remove()
    messagesEl.lastElementChild?.remove()
    chatInput.value = text
    chatInput.disabled = false
    sendButton.disabled = false
    chatInput.focus()
    addMessage('assistant', `메시지를 보내지 못했어요. ${error.message || '잠시 후 다시 시도해 주세요.'}`)
  } finally {
    isSending = false
  }
})

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    chatForm.requestSubmit()
  }
})

finishButton.addEventListener('click', () => {
  if (studentTurns < 3 || isSending) return
  chatEndedPerf = performance.now()
  chatEndedAt = new Date()
  drawingStartedAt = chatEndedPerf
  chatSection.hidden = true
  drawingSection.hidden = false
  drawingSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  resizeCanvas()
})

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
}

function currentColor() {
  const [red, green, blue] = hexToRgb(selectedColor).map((channel) => Math.round(255 - (255 - channel) * brightness / 100))
  return `rgb(${red}, ${green}, ${blue})`
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const ratio = Math.max(1, window.devicePixelRatio || 1)
  const previous = document.createElement('canvas')
  previous.width = canvas.width
  previous.height = canvas.height
  if (canvas.width && canvas.height) previous.getContext('2d').drawImage(canvas, 0, 0)
  canvas.width = Math.round(rect.width * ratio)
  canvas.height = Math.round(rect.height * ratio)
  canvasContext.setTransform(ratio, 0, 0, ratio, 0, 0)
  canvasContext.lineCap = 'round'
  canvasContext.lineJoin = 'round'
  if (previous.width && previous.height) canvasContext.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, rect.width, rect.height)
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function startDrawing(event) {
  if (submissionComplete || submissionInProgress) return
  event.preventDefault()
  canvas.setPointerCapture(event.pointerId)
  drawing = true
  lastPoint = pointerPosition(event)
  canvasContext.beginPath()
  canvasContext.moveTo(lastPoint.x, lastPoint.y)
  canvasContext.lineTo(lastPoint.x + 0.01, lastPoint.y + 0.01)
  canvasContext.strokeStyle = currentColor()
  canvasContext.globalAlpha = opacity / 100
  canvasContext.lineWidth = brushSize
  canvasContext.stroke()
  hasDrawing = true
  $('#canvas-placeholder').hidden = true
  submitDrawing.disabled = false
}

function continueDrawing(event) {
  if (!drawing) return
  const point = pointerPosition(event)
  canvasContext.beginPath()
  canvasContext.moveTo(lastPoint.x, lastPoint.y)
  canvasContext.lineTo(point.x, point.y)
  canvasContext.strokeStyle = currentColor()
  canvasContext.globalAlpha = opacity / 100
  canvasContext.lineWidth = brushSize
  canvasContext.stroke()
  lastPoint = point
}

function stopDrawing() {
  drawing = false
  lastPoint = null
  canvasContext.globalAlpha = 1
}

canvas.addEventListener('pointerdown', startDrawing)
canvas.addEventListener('pointermove', continueDrawing)
canvas.addEventListener('pointerup', stopDrawing)
canvas.addEventListener('pointercancel', stopDrawing)
canvas.addEventListener('lostpointercapture', stopDrawing)
window.addEventListener('resize', resizeCanvas)

root.querySelectorAll('.color-swatch').forEach((swatch) => swatch.addEventListener('click', () => {
  root.querySelectorAll('.color-swatch').forEach((button) => {
    const selected = button === swatch
    button.classList.toggle('selected', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
  selectedColor = swatch.dataset.color
}))

$('#brightness').addEventListener('input', (event) => {
  brightness = Number(event.target.value)
  $('#brightness-value').value = `${brightness}%`
})
$('#opacity').addEventListener('input', (event) => {
  opacity = Number(event.target.value)
  $('#opacity-value').value = `${opacity}%`
})
$('#brush-size').addEventListener('input', (event) => {
  brushSize = Number(event.target.value)
  $('#brush-value').value = `${brushSize}px`
})

$('#clear-canvas').addEventListener('click', () => {
  if (submissionComplete || submissionInProgress) return
  canvasContext.clearRect(0, 0, canvas.width, canvas.height)
  hasDrawing = false
  submitDrawing.disabled = true
  $('#canvas-placeholder').hidden = false
  setStatus(drawingStatus, '')
})

function canvasAsPng() {
  return new Promise((resolve, reject) => {
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const exportContext = exportCanvas.getContext('2d')
    if (!exportContext) {
      reject(new Error('그림을 준비하지 못했어요.'))
      return
    }
    exportContext.fillStyle = '#ffffff'
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportContext.drawImage(canvas, 0, 0)
    exportCanvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG 그림 파일을 만들지 못했어요.'))
    }, 'image/png')
  })
}

submitDrawing.addEventListener('click', async () => {
  if (!hasDrawing || !activeUser || !db || !storage || submissionInProgress || submissionComplete) return
  if (chatStartedPerf === null || chatEndedPerf === null || drawingStartedAt === null) {
    setStatus(drawingStatus, '대화와 그림 시간 정보를 확인하지 못했어요. 페이지를 새로고침한 뒤 다시 시작해 주세요.', true)
    return
  }

  const submittedAt = new Date()
  const submittedPerf = performance.now()
  const chatDurationMs = Math.max(0, Math.round(chatEndedPerf - chatStartedPerf))
  const drawingDurationMs = Math.max(0, Math.round(submittedPerf - drawingStartedAt))
  submissionInProgress = true
  submitDrawing.disabled = true
  submitDrawing.textContent = '제출하고 있어요…'
  setStatus(drawingStatus, '그림을 Storage에 올리고 활동 내용을 Firestore에 저장하고 있어요.')
  let imageReference

  try {
    const imageBlob = await canvasAsPng()
    const submissionReference = doc(collection(db, 'studentSubmissions'))
    imageReference = ref(storage, `studentDrawings/${activeUser.uid}/${submissionReference.id}.png`)
    await uploadBytes(imageReference, imageBlob, {
      contentType: 'image/png',
      customMetadata: { uid: activeUser.uid, submissionId: submissionReference.id },
    })

    try {
      await setDoc(submissionReference, {
        uid: activeUser.uid,
        userName: activeUser.displayName || '이름 미등록',
        userEmail: activeUser.email || '',
        conversation,
        chatStartedAt: chatStartedAt.toISOString(),
        chatEndedAt: chatEndedAt.toISOString(),
        chatDurationMs,
        drawingStartedAt: chatEndedAt.toISOString(),
        drawingSubmittedAt: submittedAt.toISOString(),
        drawingDurationMs,
        drawingStoragePath: imageReference.fullPath,
        drawingContentType: 'image/png',
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      await deleteObject(imageReference).catch(() => {})
      throw error
    }

    submissionComplete = true
    submitDrawing.textContent = '제출 완료'
    setStatus(drawingStatus, '제출이 완료됐어요. 대화 내용과 활동 시간은 Firestore에, 그림은 PNG로 Storage에 저장했어요.')
  } catch (error) {
    submitDrawing.disabled = false
    submitDrawing.innerHTML = '그림 제출하기 <span aria-hidden="true">→</span>'
    setStatus(drawingStatus, `제출에 실패했어요. Firebase 설정과 보안 규칙을 확인한 뒤 다시 시도해 주세요. ${error.message || ''}`, true)
  } finally {
    submissionInProgress = false
  }
})
