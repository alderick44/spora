// (() => {
//   const header = document.querySelector(".header");
//   if (!header) return;

//   const mobileQuery = window.matchMedia("(max-width: 767.98px)");
//   const desktopThresholds = { compactAt: 500, expandAt: 400 };
//   const mobileThresholds = { compactAt: 240, expandAt: 220 };
//   let compactAt = desktopThresholds.compactAt;
//   let expandAt = desktopThresholds.expandAt;
//   let ticking = false;
//   let isCompact = false;     

//   const updateThresholds = () => {
//     if (mobileQuery.matches) {
//       compactAt = mobileThresholds.compactAt;
//       expandAt = mobileThresholds.expandAt;
//       return;
//     }
//     compactAt = desktopThresholds.compactAt;
//     expandAt = desktopThresholds.expandAt;
//   };

//   const update = () => {
//     const scrollY = window.scrollY;
    

//     if (scrollY > compactAt && !isCompact) {
//       isCompact = true;
//       header.classList.add("is-compact");
//     } else if (scrollY < expandAt && isCompact) {
//       isCompact = false;
//       header.classList.remove("is-compact");
//     }
    
//     ticking = false;
//   };

//   const onScroll = () => {
//     if (ticking) return;
//     ticking = true;
//     window.requestAnimationFrame(update);
//   };

//   updateThresholds();
//   update();
//   window.addEventListener("scroll", onScroll, { passive: true });
//   mobileQuery.addEventListener("change", () => {
//     updateThresholds();
//     update();
//   });
// })();
