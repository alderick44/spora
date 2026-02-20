const navSwitch = document.querySelector(".header");
const sentinel = document.querySelector("#compact-sentinel");

let isCompact = false;
let io = null;
let lastY = window.scrollY;

const HEADER_OFFSET = 90;

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

    if (goingDown && !entry.isIntersecting) setCompact(true);
    if (!goingDown && entry.isIntersecting) setCompact(false);
  }, {
    rootMargin: `-${HEADER_OFFSET}px 0px 0px 0px`,
    threshold: 0
  });

  io.observe(sentinel);
}

setupObserver();
window.addEventListener("resize", setupObserver);