// about.js
// IntersectionObserver-driven animations, stat count-up, timeline draw, and hero mouse parallax.
// Exports default initAbout() which sets observers/listeners and returns a cleanup function.

export default function initAbout() {
  // Respect reduced motion preference.
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Helpers
  function revealOnEnter(entries, observer) {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const el = entry.target
        // staggered reveal for elements that contain multiple lines
        requestAnimationFrame(() => el.classList.add('is-revealed'))
        observer.unobserve(el)
      }
    })
  }

  // STAT COUNT-UP
  function countUp(el) {
    const raw = el.getAttribute('data-count') || el.textContent || '0'
    // support large labels like 'Billions' — only animate if numeric
    const target = parseFloat(raw.replace(/[^0-9\.]/g, ''))
    if (!Number.isFinite(target)) return

    const duration = 1200
    let start = null
    const startVal = 0

    function step(ts) {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const value = Math.floor(progress * (target - startVal) + startVal)
      // format with commas for thousands
      const out = el.querySelector('.about__stat-value')
      if (out) {
        const prefix = el.getAttribute('data-prefix') || ''
        const suffix = el.getAttribute('data-suffix') || ''
        out.textContent = prefix + new Intl.NumberFormat().format(value) + suffix
      }
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // Observe elements with [data-anim]
  const observerOptions = { threshold: 0.12 }
  const revealObserver = new IntersectionObserver(revealOnEnter, observerOptions)
  const animNodes = Array.from(document.querySelectorAll('[data-anim]'))
  animNodes.forEach((n, i) => {
    if (!prefersReduced) {
      n.style.transitionDelay = `${i * 0.12}s`
    }
    revealObserver.observe(n)
  })

  // Reveal headline lines and eyebrow/subhead with precise staggering
  const headlineLines = Array.from(document.querySelectorAll('.about__headline-line'))
  headlineLines.forEach((line, i) => {
    if (!prefersReduced) {
      setTimeout(() => line.classList.add('is-revealed'), 300 + i * 300)
    } else {
      line.classList.add('is-revealed')
    }
  })
  const eyebrow = document.querySelector('.about__eyebrow')
  const subhead = document.querySelector('.about__subhead')
  if (eyebrow) { setTimeout(() => eyebrow.classList.add('is-revealed'), 180) }
  if (subhead) { setTimeout(() => subhead.classList.add('is-revealed'), 480) }

  // Stats count-up when they appear
  const stats = Array.from(document.querySelectorAll('.about__stat'))
  const statsObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUp(entry.target)
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.3 })
  stats.forEach(s => statsObserver.observe(s))

  // Timeline nodes: pop when line draws (simplified: reveal on enter)
  const timelineNodes = Array.from(document.querySelectorAll('[data-node]'))
  timelineNodes.forEach((n, i) => {
    if (!prefersReduced) n.style.transitionDelay = `${i * 200}ms`
    revealObserver.observe(n)
  })

  // Hero mouse movement: updates CSS custom properties for a subtle gradient mesh.
  const hero = document.querySelector('.about__hero')
  function onMouse(e) {
    const rect = hero.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    hero.style.setProperty('--mouse-x', `${x}%`)
    hero.style.setProperty('--mouse-y', `${y}%`)
  }

  if (hero && !prefersReduced) {
    hero.addEventListener('mousemove', onMouse)
  }

  // Accessibility: allow keyboard users to focus CTA buttons and show focus outline
  const btns = Array.from(document.querySelectorAll('.btn'))
  btns.forEach(b => b.setAttribute('tabindex', '0'))

  // Return cleanup
  return () => {
    revealObserver.disconnect()
    statsObserver.disconnect()
    if (hero && !prefersReduced) hero.removeEventListener('mousemove', onMouse)
  }
}
