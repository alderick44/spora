const texteGauche = document.getElementById('texte-gauche');
const texteDroite = document.getElementById('texte-droite');
const hauteurTexteGauche = texteGauche.offsetHeight;
const hauteurTexteDroite = texteDroite.offsetHeight;
console.log("Hauteur texte de gauche: " + hauteurTexteGauche);
console.log("Hauteur texte de droite: " + hauteurTexteDroite);
if (hauteurTexteGauche > hauteurTexteDroite) {
texteDroite.style.height = hauteurTexteGauche + "px";
console.log("Nouvelle hauteur droite: " + texteDroite.style.height);
}
else if (hauteurTexteGauche < hauteurTexteDroite) {
    texteGauche.style.height = hauteurTexteDroite + "px";
    console.log("Nouvelle hauteur gauche: " + texteGauche.style.height);
}