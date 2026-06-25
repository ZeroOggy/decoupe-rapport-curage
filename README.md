# Découpe de rapport de curage

Outil web qui découpe un rapport d'inspection de canalisations (curage) en un fichier PDF par tronçon. Chaque tronçon est isolé avec ses pages associées (inspection, inclinaison, photos), renommé automatiquement, puis regroupé dans une archive ZIP unique.

**Tout le traitement se fait localement dans le navigateur** — aucun fichier n'est envoyé sur un serveur.

## Fonctionnalités

- Glisser-déposer (ou parcourir) un rapport PDF complet
- Détection automatique des tronçons via les pages « Inspection de tronçon - N »
- Regroupement des pages d'un même tronçon (inspection, inclinaison, photos)
- Renommage automatique au format `DATE_RUE_NUMÉRO.pdf` (ex. `20240315_Ch_des_Vignes_T12.pdf`)
- Abréviation des types de voie (Chemin → Ch, Route → Rte, Avenue → Av)
- Export de tous les tronçons dans un seul fichier ZIP
- Aperçu de la liste des fichiers générés avec leurs plages de pages
- Pages de couverture et de légende ignorées automatiquement

## Utilisation

1. Ouvrez `decoupe_rapport_troncons.html` dans un navigateur moderne.
2. Glissez votre rapport PDF dans la zone de dépôt (ou cliquez pour parcourir).
3. Attendez la fin de l'analyse et de la découpe.
4. Téléchargez le ZIP contenant un PDF par tronçon.

Aucune installation, aucune dépendance à installer : il suffit d'ouvrir le fichier HTML.

## Fonctionnement

L'outil lit le texte de chaque page avec **PDF.js** pour identifier :

- les pages d'**inspection de tronçon** (qui ouvrent un nouveau tronçon),
- les pages d'**inclinaison** et de **photos** rattachées au tronçon courant,
- les pages d'**informations générales**, ignorées.

La date et le nom de rue sont extraits du texte de la page d'inspection pour construire le nom de fichier. Les PDF par tronçon sont ensuite reconstruits avec **pdf-lib** et compressés avec **JSZip**.

## Dépendances (chargées via CDN)

- [PDF.js](https://github.com/mozilla/pdf.js) — lecture et extraction de texte
- [pdf-lib](https://github.com/Hopding/pdf-lib) — création des PDF par tronçon
- [JSZip](https://github.com/Stuk/jszip) — génération de l'archive ZIP

Une connexion internet est nécessaire au premier chargement pour récupérer ces librairies depuis le CDN.

## Confidentialité

Les fichiers ne quittent jamais votre machine. Toute l'analyse et la découpe sont effectuées dans le navigateur.

## Limitations

- Le format de nom de fichier dépend de la structure attendue du rapport (mentions « Inspection de tronçon - N », « Rue ... Fonction », date au format `JJ.MM.AAAA`). Un rapport structuré différemment peut ne pas être détecté correctement.
- Testé sur les rapports de curage suivant ce gabarit ; adaptez les expressions régulières dans le script si votre format diffère.

## Licence

À définir (par ex. MIT).
