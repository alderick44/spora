// Quantités du mini-panier : flèches ▲ ▼ ou chiffre tapé dans la case.
// Il y a deux mini-paniers dans la page (mobile et ordinateur) : on met les deux à jour.
(function () {
  const WIDGET = '.widget_shopping_cart_content';

  function replaceFragments(fragments) {
    Object.entries(fragments).forEach(([selector, html]) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.outerHTML = html;
      });
    });
  }

  // Le HTML est remplacé, donc l'élément qui a le focus peut disparaître.
  // On note où est le focus juste avant (la case ou une flèche, et pour quel article),
  // puis on le remet sur l'équivalent dans le nouveau HTML.
  function rememberFocus() {
    const el = document.activeElement;
    const widget = el && el.closest(WIDGET);
    if (!widget) return null; // focus hors du panier : on n'y touche pas

    let selector = null;
    if (el.matches('.mini-cart-qty-input')) selector = '.mini-cart-qty-input';
    else if (el.matches('.mini-cart-qty-btn')) selector = `.mini-cart-qty-btn[data-action="${el.dataset.action}"]`;

    return {
      widgetIndex: Array.from(document.querySelectorAll(WIDGET)).indexOf(widget),
      key: el.dataset.cart_item_key,
      selector,
    };
  }

  function restoreFocus(saved) {
    if (!saved) return;
    const widget = document.querySelectorAll(WIDGET)[saved.widgetIndex];
    if (!widget) return;
    const same = saved.selector && saved.key && widget.querySelector(
      `${saved.selector}[data-cart_item_key="${CSS.escape(saved.key)}"]:not(:disabled)`
    );
    const fallback = widget.closest('.basket-dropdown')?.querySelector('.mini-cart-close');
    (same || fallback)?.focus();
  }

  function refreshFromServer() {
    if (window.jQuery) jQuery(document.body).trigger('wc_fragment_refresh');
  }

  // el : le bouton ou la case qui a déclenché la mise à jour
  function updateQty(el, params) {
    const widget = el.closest(WIDGET);
    if (!widget || widget.classList.contains('is-updating')) return;

    const key = el.dataset.cart_item_key;
    const cartBody = el.closest('.mini-cart-body');

    // Bloque les actions répétées pendant la requête, dans les deux paniers
    document.querySelectorAll(WIDGET).forEach((w) => w.classList.add('is-updating'));

    const body = new FormData();
    body.append('action', 'spora_update_mini_cart_qty');
    body.append('nonce', (cartBody && cartBody.dataset.qtyNonce) || '');
    body.append('cart_item_key', key);
    Object.entries(params).forEach(([name, value]) => body.append(name, value));

    fetch(sporaMiniCart.ajaxUrl, { method: 'POST', credentials: 'same-origin', body })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.fragments) {
          const focus = rememberFocus();
          replaceFragments(data.fragments);
          restoreFocus(focus);
        } else {
          // Panier périmé, nonce expiré ou stock atteint : on recharge le panier à jour
          refreshFromServer();
        }
      })
      .catch(refreshFromServer)
      .finally(() => {
        document.querySelectorAll(WIDGET).forEach((w) => w.classList.remove('is-updating'));
      });
  }

  // Flèches
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.mini-cart-qty-btn');
    if (!btn) return;
    e.preventDefault();
    updateQty(btn, { action_type: btn.dataset.action });
  });

  // Chiffre tapé : envoyé quand on quitte la case ou qu'on appuie sur Entrée
  function commitInput(input) {
    const typed = input.value.trim();
    if (!/^\d+$/.test(typed)) {
      input.value = input.defaultValue; // valeur invalide : on remet l'ancienne
      return;
    }
    if (parseInt(typed, 10) === parseInt(input.defaultValue, 10)) return;
    updateQty(input, { action_type: 'set', quantity: typed });
  }

  document.addEventListener('change', function (e) {
    if (e.target.matches('.mini-cart-qty-input')) commitInput(e.target);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.matches('.mini-cart-qty-input')) return;
    e.preventDefault();
    commitInput(e.target);
  });
})();

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
    const closeBtn = e.target.closest('.mini-cart-close');
    if (closeBtn) {
      const wrap = closeBtn.closest('.basket-dropdown-wrap');
      const toggleBtn = wrap && wrap.querySelector('button[data-bs-toggle="dropdown"]');
      if (!toggleBtn) return;

      if (window.bootstrap && window.bootstrap.Dropdown) {
        window.bootstrap.Dropdown.getOrCreateInstance(toggleBtn).hide();
      } else if (toggleBtn.getAttribute('aria-expanded') === 'true') {
        toggleBtn.click();
      }
      return;
    }

    if (e.target.closest('.single_add_to_cart_button')) {
      setTimeout(openMiniCart, 0);
    }
  });
})();


