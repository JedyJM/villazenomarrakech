# Mettre à jour le script des demandes

Compte : villazeno.marrakech@gmail.com. Projet autonome sur script.google.com (il n’est pas collé au classeur). Le code ouvre le classeur tout seul.

1. Allez sur https://script.google.com avec le compte villazeno.marrakech@gmail.com.
2. Ouvrez le projet autonome déjà déployé (son adresse se termine par /exec).
3. Effacez le code affiché, puis collez tout le fichier guest/apps-script/Code.gs.
4. Enregistrez.
5. Cliquez sur Déployer, puis Gérer les déploiements.
6. Sur le déploiement Application Web, cliquez le crayon Modifier.
7. Version : Nouvelle version. Laissez « Exécuter en tant que : Moi » et « Qui a accès : Tout le monde ».
8. Cliquez sur Déployer. L’adresse /exec ne change pas. Elle est déjà dans guest/js/requests.js (APPS_SCRIPT_URL).

La page Mes demandes lit `?action=list&stay=…`. Il faut republier le script pour que cette lecture fonctionne. Sans identifiant de séjour, la page reste vide.

## Statuts et récapitulatif

Après avoir collé le nouveau Code.gs :

1. Enregistrez, puis Déployer → Gérer les déploiements → crayon Modifier → Version : Nouvelle version → Déployer. L’adresse /exec ne change pas.
2. Dans l’éditeur, choisissez la fonction `installDemandesTrigger` dans la liste des fonctions, puis cliquez sur Exécuter. Autorisez le script si Google le demande. Cela crée un déclencheur horaire qui passe une demande Confirmée en Terminée deux heures après l’heure prévue. Vous ne le lancez qu’une fois.
3. Ouvrez le classeur, onglet Demandes. La colonne `statut` propose Envoyée, Confirmée, Terminée, Annulée. La colonne `offert` est une case à cocher. Une nouvelle demande arrive en Envoyée. Vous pouvez changer le statut ou cocher Offert à la main : le portail suit la feuille.
4. Onglet Réservations : ajoutez, si elles n’y sont pas, les colonnes `chauffage_piscine_jours`, `chauffage_piscine_tarif_eur`, `chauffage_piscine_offert`, `chauffage_jacuzzi_jours`, `chauffage_jacuzzi_tarif_eur`, `chauffage_jacuzzi_offert`. Les dates de séjour sont lues dans `date_arrivee` et `date_depart` (ou `check_in` / `check_out`). L’identifiant de séjour est `booking_id`.
5. Sur le même onglet, ajoutez `lien_actif` (case à cocher, cochée tant que le lien est valable) et `lien_expire_le` (date). Sans `lien_expire_le`, le lien expire 3 jours après `date_depart`. Décochez `lien_actif` pour couper le lien tout de suite. Une date dans `lien_expire_le` remplace cette échéance. Le jour du départ, les demandes de service se ferment ; Mes demandes, le récapitulatif, Accès, Contacts et le paiement restent ouverts jusqu’à l’expiration.
6. Le lien Confirmer dans le message WhatsApp ouvre la page « Demande confirmée » et passe le statut à Confirmée.
