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

## Espace admin, onglet Séjours

Même déploiement : collez `Code.gs`, puis Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer. L’adresse /exec ne change pas.

Le script s’exécute avec le compte villazeno.marrakech@gmail.com. `ADMIN_ALLOWLIST` en tête de `Code.gs` limite la connexion Google. Ajoutez-y l’adresse Google de Mehdi et celle de Jedy. Tant que `ADMIN_TEST_MODE` est true, l’aperçu peut aussi passer par le bouton Mode test (`test=1`). Remettez `ADMIN_TEST_MODE` à false avant un usage réel.

Nouvelles actions : `stays` et `stay` en lecture, `save-stay`, `stay-link` (prolonger ou désactiver le lien) et `admin-auth` en écriture. L’encaissement réutilise `save-stay` et ajoute les colonnes `encaisse_total_eur`, `encaisse_mode`, `encaisse_le` et `offerts` (liste des lignes offertes, séparées par des virgules). Rien n’est envoyé à l’invité.

Nouvelles colonnes de l’onglet Réservations, ajoutées toutes seules au premier enregistrement si elles manquent :

`nom`, `telephone`, `source`, `adultes`, `enfants`, `ages_enfants`, `notes`, `airbnb_frais_chambre`, `airbnb_reduction`, `airbnb_frais_service`, `airbnb_gain`, `booking_montant`, `booking_commission`, `booking_frais_bancaires`, `booking_net`, `direct_tarif`, `acompte_montant`, `acompte_date`, `acompte_mode`, `reste_a_payer`, `offert_petit_dejeuner`.

Les colonnes déjà prévues restent utilisées : `booking_id`, `date_arrivee`, `date_depart`, `lien_actif`, `lien_expire_le`, `chauffage_piscine_jours`, `chauffage_piscine_tarif_eur`, `chauffage_piscine_offert`, `chauffage_jacuzzi_jours`, `chauffage_jacuzzi_tarif_eur`, `chauffage_jacuzzi_offert`. Pour un séjour Booking, le portail invité ajoute la taxe de séjour (2,50 € × personnes × nuits) au récapitulatif, sans la retrancher du net.

## Admin, onglet Demandes

Même republication (Nouvelle version). Actions protégées par la liste Google : `demandes` en lecture, `set-demande` pour écrire `statut` ou `offert`. Aucune colonne nouvelle : le nom du prestataire est déjà `destinataire`, le prix `total_dh`, le détail (date, heure, personnes, jeton) reste dans `details_json`.

## Admin, onglet Stats et dépenses

Même republication. Le script crée l’onglet `Dépenses` s’il manque, avec les colonnes `id`, `date`, `categorie`, `detail`, `fournisseur`, `montant_dh`, `montant_eur`, `devise_saisie`, `facture_url`, `cree_le`.

Actions : `depenses` (liste d’une année), `save-depense` et `delete-depense`. La photo de facture est enregistrée dans le dossier Drive `Villa Zen’O – Factures` du compte de la villa. Le taux est 1 € = 10 DH. Rien n’est envoyé à l’invité.
