//Update for a more robust solution.



const navSwitch = document.querySelector(".header");
const sentinel = document.querySelector("#compact-sentinel");
const menuToggle = document.querySelector("#mobile-menu-toggle");

let mobileMenuOpen = false;
let isCompact = false;
let io = null;
let lastY = window.scrollY;

  function setCompact(next) {
    if (next === isCompact) return;
    isCompact = next;
    navSwitch.classList.toggle("is-compact", isCompact);
  }

  function setupObserver() {

      if (!sentinel) return;

      if (io) io.disconnect();
    
        io = new IntersectionObserver(([entry]) => {
          const y = window.scrollY;
          const goingDown = y > lastY;
          lastY = y;
          if (goingDown && !entry.isIntersecting){
            setCompact(true);
            mobileMenuOpen = false;
          }
          if (!goingDown && entry.isIntersecting){
            setCompact(false);
            mobileMenuOpen = true;
          }

        }, {
          rootMargin: `0px 0px 0px`,
          threshold: 0
        });
        io.observe(sentinel);
  }

  menuToggle?.addEventListener("click", () => {
  if (!mobileMenuOpen) {
    setCompact(false);
    mobileMenuOpen = true;
  } else if (mobileMenuOpen){
    setCompact(true);
    mobileMenuOpen = false;
  }
});


  setupObserver();
  window.addEventListener("resize", setupObserver);