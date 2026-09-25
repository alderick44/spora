// Formulaire « Vous ne trouvez pas votre champignon ? » : envoi sans rechargement.
// Sans JS, le formulaire fonctionne quand même (redirection vers la page).
document.querySelectorAll('.demande-champignon-form').forEach(function (form) {
  var avertir = form.querySelector('[name="avertir"]');
  var blocCourriel = form.querySelector('.demande-champignon-courriel');
  var courriel = form.querySelector('[name="courriel"]');
  var message = form.querySelector('.demande-champignon-message');
  var bouton = form.querySelector('[type="submit"]');

  // Le courriel n'apparaît que si la personne veut être avertie.
  function majCourriel() {
    blocCourriel.hidden = !avertir.checked;
    courriel.required = avertir.checked;
  }
  avertir.addEventListener('change', majCourriel);
  majCourriel();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var espece = form.querySelector('[name="espece"]');
    if (!espece.value.trim()) {
      message.textContent = 'Entrez le nom du champignon.';
      espece.focus();
      return;
    }
    if (avertir.checked && !courriel.checkValidity()) {
      message.textContent = 'Entrez un courriel valide pour être averti.';
      courriel.focus();
      return;
    }

    var donnees = new FormData(form);
    donnees.append('ajax', '1');
    bouton.disabled = true;
    message.textContent = 'Envoi…';

    // getAttribute : form.action renverrait le champ caché name="action", pas l'URL.
    fetch(form.getAttribute('action'), { method: 'POST', body: donnees, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        message.textContent = r.data && r.data.message ? r.data.message : 'Merci !';
        if (r.success) {
          form.reset();
          majCourriel();
        }
      })
      .catch(function () {
        message.textContent = 'Votre demande n\'a pas pu être envoyée. Réessayez plus tard.';
      })
      .finally(function () {
        bouton.disabled = false;
      });
  });
});
