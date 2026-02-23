//Make a proper script  for better UX and a more robust solution
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.mini-cart-qty-btn');
  if (!btn) return;

  e.preventDefault();

  const actionType = btn.dataset.action;
  const cartItemKey = btn.dataset.cart_item_key;
  if (!actionType || !cartItemKey) return;

  const formData = new FormData();
  formData.append('action', 'spora_update_mini_cart_qty');
  formData.append('action_type', actionType);
  formData.append('cart_item_key', cartItemKey);

  fetch(sporaMiniCart.ajaxUrl, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData
  }).then(res => res.json())
    .then(data => {
      if (!data || !data.fragments) return;
      Object.entries(data.fragments).forEach(([selector, html]) => {
        const el = document.querySelector(selector);
        if (el) el.outerHTML = html;
      });
    });
});
