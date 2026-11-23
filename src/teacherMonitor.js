import './style.css'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isAdmin, isFirebaseConfigured } from './firebaseConfig.js'

const root = document.querySelector('#teacher-app')

function returnToHome() {
  window.location.replace('/')
}

if (!isFirebaseConfigured || !auth) {
  returnToHome()
} else {
  onAuthStateChanged(auth, (user) => {
    if (!isAdmin(user)) {
      returnToHome()
      return
    }

    root.innerHTML = `
      <header class="site-header">
        <a class="brand" href="/" aria-label="마음온 홈"><span class="brand-mark">온</span> 마음온</a>
        <a class="header-note" href="/">처음으로</a>
      </header>
      <main>
        <section class="welcome-card" style="min-height:300px;display:flex;align-items:center;padding:40px 8%">
          <div class="welcome-copy" style="padding:0">
            <p class="eyebrow"><span class="eyebrow-dot"></span> 관리자 공간</p>
            <h1 style="font-size:42px">학생들의 하루를<br /><span>따뜻하게 살펴봐요</span></h1>
            <p class="intro">관리자 계정으로 확인 중입니다. 학생 제출물을 확인하는 대시보드는 다음 단계에서 연결할 수 있어요.</p>
            <a class="button button-primary" href="/">홈으로 돌아가기 <span aria-hidden="true">→</span></a>
          </div>
        </section>
      </main>
      <footer class="site-footer"><span>마음온</span><span>오늘의 마음도 소중하니까</span></footer>
    `
  }, returnToHome)
}
