const navSwitch = document.querySelector(".header");
const sentinel = document.querySelector("#compact-sentinel");
const menuToggle = document.querySelector("#mobile-menu-toggle");

let mobileMenuOpen = false;
let isCompact = true;
let io = null;
let lastY = window.scrollY;

  function setCompact(next) {
    if (next === isCompact) return;
    isCompact = next;
    navSwitch.classList.toggle("is-compact", isCompact);
  }


  navSwitch.classList.toggle("is-compact", isCompact);
  menuToggle?.setAttribute("aria-expanded", String(mobileMenuOpen));

  function setupObserver() {

      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        if (io) {
          io.disconnect();
          io = null;
        }

        return;
      }

      if (!sentinel) return;

      if (io) io.disconnect();
    
        io = new IntersectionObserver(([entry]) => {
          const y = window.scrollY;
          const goingDown = y > lastY;
          lastY = y;
          if (goingDown && !entry.isIntersecting){
            setCompact(true);
            mobileMenuOpen = false;
            menuToggle?.setAttribute("aria-expanded", String(mobileMenuOpen));
          }
          if (!goingDown && entry.isIntersecting){
            setCompact(false);
            mobileMenuOpen = true;
            menuToggle?.setAttribute("aria-expanded", String(mobileMenuOpen));
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
    menuToggle.setAttribute("aria-expanded", "true");
  } else if (mobileMenuOpen){
    setCompact(true);
    mobileMenuOpen = false;
    menuToggle.setAttribute("aria-expanded", "false");
  }

  menuToggle.setAttribute("aria-expanded", String(mobileMenuOpen));

});


  setupObserver();
  window.addEventListener("resize", setupObserver);






//Progressive scroll VERSION, css changes needed

// const navSwitch = document.querySelector(".header");
// const menuToggle = document.querySelector("#mobile-menu-toggle");
// const menu = document.querySelector(".header-nav__lists");

// let mobileMenuOpen = false;

// const REVEAL_START = 100; // début de la zone tampon
// const REVEAL_RANGE = 300;  // longueur de la transition

// function clamp(value, min, max) {
//   return Math.max(min, Math.min(max, value));
// }

// function getProgressFromScroll(scrollY, start, range) {
//   const raw = (scrollY - start) / range;
//   return clamp(raw, 0, 1);
// }

// function updateMenuFromScroll() {
//   if (!menu || mobileMenuOpen) return;

//   // 0 = ouvert, 1 = fermé, donc on inverse
//   const progress = 1 - getProgressFromScroll(window.scrollY, REVEAL_START, REVEAL_RANGE);

//   menu.style.maxHeight = `${menu.scrollHeight * progress}px`;

//   navSwitch.classList.toggle("is-compact", progress < 1);
// }

// menuToggle?.addEventListener("click", () => {
//   mobileMenuOpen = !mobileMenuOpen;
//   menuToggle.setAttribute("aria-expanded", String(mobileMenuOpen));

//   if (mobileMenuOpen) {
//     // clic = priorité, menu ouvert à 100 %
//     menu.style.maxHeight = `${menu.scrollHeight}px`;
//     navSwitch.classList.remove("is-compact");
//     navSwitch.classList.add("is-mobile-menu-open");
//   } else {
//     navSwitch.classList.remove("is-mobile-menu-open");
//     updateMenuFromScroll(); // redonne la main au scroll
//   }
// });

// window.addEventListener("scroll", updateMenuFromScroll);
// window.addEventListener("resize", updateMenuFromScroll);

// updateMenuFromScroll();