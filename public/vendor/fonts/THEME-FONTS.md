# Polices de la direction éditoriale

Inter et Schibsted Grotesk (graisses normales 400, 500, 600 et 700) ont été
ajoutées le 1er octobre 2026 à la feuille locale déjà utilisée par les outils
HTML. Expo web charge désormais cette même feuille : aucune requête Google
Fonts n’est nécessaire pendant la consultation.

Sources : réponse de l’API officielle Google Fonts pour les familles Inter et
Schibsted Grotesk, fichiers TTF fournis par `fonts.gstatic.com`. Conversion de
conteneur TTF → WOFF avec fontTools et sous-ensemble latin aligné sur les autres
polices locales (accents français, œ/Œ, ponctuation et symboles usuels inclus).
Les contours des glyphes retenus sont inchangés. Les autres écritures utilisent
la pile de polices de repli. WOFF est compatible avec les navigateurs web ciblés ; les WOFF2
existants de Source Serif 4 et JetBrains Mono sont réutilisés.

Les licences complètes et notices de copyright sont jointes :
`Inter-OFL.txt` et `SchibstedGrotesk-OFL.txt`, récupérées depuis le dépôt officiel
`google/fonts` (`ofl/inter/OFL.txt`, `ofl/schibstedgrotesk/OFL.txt`).

API source :
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap

Fichiers Inter, version v20 :

- 400 : https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf
- 500 : https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf
- 600 : https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf
- 700 : https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf

Fichiers Schibsted Grotesk, version v7 :

- 400 : https://fonts.gstatic.com/s/schibstedgrotesk/v7/JqzK5SSPQuCQF3t8uOwiUL-taUTtarVKQ9vZ6pJJWlMNIsEATw.ttf
- 500 : https://fonts.gstatic.com/s/schibstedgrotesk/v7/JqzK5SSPQuCQF3t8uOwiUL-taUTtarVKQ9vZ6pJJWlMNEMEATw.ttf
- 600 : https://fonts.gstatic.com/s/schibstedgrotesk/v7/JqzK5SSPQuCQF3t8uOwiUL-taUTtarVKQ9vZ6pJJWlMN_MYATw.ttf
- 700 : https://fonts.gstatic.com/s/schibstedgrotesk/v7/JqzK5SSPQuCQF3t8uOwiUL-taUTtarVKQ9vZ6pJJWlMNxcYATw.ttf

Les polices d’export documentaire (CV, article, diapositives) restent sous le
contrôle de leurs thèmes propres. Cette uniformisation concerne l’interface,
pas le style des documents produits. Le chargement natif n’a pas été modifié.
