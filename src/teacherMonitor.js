import './style.css'
import './teacherMonitor.css'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref } from 'firebase/storage'
import { auth, db, isAdmin, isFirebaseConfigured, storage } from './firebaseConfig.js'

const root = document.querySelector('#teacher-app')
const KOREA_TIME_ZONE = 'Asia/Seoul'
let currentUser = null
let records = []
let selectedDates = new Set()
let selectedRecordId = null
let imageRequestId = 0
let loadingRecords = false

function returnToHome() {
  window.location.replace('/')
}

function getRecordDate(record) {
  const value = record.createdAt?.toDate?.() || new Date(record.drawingSubmittedAt || record.chatEndedAt || 0)
  if (Number.isNaN(value.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))
  return `${part.year}-${part.month}-${part.day}`
}

function formatDate(date) {
  const [year, month, day] = date.split('-')
  return `${year}.${month}.${day}`
}

function formatRecordTime(record) {
  const value = record.createdAt?.toDate?.() || new Date(record.drawingSubmittedAt || record.chatEndedAt || 0)
  if (Number.isNaN(value.getTime())) return '시간 정보 없음'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KOREA_TIME_ZONE,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(value)
}

function safeText(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  element.textContent = text || ''
  return element
}

function renderShell() {
  root.innerHTML = `
    <header class="site-header teacher-header">
      <a class="brand" href="/" aria-label="마음온 홈"><span class="brand-mark">온</span> 마음온 <span class="teacher-brand-label">관리자 모니터링</span></a>
      <div class="teacher-account"><div><strong id="admin-name"></strong><span id="admin-email"></span></div><button type="button" class="sign-out-button" id="teacher-signout">로그아웃</button></div>
    </header>
    <main class="teacher-layout">
      <aside class="teacher-sidebar" aria-label="제출물 및 날짜 필터">
        <section class="sidebar-panel date-panel">
          <div class="sidebar-heading"><div><span class="sidebar-kicker">FILTER</span><h1>날짜 선택</h1></div><button type="button" class="icon-button" id="refresh-records" aria-label="제출물 새로고침" title="새로고침">↻</button></div>
          <div class="date-actions"><button type="button" id="select-all-dates">모두 선택</button><button type="button" id="clear-dates">선택 해제</button></div>
          <div id="date-filters" class="date-filters"><p class="sidebar-loading">날짜를 불러오고 있어요…</p></div>
        </section>
        <section class="sidebar-panel submissions-panel">
          <div class="sidebar-heading records-heading"><div><span class="sidebar-kicker">SUBMISSIONS</span><h2>학생 기록 <span id="record-count">0</span></h2></div></div>
          <div id="record-list" class="record-list"><p class="sidebar-loading">제출물을 불러오고 있어요…</p></div>
        </section>
      </aside>
      <section class="detail-pane conversation-pane" aria-labelledby="conversation-title">
        <div class="pane-heading"><div><span class="pane-kicker">CONVERSATION</span><h2 id="conversation-title">대화 내용</h2></div><span class="pane-date" id="selected-date-label"></span></div>
        <div id="conversation-content" class="conversation-content"><div class="empty-state"><span class="empty-icon">☁</span><p>왼쪽에서 학생 기록을 선택하면<br />대화 내용을 확인할 수 있어요.</p></div></div>
      </section>
      <section class="detail-pane artwork-pane" aria-labelledby="artwork-title">
        <div class="pane-heading"><div><span class="pane-kicker">TODAY'S ARTWORK</span><h2 id="artwork-title">오늘의 그림</h2></div></div>
        <div id="artwork-content" class="artwork-content"><div class="empty-state"><span class="empty-icon">✿</span><p>학생이 그린 그림이<br />이곳에 표시돼요.</p></div></div>
      </section>
      <p class="teacher-status" id="teacher-status" role="status" aria-live="polite"></p>
    </main>
  `

  document.querySelector('#admin-name').textContent = currentUser.displayName || '관리자'
  document.querySelector('#admin-email').textContent = currentUser.email || ''
  document.querySelector('#teacher-signout').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true
    try {
      await signOut(auth)
      returnToHome()
    } catch (error) {
      showStatus(`로그아웃하지 못했어요. ${error.message}`, true)
      event.currentTarget.disabled = false
    }
  })
  document.querySelector('#refresh-records').addEventListener('click', loadRecords)
  document.querySelector('#select-all-dates').addEventListener('click', () => {
    selectedDates = new Set(getAvailableDates())
    renderDateFilters()
    renderRecordList()
  })
  document.querySelector('#clear-dates').addEventListener('click', () => {
    selectedDates.clear()
    selectedRecordId = null
    renderDateFilters()
    renderRecordList()
    showEmptyDetails()
  })
}

function showStatus(message, isError = false) {
  const status = document.querySelector('#teacher-status')
  status.textContent = message
  status.classList.toggle('status-error', isError)
}

function getAvailableDates() {
  return [...new Set(records.map(getRecordDate).filter(Boolean))].sort((left, right) => right.localeCompare(left))
}

function renderDateFilters() {
  const container = document.querySelector('#date-filters')
  const dates = getAvailableDates()
  container.replaceChildren()

  if (!dates.length) {
    container.append(safeText('p', 'sidebar-empty', '아직 제출된 기록이 없어요.'))
    return
  }

  dates.forEach((date) => {
    const label = document.createElement('label')
    label.className = 'date-option'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = date
    checkbox.checked = selectedDates.has(date)
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedDates.add(date)
      else selectedDates.delete(date)
      const currentRecord = records.find((record) => record.id === selectedRecordId)
      if (currentRecord && !selectedDates.has(getRecordDate(currentRecord))) {
        selectedRecordId = null
        showEmptyDetails()
      }
      renderDateFilters()
      renderRecordList()
    })
    const dateLabel = safeText('span', 'date-option-label', formatDate(date))
    const dateCount = records.filter((record) => getRecordDate(record) === date).length
    label.append(checkbox, dateLabel, safeText('span', 'date-count', String(dateCount)))
    container.append(label)
  })
}

function renderRecordList() {
  const container = document.querySelector('#record-list')
  const count = document.querySelector('#record-count')
  const visibleRecords = records
    .filter((record) => selectedDates.has(getRecordDate(record)))
    .sort((a, b) => recordMillis(b) - recordMillis(a))

  count.textContent = String(visibleRecords.length)
  container.replaceChildren()
  if (!visibleRecords.length) {
    const message = selectedDates.size ? '선택한 날짜에 기록이 없어요.' : '날짜를 선택하면 학생 기록이 보여요.'
    container.append(safeText('p', 'sidebar-empty', message))
    return
  }

  visibleRecords.forEach((record) => {
    const row = document.createElement('div')
    row.className = `record-row${record.id === selectedRecordId ? ' active' : ''}`
    const select = document.createElement('button')
    select.className = 'record-select'
    select.type = 'button'
    select.setAttribute('aria-pressed', String(record.id === selectedRecordId))
    select.append(
      safeText('span', 'record-student-name', record.userName || '이름 미등록'),
      safeText('span', 'record-date-time', `(${formatDate(getRecordDate(record))}, ${formatRecordTime(record)})`),
    )
    select.addEventListener('click', () => selectRecord(record.id))
    const remove = document.createElement('button')
    remove.className = 'record-delete'
    remove.type = 'button'
    remove.setAttribute('aria-label', `${record.userName || '학생'}의 ${formatDate(getRecordDate(record))} 기록 삭제`)
    remove.title = '이 제출물 삭제'
    remove.textContent = '×'
    remove.addEventListener('click', () => deleteRecord(record))
    row.append(select, remove)
    container.append(row)
  })
}

function recordMillis(record) {
  const value = record.createdAt?.toMillis?.() ?? new Date(record.drawingSubmittedAt || record.chatEndedAt || 0).getTime()
  return Number.isFinite(value) ? value : 0
}

function showEmptyDetails() {
  document.querySelector('#selected-date-label').textContent = ''
  document.querySelector('#conversation-content').innerHTML = '<div class="empty-state"><span class="empty-icon">☁</span><p>왼쪽에서 학생 기록을 선택하면<br />대화 내용을 확인할 수 있어요.</p></div>'
  document.querySelector('#artwork-content').innerHTML = '<div class="empty-state"><span class="empty-icon">✿</span><p>학생이 그린 그림이<br />이곳에 표시돼요.</p></div>'
}

async function selectRecord(recordId) {
  selectedRecordId = recordId
  renderRecordList()
  const record = records.find((item) => item.id === recordId)
  if (!record) return
  const requestId = ++imageRequestId
  document.querySelector('#selected-date-label').textContent = `${formatDate(getRecordDate(record))} · ${record.userName || '이름 미등록'}`
  renderConversation(record)
  await renderArtwork(record, requestId)
}

function renderConversation(record) {
  const container = document.querySelector('#conversation-content')
  const messages = Array.isArray(record.conversation) ? record.conversation : []
  container.replaceChildren()

  const meta = document.createElement('div')
  meta.className = 'conversation-meta'
  meta.append(
    safeText('span', '', record.userEmail || '이메일 정보 없음'),
    safeText('span', '', `대화 ${formatDuration(record.chatDurationMs)}`),
    safeText('span', '', `그림 ${formatDuration(record.drawingDurationMs)}`),
  )
  container.append(meta)

  if (!messages.length) {
    container.append(safeText('p', 'sidebar-empty', '저장된 대화 내용이 없어요.'))
    return
  }

  const list = document.createElement('div')
  list.className = 'message-list'
  messages.forEach((message) => {
    const role = message.role === 'assistant' ? '챗봇' : '학생'
    const item = document.createElement('article')
    item.className = `teacher-message ${message.role === 'assistant' ? 'teacher-assistant' : 'teacher-student'}`
    item.append(safeText('span', 'teacher-message-role', role))
    item.append(safeText('p', 'teacher-message-text', message.content || ''))
    if (message.timestamp) {
      const time = new Date(message.timestamp)
      if (!Number.isNaN(time.getTime())) {
        item.append(safeText('time', 'teacher-message-time', new Intl.DateTimeFormat('ko-KR', {
          timeZone: KOREA_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).format(time)))
      }
    }
    list.append(item)
  })
  container.append(list)
}

function formatDuration(value) {
  if (!Number.isFinite(value)) return '정보 없음'
  const seconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes ? `${minutes}분 ${remainingSeconds}초` : `${remainingSeconds}초`
}

async function renderArtwork(record, requestId) {
  const container = document.querySelector('#artwork-content')
  container.replaceChildren(safeText('p', 'pane-message', '그림을 불러오고 있어요…'))
  if (!record.drawingStoragePath) {
    container.replaceChildren(safeText('p', 'pane-message', '저장된 그림 경로가 없어요.'))
    return
  }

  try {
    const imageUrl = await getDownloadURL(ref(storage, record.drawingStoragePath))
    if (requestId !== imageRequestId) return
    const image = document.createElement('img')
    image.className = 'student-artwork'
    image.alt = `${record.userName || '학생'}이 오늘 하루를 표현한 그림`
    image.src = imageUrl
    container.replaceChildren(image)
  } catch (error) {
    if (requestId !== imageRequestId) return
    container.replaceChildren(safeText('p', 'pane-message pane-error', `그림을 불러오지 못했어요. ${error.message}`))
  }
}

async function loadRecords() {
  if (loadingRecords) return
  loadingRecords = true
  const refreshButton = document.querySelector('#refresh-records')
  refreshButton.disabled = true
  refreshButton.classList.add('spinning')
  showStatus('Firestore에서 제출물을 불러오고 있어요.')

  try {
    const snapshot = await getDocs(collection(db, 'studentSubmissions'))
    records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    selectedDates = new Set(getAvailableDates())
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) selectedRecordId = null
    renderDateFilters()
    renderRecordList()
    if (selectedRecordId) await selectRecord(selectedRecordId)
    else showEmptyDetails()
    showStatus(`${records.length}개의 제출물을 불러왔어요.`)
  } catch (error) {
    renderDateFilters()
    document.querySelector('#record-list').replaceChildren(safeText('p', 'sidebar-empty pane-error', `제출물을 불러오지 못했어요. Firestore 보안 규칙을 확인해 주세요. ${error.message}`))
    showStatus('Firestore에서 데이터를 읽지 못했어요.', true)
  } finally {
    loadingRecords = false
    refreshButton.disabled = false
    refreshButton.classList.remove('spinning')
  }
}

async function deleteRecord(record) {
  const name = record.userName || '이 학생'
  const date = getRecordDate(record)
  if (!window.confirm(`${name} 학생의 ${date ? formatDate(date) : ''} 제출 기록과 그림 파일을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
  showStatus(`${name} 학생의 제출물을 삭제하고 있어요.`)

  try {
    if (record.drawingStoragePath) {
      try {
        await deleteObject(ref(storage, record.drawingStoragePath))
      } catch (error) {
        if (error.code !== 'storage/object-not-found') throw error
      }
    }
    await deleteDoc(doc(db, 'studentSubmissions', record.id))
    records = records.filter((item) => item.id !== record.id)
    if (selectedRecordId === record.id) {
      selectedRecordId = null
      imageRequestId += 1
      showEmptyDetails()
    }
    selectedDates = new Set([...selectedDates].filter((selectedDate) => getAvailableDates().includes(selectedDate)))
    renderDateFilters()
    renderRecordList()
    showStatus(`${name} 학생의 제출물과 그림을 삭제했어요.`)
  } catch (error) {
    showStatus(`삭제하지 못했어요. Firebase 보안 규칙을 확인해 주세요. ${error.message}`, true)
  }
}

if (!isFirebaseConfigured || !auth || !db || !storage) {
  returnToHome()
} else {
  onAuthStateChanged(auth, (user) => {
    if (!isAdmin(user)) {
      returnToHome()
      return
    }
    currentUser = user
    renderShell()
    loadRecords()
  }, returnToHome)
}
