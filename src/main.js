import './style.css'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebaseConfig.js'

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="/" aria-label="마음온 홈"><span class="brand-mark">온</span> 마음온</a>
    <div class="account-area">
      <span class="header-note">마음을 살피는 작은 습관</span>
      <span class="user-label" id="user-label" hidden></span>
      <button class="sign-out-button" id="sign-out-button" type="button" hidden>로그아웃</button>
    </div>
  </header>

  <main>
    <section class="welcome-card" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <p class="eyebrow"><span class="eyebrow-dot"></span> 오늘의 마음을 만나는 시간</p>
        <h1 id="welcome-title">오늘 하루,<br /><span>마음은 어땠나요?</span></h1>
        <p class="intro">공부와 학교생활을 천천히 돌아보고, 지금 내 마음을 들여다봐요.<br class="desktop-break" /> 정답은 없어요. 편안한 속도로 시작해도 괜찮아요.</p>
        <div class="login-actions" id="login-actions">
          <button class="button button-primary google-login-button" id="google-login-button" type="button"><span class="google-g" aria-hidden="true">G</span> Google로 로그인</button>
          <p class="login-hint" id="login-hint" role="status" aria-live="polite">로그인하면 학생 활동과 교사 대시보드를 이용할 수 있어요.</p>
        </div>
        <p class="auth-status" id="auth-status" role="status" aria-live="polite"></p>
        <div class="welcome-actions" id="welcome-actions" hidden>
          <a class="button button-primary" href="/student.html">학생 활동 시작하기 <span aria-hidden="true">→</span></a>
          <a class="button button-secondary" href="/teacherMonitor.html">교사 대시보드 <span aria-hidden="true">↗</span></a>
        </div>
        <p class="privacy-note"><span aria-hidden="true">♡</span> 내 마음을 안전하게 살피는 공간이에요</p>
      </div>
      <div class="art-panel" aria-hidden="true">
        <div class="sun"></div><div class="cloud cloud-one"></div><div class="cloud cloud-two"></div>
        <div class="hill hill-back"></div><div class="hill hill-front"></div>
        <div class="flower flower-one">✿</div><div class="flower flower-two">✿</div>
        <div class="art-caption"><span>오늘의 마음</span><strong>천천히, 나답게</strong></div>
      </div>
    </section>

    <section class="steps" aria-label="마음온 활동 안내">
      <div class="steps-heading"><span class="section-kicker">HOW IT WORKS</span><h2>마음을 돌보는 세 가지 순간</h2></div>
      <div class="step-list">
        <article class="step-card"><span class="step-icon icon-talk" aria-hidden="true">☁</span><div><span class="step-number">01</span><h3>이야기 나누기</h3><p>오늘의 학교생활을 챗봇과 편하게 이야기해요.</p></div></article>
        <article class="step-card"><span class="step-icon icon-draw" aria-hidden="true">✎</span><div><span class="step-number">02</span><h3>마음 그리기</h3><p>말로 다 못한 기분을 그림으로 표현해요.</p></div></article>
        <article class="step-card"><span class="step-icon icon-care" aria-hidden="true">♡</span><div><span class="step-number">03</span><h3>함께 살펴보기</h3><p>선생님이 여러분의 하루를 따뜻하게 살펴봐요.</p></div></article>
      </div>
    </section>
  </main>
  <footer class="site-footer"><span>마음온</span><span>오늘의 마음도 소중하니까</span></footer>
`

const loginActions = document.querySelector('#login-actions')
const loginButton = document.querySelector('#google-login-button')
const loginHint = document.querySelector('#login-hint')
const authStatus = document.querySelector('#auth-status')
const activityLinks = document.querySelector('#welcome-actions')
const userLabel = document.querySelector('#user-label')
const signOutButton = document.querySelector('#sign-out-button')

if (!isFirebaseConfigured) {
  loginButton.disabled = true
  loginHint.textContent = 'Firebase 설정값을 .env.local 파일에 입력한 뒤 개발 서버를 다시 시작해 주세요.'
  authStatus.textContent = '환경 변수 이름과 입력 방법은 .env.example 파일에서 확인할 수 있어요.'
} else {
  onAuthStateChanged(auth, (user) => {
    const signedIn = Boolean(user)
    loginActions.hidden = signedIn
    activityLinks.hidden = !signedIn
    signOutButton.hidden = !signedIn
    userLabel.hidden = !signedIn
    userLabel.textContent = user?.displayName || user?.email || ''
    authStatus.textContent = ''
  }, (error) => {
    authStatus.textContent = `로그인 상태를 확인하지 못했어요. ${error.message}`
  })

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true
    loginHint.textContent = 'Google 로그인 창을 여는 중이에요…'
    authStatus.textContent = ''
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const messages = {
        'auth/popup-closed-by-user': '로그인 창이 닫혔어요. 원할 때 다시 시도해 주세요.',
        'auth/popup-blocked': '브라우저가 로그인 창을 차단했어요. 팝업을 허용한 뒤 다시 시도해 주세요.',
        'auth/unauthorized-domain': '현재 사이트 주소가 Firebase 인증의 승인된 도메인에 등록되어 있는지 확인해 주세요.',
      }
      authStatus.textContent = messages[error.code] || `로그인에 실패했어요. ${error.message}`
      loginHint.textContent = '로그인하면 학생 활동과 교사 대시보드를 이용할 수 있어요.'
      loginButton.disabled = false
    }
  })

  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true
    try {
      await signOut(auth)
    } catch (error) {
      authStatus.textContent = `로그아웃에 실패했어요. ${error.message}`
    } finally {
      signOutButton.disabled = false
    }
  })
}
