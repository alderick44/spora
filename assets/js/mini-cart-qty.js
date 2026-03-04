//Make a proper script  for better UX and a more robust solution


// document.addEventListener('click', function (e) {
//   const btn = e.target.closest('.mini-cart-qty-btn');
//   if (!btn) return;

//   e.preventDefault();

//   const actionType = btn.dataset.action;
//   const cartItemKey = btn.dataset.cart_item_key;
//   if (!actionType || !cartItemKey) return;

//   const formData = new FormData();
//   formData.append('action', 'spora_update_mini_cart_qty');
//   formData.append('action_type', actionType);
//   formData.append('cart_item_key', cartItemKey);

//   fetch(sporaMiniCart.ajaxUrl, {
//     method: 'POST',
//     credentials: 'same-origin',
//     body: formData
//   }).then(res => res.json())
//     .then(data => {
//       if (!data || !data.fragments) return;
//       Object.entries(data.fragments).forEach(([selector, html]) => {
//         const el = document.querySelector(selector);
//         if (el) el.outerHTML = html;
//       });
//     });
// });

//Code réalisé avec l'IA. À améliorer et à étudier.
(function () {
  function getMiniCartButton() {
    return Array.from(
      document.querySelectorAll('.basket-dropdown-wrap > button[data-bs-toggle="dropdown"]')
    ).find((el) => el.offsetParent !== null);
  }

  function openMiniCart() {
    const btn = getMiniCartButton();
    if (!btn) return;

    if (window.bootstrap && window.bootstrap.Dropdown) {
      window.bootstrap.Dropdown.getOrCreateInstance(btn).show();
      return;
    }

    if (btn.getAttribute('aria-expanded') !== 'true') {
      btn.click();
    }
  }
  if (window.jQuery) {
    jQuery(document.body).on('added_to_cart', function () {
      setTimeout(openMiniCart, 60);
    });
  }


  document.addEventListener('click', function (e) {
    if (e.target.closest('.single_add_to_cart_button')) {
      setTimeout(openMiniCart, 0);
    }
  });
})();



