// Minimal page interactions for Home: reveal on scroll and simple count-up
export default function initHome(){
  const animEls = Array.from(document.querySelectorAll('[data-anim]'));
  const countEls = Array.from(document.querySelectorAll('[data-count]'));
  let io;
  let rafIds = new Set();

  function revealOnIntersect(entries){
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    })
  }

  if('IntersectionObserver' in window){
    io = new IntersectionObserver(revealOnIntersect,{threshold:0.12});
    animEls.forEach(el=>io.observe(el));
  } else {
    animEls.forEach(el=>el.classList.add('revealed'));
  }

  function animateCount(el){
    const target = Number(el.getAttribute('data-count')) || 0;
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const start = 0;
    const duration = 1200;
    const startTime = performance.now();

    function step(now){
      const t = Math.min(1,(now - startTime)/duration);
      const value = Math.floor(t * (target - start) + start);
      let display = value.toLocaleString();
      el.querySelector && el.querySelector('.stat-card__value') && (el.querySelector('.stat-card__value').textContent = `${prefix}${display}${suffix}`);
      if(t < 1){
        const id = requestAnimationFrame(step);
        rafIds.add(id);
      }
    }
    const id = requestAnimationFrame(step);
    rafIds.add(id);
  }

  // animate counts when they enter view
  const countObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        animateCount(e.target);
        countObserver.unobserve(e.target);
      }
    })
  },{threshold:0.2}) : null;

  countEls.forEach(el=>{
    if(countObserver) countObserver.observe(el);
    else animateCount(el);
  });

  return function cleanup(){
    io && io.disconnect();
    countObserver && countObserver.disconnect();
    rafIds.forEach(id=>cancelAnimationFrame(id));
    rafIds.clear();
  }
}
