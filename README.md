# Découpe de rapport de curage

Outil web qui découpe un rapport d'inspection de canalisations (curage) en un fichier PDF par tronçon. Chaque tronçon est isolé avec ses pages associées (inspection, inclinaison, photos), peut recevoir son plan en dernière page, est renommé automatiquement, puis regroupé dans une archive ZIP unique.

**Tout le traitement se fait localement dans le navigateur** — aucun fichier n'est envoyé sur un serveur.

## Fonctionnalités

- Deux zones de dépôt : le **rapport** (requis) et les **plans** (optionnels)
- Détection automatique des tronçons via les pages « Inspection de tronçon - N »
- Regroupement des pages d'un même tronçon (inspection, inclinaison, photos)
- Rattachement automatique des plans à chaque tronçon, ajoutés en dernière page :
  - en priorité via le champ « Plan N° » lu dans le rapport,
  - à défaut via le numéro de tronçon lui-même
- Prise en charge des plans couvrant plusieurs tronçons (`Plan_74-77.pdf`, `Plan_1-6_10-17.pdf`, `Plan_175_et_176.pdf`…)
- Intégration des plans même chiffrés (rendu en image si la copie directe échoue)
- Renommage automatique au format `DATE_RUE_NUMÉRO.pdf` (ex. `20240315_Ch_des_Vignes_12.pdf`)
- Abréviation des types de voie (Chemin → Ch, Route → Rte, Avenue → Av)
- Export de tous les tronçons dans un seul fichier ZIP
- Avertissements clairs : plans non rattachés, tronçons sans plan
- Pages de couverture, légende et « Informations générales » ignorées automatiquement

## Structure du projet

```
decoupe-rapport-curage/
├── index.html        # Structure de la page
├── css/
│   └── style.css     # Styles
├── js/
│   └── app.js        # Logique (lecture, analyse, liaison des plans, découpe, ZIP)
├── README.md
├── LICENSE
└── .gitignore
```

## Utilisation

1. Ouvrez `index.html` dans un navigateur moderne.
2. Déposez le **rapport PDF** dans la zone de gauche.
3. (Optionnel) Déposez un ou plusieurs **plans** dans la zone de droite.
4. Cliquez sur **Découper le rapport**.
5. Téléchargez le ZIP contenant un PDF par tronçon.

Aucune installation ni dépendance à installer : il suffit d'ouvrir le fichier HTML. Une connexion internet est nécessaire au premier chargement pour récupérer les librairies depuis le CDN.

## Fonctionnement

L'outil lit le texte de chaque page du rapport avec **PDF.js** pour identifier :

- les pages d'**inspection de tronçon** (qui ouvrent un nouveau tronçon),
- les pages d'**inclinaison** et de **photos** rattachées au tronçon courant,
- le champ **« Plan N° »** éventuel, qui sert à associer le bon plan,
- les pages d'**informations générales**, ignorées.

La date et le nom de rue sont extraits du texte de la page d'inspection pour construire le nom de fichier. Les noms des fichiers plans sont analysés pour en déduire les numéros de tronçons couverts (plages `74-77`, listes, etc.). Chaque PDF de tronçon est reconstruit avec **pdf-lib**, son plan ajouté en dernière page, puis l'ensemble est compressé avec **JSZip**.

## Dépendances (chargées via CDN)

- [PDF.js](https://github.com/mozilla/pdf.js) — lecture, extraction de texte et rendu des plans chiffrés
- [pdf-lib](https://github.com/Hopding/pdf-lib) — création des PDF par tronçon
- [JSZip](https://github.com/Stuk/jszip) — génération de l'archive ZIP

## Confidentialité

Les fichiers ne quittent jamais votre machine. Toute l'analyse et la découpe sont effectuées dans le navigateur.

## Limitations

- La détection dépend de la structure attendue du rapport (mentions « Inspection de tronçon - N », « Rue ... Fonction », « Plan N° », date au format `JJ.MM.AAAA`). Un rapport structuré différemment peut ne pas être détecté correctement.
- Le rattachement des plans repose sur les numéros présents dans les noms de fichiers ; nommez-les de façon cohérente (`Plan_67.pdf`, `Plan_74-77.pdf`…).
- Adaptez les expressions régulières dans `js/app.js` si votre format de rapport diffère.

## Licence

Distribué sous licence MIT. Voir [LICENSE](LICENSE).
