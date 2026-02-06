const texteGauche = document.getElementById("texte-gauche");
const texteDroite = document.getElementById("texte-droite");

if (texteGauche && texteDroite) {
  const hauteurTexteGauche = texteGauche.offsetHeight;
  const hauteurTexteDroite = texteDroite.offsetHeight;
  if (hauteurTexteGauche > hauteurTexteDroite) {
    texteDroite.style.height = `${hauteurTexteGauche}px`;
  } else if (hauteurTexteGauche < hauteurTexteDroite) {
    texteGauche.style.height = `${hauteurTexteDroite}px`;
  }
}

const forms = document.querySelectorAll("[data-bundle-add-to-cart]");
const wcAjaxUrl =
  window.wc_add_to_cart_params && window.wc_add_to_cart_params.wc_ajax_url
    ? window.wc_add_to_cart_params.wc_ajax_url.replace("%%endpoint%%", "add_to_cart")
    : "/?wc-ajax=add_to_cart";

forms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const productId = form.getAttribute("data-product-id");
    if (!productId) return;

    const data = new FormData();
    data.append("product_id", productId);
    data.append("quantity", "1");

    try {
      const response = await fetch(wcAjaxUrl, {
        method: "POST",
        body: data,
        credentials: "same-origin",
      });
      if (!response.ok) return;

      if (window.jQuery) {
        window.jQuery(document.body).trigger("wc_fragment_refresh");
      }

      const dropdownToggle = document.querySelector(".basket-dropdown-wrap [data-bs-toggle=\"dropdown\"]");
      if (dropdownToggle && window.bootstrap && window.bootstrap.Dropdown) {
        const dropdown = window.bootstrap.Dropdown.getOrCreateInstance(dropdownToggle);
        dropdown.show();
      }
    } catch (err) {
      // Silently fail to avoid breaking UX.
    }
  });
});
