# Villa Zen’O — site vitrine statique

Site bilingue (français par défaut, anglais dans `/en/`) pour la villa de la Palmeraie de Marrakech. Aucun hébergement payant n’est nécessaire : ce dossier est entièrement statique (HTML, CSS, JS et images).

## 1. Un seul fichier de configuration

Ouvrez `site/js/config.js`. C’est **le seul endroit** où modifier :

| Clé | Valeur actuelle | À changer si… |
| --- | --- | --- |
| `siteUrl` | `https://www.villazenomarrakech.com` | vous achetez un autre nom de domaine |
| `airbnbUrl` | `https://airbnb.fr/h/villazenomarrakech` | le lien court Airbnb change |
| `bookingUrlFr` | page Booking en français (`.fr.html`) | l’URL Booking change |
| `bookingUrlEn` | page Booking internationale (sans `.fr`) | idem |
| `whatsappNumber` | `212661147610` (sans `+` ni espaces) | le numéro WhatsApp change |
| `whatsappMessageFr` / `whatsappMessageEn` | messages préremplis | vous souhaitez un autre texte |

Après un changement de domaine, mettez aussi à jour les URL canoniques dans `index.html` et `en/index.html` (balises `canonical`, `hreflang`, Open Graph) ainsi que `robots.txt`, `sitemap.xml` et `llms.txt`.

Les boutons « Réserver sur Airbnb », « Réserver sur Booking.com » et « WhatsApp » (barre collante + bouton flottant) lisent ce fichier.

## 2. Héberger le site gratuitement

Le dossier à mettre en ligne est `site/` (pas le dossier parent).

### GitHub Pages

1. Créez un compte sur [github.com](https://github.com) si besoin.
2. Nouveau dépôt, par exemple `villa-zeno`.
3. Envoyez le **contenu** de `site/` à la racine du dépôt (ou dans un dossier `docs` si vous préférez).
4. Settings → Pages → Source : branche `main`, dossier `/ (root)` ou `/docs`.
5. L’adresse temporaire ressemblera à `https://votre-compte.github.io/villa-zeno/`.
6. Plus tard : Settings → Pages → Custom domain, puis ajoutez `www.villazenomarrakech.com`.

### Cloudflare Pages

1. Créez un compte sur [pages.cloudflare.com](https://pages.cloudflare.com).
2. « Create a project » → uploader le dossier `site/` (Direct Upload) ou relier le dépôt GitHub.
3. Cadre de compilation : aucun (site déjà prêt). Dossier de sortie : `/`.
4. Ajoutez ensuite votre nom de domaine dans les réglages du projet.

### Netlify

1. Compte sur [netlify.com](https://www.netlify.com).
2. « Add new site » → « Deploy manually » et glissez le dossier `site/`, ou reliez GitHub.
3. Pas de commande de build. Le site est en ligne en quelques secondes.
4. Domain settings → Add custom domain.

Ces trois services offrent un HTTPS gratuit.

## 3. Acheter et relier un nom de domaine

Vous ne payez que le nom (environ **10 à 15 € par an** pour un `.com` ou un `.fr` chez un registrar comme OVH, Gandi, Cloudflare Registrar ou Namecheap).

Vérification RDAP (registre, novembre 2026) — une réponse HTTP 404 signifie « non enregistré » au moment du test, ce n’est pas une garantie d’achat :

| Nom | Statut constaté |
| --- | --- |
| **villazenomarrakech.com** | probablement disponible (RDAP 404) — recommandé, déjà utilisé comme domaine canonique du site |
| **villazenomarrakech.com** | probablement disponible (RDAP 404) |
| **villa-zeno-marrakech.com** | probablement disponible (RDAP 404) |
| **villazenomarrakech.fr** | probablement disponible (RDAP AFNIC 404) |
| **villazeno-marrakech.fr** | probablement disponible |
| **villa-zeno.fr** | probablement disponible |
| **villa-zeno-marrakech.fr** | probablement disponible |
| villazeno.com | **pris** (enregistré en 2019, expire le 8 oct. 2027) |
| villa-zeno.com | **pris** (enregistré le 17 mai 2026, expire le 17 mai 2029) |

Pour relier le domaine : chez votre registrar, créez soit un enregistrement CNAME `www` vers l’hôte Pages (GitHub / Cloudflare / Netlify), soit les serveurs DNS indiqués par l’hébergeur. Activez ensuite le domaine personnalisé dans l’interface de l’hébergeur (le certificat HTTPS est généralement automatique).

## 4. Déclarer le site à Google Search Console

1. Allez sur [search.google.com/search-console](https://search.google.com/search-console).
2. Ajoutez une propriété « Préfixe d’URL » : `https://www.villazenomarrakech.com`.
3. Validez via un enregistrement DNS TXT, un fichier HTML, ou en reliant votre compte Cloudflare / Google Analytics.
4. Envoyez le sitemap : `https://www.villazenomarrakech.com/sitemap.xml`.

`robots.txt` autorise aussi les robots d’IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.). Un fichier `llms.txt` résume la villa pour ces assistants.

## 5. Photos sans texte

Les visuels nettoyés (sans slogans superposés) se trouvent dans `photos-sans-texte/`. Vous pouvez les réutiliser sur Airbnb et Booking. Les versions WebP optimisées du site sont dans `site/images/`.

## 6. Contenu privé à ne jamais publier

Le livret d’accueil des voyageurs contient des informations réservées aux hôtes (mot de passe wifi, numéros privés, consignes d’accès). Elles n’ont **pas** été reprises sur le site. Communiquez-les uniquement après la réservation.
