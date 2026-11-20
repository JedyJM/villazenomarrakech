# Enregistrer les demandes dans Google Sheet

À faire une seule fois, dans le classeur **Villa Zen’O – Bookings**.

1. Ouvrez le classeur **Villa Zen’O – Bookings**.
2. Menu **Extensions**, puis **Apps Script**.
3. Effacez le code déjà affiché, puis collez tout le fichier `guest/apps-script/Code.gs`.
4. Cliquez sur **Déployer**, puis **Nouveau déploiement**.
5. Type : **Application Web**. Exécuter en tant que **Moi**. Accès : **Tout le monde**.
6. Cliquez sur **Déployer**, autorisez l’accès, puis copiez l’URL qui se termine par `/exec`.
7. Collez cette URL dans `guest/js/requests.js`, à la ligne `var APPS_SCRIPT_URL = "";`, entre les guillemets.
8. Enregistrez. Les prochaines demandes s’ajoutent dans l’onglet **Demandes**. Le lien WhatsApp confirme la ligne.
