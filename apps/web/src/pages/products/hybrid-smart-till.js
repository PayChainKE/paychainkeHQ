// Initialize scroll reveal and simple SVG animations for the Hybrid Smart Till page
export default function initSmartTillAnimations(){
  try{
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('in-view');
          // if the element contains the hero SVG, play it
          if(e.target.querySelector){
            const svg = e.target.querySelector('.till-svg');
            if(svg) svg.classList.add('play');
          }
        }
      });
    },{threshold:0.12});

    document.querySelectorAll('[data-animate]').forEach(el=>io.observe(el));

    // Play hero visual immediately if present
    const heroSvg = document.querySelector('.till-svg');
    if(heroSvg){
      setTimeout(()=>heroSvg.classList.add('play'),300);
    }
  }catch(err){
    // graceful failure in older browsers
    // console.warn('SmartTill animations init failed', err);
  }
}
