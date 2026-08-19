# Polices du créateur de CV

Cinq familles sous licence **SIL Open Font License 1.1** (redistribution libre, y compris
embarquée dans un PDF), réduites au jeu de caractères WinAnsi — exactement celui que le
moteur du CV sait écrire.

| Famille | Style | Licence |
|---|---|---|
| Inter | sans serif, neutre et moderne | `inter-OFL.txt` |
| Source Sans 3 | sans serif humaniste, très lisible en petit corps | `sourcesans3-OFL.txt` |
| Public Sans | sans serif institutionnel (celui de MedInfo) | `publicsans-OFL.txt` |
| EB Garamond | serif classique | `ebgaramond-OFL.txt` |
| Lora | serif contemporain | `lora-OFL.txt` |

Chaque fichier `.ttf` sert **deux fois** : `@font-face` pour l'aperçu à l'écran, et
embarquement dans le PDF exporté (jsPDF `addFileToVFS` + `addFont`). Un seul fichier par
style, donc aucun risque de divergence entre ce que l'on voit et ce que l'on télécharge.

Les fichiers sont chargés **à la demande** : ouvrir le créateur de CV n'en télécharge aucun,
seule la famille choisie (et seulement ses styles réellement utilisés) est récupérée.

Régénération (nécessite le réseau et `pip install fonttools brotli`) :

    node scripts/dev/build-cv-fonts.mjs

Le script télécharge les TTF depuis Google Fonts, les sous-ensemble avec `pyftsubset`, puis
il faut relancer `node scripts/dev/extract-pdf-font-metrics.cjs` pour régénérer la table de
largeurs embarquée dans `public/cv-builder.html`.
