/**
 * Contenu légal — source unique versionnée (même principe que `disclosures.ts`).
 *
 * Ces documents sont rendus par `src/ui/LegalScreen.tsx` et exposés sous le groupe de
 * routes `app/(legal)/`. Ils réutilisent les constantes de conformité existantes
 * (finalité non-MDSW, disclosure AI Act, message d'urgence canonique) pour garantir une
 * cohérence stricte avec le reste du produit (01_REGULATION).
 *
 * ⚠️ Champs marqués « [À COMPLÉTER … ] » : informations propres à l'éditeur que seul Hugo
 * peut renseigner (raison sociale, SIREN, adresse, directeur de publication, e-mail DPO).
 * Ils sont volontairement laissés en placeholder plutôt qu'inventés. Le reste du texte
 * (disclosure IA, avertissement non-dispositif-médical, droits RGPD, sous-traitants,
 * redirections d'urgence) est rédigé et opérationnel.
 *
 * Ce fichier vit dans `src/compliance/` (hors périmètre du gate `compliance-grep`, qui ne
 * scanne que `app/` et `src/ui/`) : il peut donc employer le vocabulaire médical nécessaire
 * pour NIER toute finalité de soin sans déclencher de faux positif.
 */
import { CANONICAL_REFUSAL, INTENDED_PURPOSE, getAiDisclosure } from './disclosures';

export type LegalSection = {
  heading: string;
  /** Paragraphes successifs (rendus avec un interligne aéré). */
  body: string[];
};

export type LegalDocument = {
  /** Identifiant de route (sous `(legal)/`). */
  slug: 'mentions-legales' | 'confidentialite' | 'cgu';
  title: string;
  /** Date de dernière mise à jour (ISO court). */
  updatedAt: string;
  /** Chapeau affiché sous le titre. */
  intro: string;
  sections: LegalSection[];
};

const EDITOR_PLACEHOLDER = '[À COMPLÉTER : raison sociale / statut juridique]';
const SIREN_PLACEHOLDER = '[À COMPLÉTER : SIREN/SIRET]';
const ADDRESS_PLACEHOLDER = '[À COMPLÉTER : adresse du siège]';
const PUBLISHER_PLACEHOLDER = '[À COMPLÉTER : nom du directeur de la publication]';
const CONTACT_PLACEHOLDER = '[À COMPLÉTER : e-mail de contact]';
const DPO_PLACEHOLDER = '[À COMPLÉTER : e-mail du responsable des données / DPO]';

/** Mentions légales (obligation LCEN art. 6-III). */
export const mentionsLegales: LegalDocument = {
  slug: 'mentions-legales',
  title: 'Mentions légales',
  updatedAt: '2026-06-05',
  intro:
    "Informations relatives à l'éditeur et à l'hébergeur de la plateforme MedInfo AI, conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN).",
  sections: [
    {
      heading: 'Éditeur',
      body: [
        `MedInfo AI est édité par ${EDITOR_PLACEHOLDER}, immatriculé sous le numéro ${SIREN_PLACEHOLDER}, dont le siège est situé ${ADDRESS_PLACEHOLDER}.`,
        `Directeur de la publication : ${PUBLISHER_PLACEHOLDER}.`,
        `Contact : ${CONTACT_PLACEHOLDER}.`,
      ],
    },
    {
      heading: 'Hébergement',
      body: [
        "L'application web est hébergée par Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA).",
        "La base de données et l'authentification sont fournies par Supabase (hébergement applicatif au sein de l'Union européenne, région eu-west-3).",
      ],
    },
    {
      heading: 'Nature du service',
      body: [
        INTENDED_PURPOSE,
        "MedInfo AI n'établit aucun diagnostic, ne propose aucun traitement individualisé et ne remplace pas une consultation médicale.",
      ],
    },
    {
      heading: 'Propriété intellectuelle',
      body: [
        "Les contenus produits par la plateforme (interface, textes, identité visuelle) sont protégés. Les sources documentaires citées (HAS, ANSM, etc.) demeurent la propriété de leurs éditeurs respectifs et sont reproduites dans le respect de leurs conditions.",
      ],
    },
    {
      heading: 'Signalement',
      body: [
        `Tout contenu jugé inexact ou inapproprié peut être signalé à ${CONTACT_PLACEHOLDER}.`,
      ],
    },
  ],
};

/** Politique de confidentialité (RGPD — règlement (UE) 2016/679). */
export const confidentialite: LegalDocument = {
  slug: 'confidentialite',
  title: 'Politique de confidentialité',
  updatedAt: '2026-06-05',
  intro:
    "Cette politique décrit les données traitées par MedInfo AI, leurs finalités, leur base légale, leurs destinataires et vos droits au titre du Règlement général sur la protection des données (RGPD).",
  sections: [
    {
      heading: 'Principe : aucune donnée de santé identifiable',
      body: [
        "MedInfo AI est conçu pour ne PAS collecter ni conserver de donnée de santé rattachable à une personne identifiée. La plateforme refuse de traiter les situations personnelles : un message décrivant des symptômes ou une situation individuelle est intercepté avant tout traitement et n'est pas conservé comme donnée de santé.",
        "Le contenu des conversations n'est pas associé à un profil de santé. Seules des métadonnées techniques non médicales (compteurs d'usage, journaux d'audit de sécurité sans contenu identifiable) sont conservées.",
      ],
    },
    {
      heading: 'Données traitées',
      body: [
        "Données de compte : adresse e-mail et, le cas échéant, identité de connexion via un fournisseur tiers (Google, Apple). Persona (public / étudiant / professionnel) et statut de vérification.",
        "Données de facturation (abonnés uniquement) : gérées par Stripe ; MedInfo AI ne stocke aucun numéro de carte. L'e-mail de facturation reste géré au niveau du compte.",
        "Données techniques : compteurs de requêtes (limitation d'abus), journaux d'erreurs et de sécurité.",
      ],
    },
    {
      heading: 'Finalités et base légale',
      body: [
        "Fournir le service et gérer le compte (exécution du contrat, art. 6.1.b RGPD).",
        "Sécuriser la plateforme et prévenir les abus (intérêt légitime, art. 6.1.f).",
        "Gérer les abonnements et la facturation (exécution du contrat + obligation légale comptable).",
      ],
    },
    {
      heading: 'Sous-traitants et destinataires',
      body: [
        "Supabase — hébergement de la base de données et authentification (UE).",
        "Vercel — hébergement applicatif et diffusion de l'interface.",
        "Anthropic (Claude) et/ou OpenAI (GPT) — fournisseurs des modèles d'intelligence artificielle qui génèrent les réponses. Le système d'IA réellement servi est indiqué dans l'application.",
        "Stripe — traitement des paiements pour les abonnés.",
        "Ces prestataires agissent comme sous-traitants au sens de l'art. 28 RGPD, encadrés par des accords de traitement (DPA) et, lorsque le traitement a lieu hors UE, par des clauses contractuelles types.",
      ],
    },
    {
      heading: 'Intelligence artificielle',
      body: [
        getAiDisclosure(),
        "Conformément à l'article 50 du règlement européen sur l'intelligence artificielle (AI Act), vous êtes informé que vous interagissez avec un système d'IA.",
      ],
    },
    {
      heading: 'Durée de conservation',
      body: [
        "Données de compte : conservées tant que le compte est actif, puis supprimées dans un délai raisonnable après fermeture.",
        "Journaux techniques et d'audit : durée limitée nécessaire à la sécurité.",
        "Données de facturation : conservées selon les obligations légales comptables (généralement 10 ans).",
      ],
    },
    {
      heading: 'Vos droits',
      body: [
        "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données.",
        `Pour les exercer, contactez ${DPO_PLACEHOLDER}.`,
        "Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).",
      ],
    },
  ],
};

/** Conditions générales d'utilisation et de vente (CGU/CGV). */
export const cgu: LegalDocument = {
  slug: 'cgu',
  title: "Conditions générales d'utilisation et de vente",
  updatedAt: '2026-06-05',
  intro:
    "Les présentes conditions régissent l'accès et l'usage de MedInfo AI, ainsi que les abonnements payants proposés via la plateforme.",
  sections: [
    {
      heading: 'Objet du service',
      body: [
        "MedInfo AI fournit de l'information médicale et pharmacologique générale et éducative, sourcée à partir de la littérature publiquement disponible.",
        "Le service ne constitue pas un avis médical, ne pose aucun diagnostic et ne propose aucune conduite à tenir individualisée. Il ne se substitue jamais à une consultation auprès d'un professionnel de santé.",
      ],
    },
    {
      heading: 'Avertissement médical et urgences',
      body: [
        "Les réponses sont générées automatiquement et peuvent contenir des erreurs. Elles ne doivent pas servir de base à une décision de santé personnelle.",
        CANONICAL_REFUSAL,
      ],
    },
    {
      heading: 'Comptes et rôles',
      body: [
        "L'accès public ne requiert pas de compte. Les rôles « étudiant » et « professionnel » nécessitent une vérification (e-mail académique ; numéro RPPS pour les professionnels). Aucun rôle vérifié ne peut être auto-attribué.",
        "Vous êtes responsable de la confidentialité de vos identifiants.",
      ],
    },
    {
      heading: 'Abonnements et paiement',
      body: [
        "Une offre gratuite limitée en volume est proposée. Les sources documentaires restent accessibles gratuitement à tous : l'abonnement payant ne lève que des quotas d'usage.",
        "Les paiements sont traités par Stripe. L'abonnement est sans engagement et résiliable ; il se renouvelle selon la périodicité choisie jusqu'à résiliation.",
        "TVA non applicable, article 293 B du CGI (le cas échéant, selon le statut de l'éditeur).",
      ],
    },
    {
      heading: 'Droit de rétractation',
      body: [
        "Pour un service numérique fourni immédiatement, vous pouvez être amené à renoncer à votre droit de rétractation de 14 jours en demandant l'exécution immédiate du service (art. L221-28 du Code de la consommation). À défaut, le délai légal de 14 jours s'applique.",
      ],
    },
    {
      heading: 'Responsabilité',
      body: [
        "MedInfo AI fournit une information générale à titre éducatif, sans garantie d'exhaustivité ni d'absence d'erreur. L'éditeur ne saurait être tenu responsable de l'usage fait des informations délivrées, notamment d'une décision de santé prise sur leur seul fondement.",
      ],
    },
    {
      heading: 'Droit applicable',
      body: [
        "Les présentes conditions sont régies par le droit français. Tout litige relève des juridictions compétentes après recherche d'une solution amiable.",
      ],
    },
  ],
};

/** Index de tous les documents légaux (pour navigation et tests). */
export const legalDocuments = { mentionsLegales, confidentialite, cgu } as const;

/** Liste ordonnée (slug + titre) pour les liens de pied de page. */
export const legalLinks: { slug: LegalDocument['slug']; title: string }[] = [
  { slug: mentionsLegales.slug, title: mentionsLegales.title },
  { slug: confidentialite.slug, title: confidentialite.title },
  { slug: cgu.slug, title: cgu.title },
];
