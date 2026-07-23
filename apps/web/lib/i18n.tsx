'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Lightweight client-side i18n for the static export.
 *
 * - Locale is auto-detected from the browser on first visit, then persisted to
 *   localStorage when the user picks one from the switcher.
 * - `t(key)` looks up the active locale, falls back to English, then to the key
 *   itself — so untranslated strings degrade gracefully rather than breaking.
 * - Arabic switches the document to right-to-left.
 *
 * Only high-traffic first-impression strings are translated today (nav, hero,
 * founding offer, auth). Everything else renders its inline English until its
 * keys are added here — no page ever breaks from a missing translation.
 */

export const LOCALES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];
const RTL_LOCALES: Locale[] = ['ar'];
const STORAGE_KEY = 'vpn.locale';

type Dict = Record<string, string>;

const en: Dict = {
  'nav.howItWorks': 'How It Works',
  'nav.forMembers': 'For Members',
  'nav.forGroups': 'For Groups',
  'nav.events': 'Events',
  'nav.pricing': 'Pricing',
  'nav.login': 'Log in',
  'nav.signup': 'Sign up free',
  'nav.dashboard': 'Dashboard',
  'nav.logout': 'Log out',
  'common.language': 'Language',
  'founding.bar': 'Founding offer — the first 200 businesses get every feature free.',
  'founding.barSpots': 'Only {n} of {limit} spots left.',
  'founding.barCta': 'No credit card. Claim your spot →',
  'founding.cardTitle': 'Founding offer: the first 200 businesses get every paid feature free',
  'founding.cardBody': 'Sign up now and keep full Pro access at no cost.',
  'founding.cardAfter': 'After the first 200 members, the plans below apply.',
  'founding.closedTitle': 'All 200 founding spots have been claimed 🙌',
  'founding.closedBody': 'The plans below now apply to new members. Thank you to our founding businesses!',
  'hero.badge': 'The AI-powered referral network for businesses',
  'hero.titleA': 'Stop hoping for referrals.',
  'hero.titleHighlight': 'Build a referral engine.',
  'hero.titleB': '',
  'hero.sub': 'Referral Nova turns your network into revenue: AI matches you with trusted partners, and qualified referrals flow in both directions — continuously.',
  'hero.sub2': 'Other tools help you find who could introduce you. Referral Nova builds you a system where introductions actually happen, week after week.',
  'hero.ctaJoin': 'Join free',
  'hero.ctaHow': 'See how it works',
  'auth.signupTitle': 'Create your account',
  'auth.signupSub': 'It takes under a minute. No credit card required.',
  'auth.loginTitle': 'Welcome back',
  'auth.loginSub': 'Log in to your account.',
  'auth.firstName': 'First name',
  'auth.lastName': 'Last name',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.createAccount': 'Create account',
  'auth.logIn': 'Log in',
  'auth.haveAccount': 'Already have an account?',
  'auth.noAccount': "Don't have an account?",
  'auth.orEmail': 'or with email',
  'auth.googleSignup': 'Sign up with Google',
  'auth.googleLogin': 'Continue with Google',
};

const es: Dict = {
  'nav.howItWorks': 'Cómo funciona',
  'nav.forMembers': 'Para miembros',
  'nav.forGroups': 'Para grupos',
  'nav.events': 'Eventos',
  'nav.pricing': 'Precios',
  'nav.login': 'Iniciar sesión',
  'nav.signup': 'Regístrate gratis',
  'nav.dashboard': 'Panel',
  'nav.logout': 'Cerrar sesión',
  'common.language': 'Idioma',
  'founding.bar': 'Oferta de lanzamiento: los primeros 200 negocios obtienen todas las funciones gratis.',
  'founding.barSpots': 'Solo quedan {n} de {limit} plazas.',
  'founding.barCta': 'Sin tarjeta. Reserva tu lugar →',
  'founding.cardTitle': 'Oferta de lanzamiento: los primeros 200 negocios obtienen todas las funciones de pago gratis',
  'founding.cardBody': 'Regístrate ahora y conserva el acceso Pro completo sin costo.',
  'founding.cardAfter': 'Después de los primeros 200 miembros, se aplican los planes de abajo.',
  'founding.closedTitle': 'Se han ocupado las 200 plazas de lanzamiento 🙌',
  'founding.closedBody': 'Los planes de abajo ahora se aplican a los nuevos miembros. ¡Gracias a nuestros negocios fundadores!',
  'hero.badge': 'La red de referidos con IA para negocios',
  'hero.titleA': 'Deja de esperar referidos.',
  'hero.titleHighlight': 'Construye un motor de referidos.',
  'hero.titleB': '',
  'hero.sub': 'Referral Nova convierte tu red en ingresos: la IA te conecta con socios de confianza y los referidos calificados fluyen en ambas direcciones, continuamente.',
  'hero.sub2': 'Otras herramientas te ayudan a encontrar quién podría presentarte. Referral Nova te construye un sistema donde las presentaciones realmente ocurren, semana tras semana.',
  'hero.ctaJoin': 'Únete gratis',
  'hero.ctaHow': 'Ver cómo funciona',
  'auth.signupTitle': 'Crea tu cuenta',
  'auth.signupSub': 'Toma menos de un minuto. No se requiere tarjeta.',
  'auth.loginTitle': 'Bienvenido de nuevo',
  'auth.loginSub': 'Inicia sesión en tu cuenta.',
  'auth.firstName': 'Nombre',
  'auth.lastName': 'Apellido',
  'auth.email': 'Correo electrónico',
  'auth.password': 'Contraseña',
  'auth.createAccount': 'Crear cuenta',
  'auth.logIn': 'Iniciar sesión',
  'auth.haveAccount': '¿Ya tienes una cuenta?',
  'auth.noAccount': '¿No tienes una cuenta?',
  'auth.orEmail': 'o con correo',
  'auth.googleSignup': 'Regístrate con Google',
  'auth.googleLogin': 'Continuar con Google',
};

const de: Dict = {
  'nav.howItWorks': 'So funktioniert es',
  'nav.forMembers': 'Für Mitglieder',
  'nav.forGroups': 'Für Gruppen',
  'nav.events': 'Veranstaltungen',
  'nav.pricing': 'Preise',
  'nav.login': 'Anmelden',
  'nav.signup': 'Kostenlos registrieren',
  'nav.dashboard': 'Dashboard',
  'nav.logout': 'Abmelden',
  'common.language': 'Sprache',
  'founding.bar': 'Gründungsangebot: Die ersten 200 Unternehmen erhalten alle Funktionen kostenlos.',
  'founding.barSpots': 'Nur noch {n} von {limit} Plätzen frei.',
  'founding.barCta': 'Keine Kreditkarte. Sichern Sie sich Ihren Platz →',
  'founding.cardTitle': 'Gründungsangebot: Die ersten 200 Unternehmen erhalten alle kostenpflichtigen Funktionen gratis',
  'founding.cardBody': 'Jetzt registrieren und vollen Pro-Zugang kostenlos behalten.',
  'founding.cardAfter': 'Nach den ersten 200 Mitgliedern gelten die Tarife unten.',
  'founding.closedTitle': 'Alle 200 Gründungsplätze sind vergeben 🙌',
  'founding.closedBody': 'Für neue Mitglieder gelten jetzt die Tarife unten. Danke an unsere Gründungsunternehmen!',
  'hero.badge': 'Das KI-gestützte Empfehlungsnetzwerk für Unternehmen',
  'hero.titleA': 'Hoffen Sie nicht auf Empfehlungen.',
  'hero.titleHighlight': 'Bauen Sie einen Empfehlungsmotor.',
  'hero.titleB': '',
  'hero.sub': 'Referral Nova macht aus Ihrem Netzwerk Umsatz: KI verbindet Sie mit vertrauenswürdigen Partnern, und qualifizierte Empfehlungen fließen kontinuierlich in beide Richtungen.',
  'hero.sub2': 'Andere Tools zeigen, wer Sie vorstellen könnte. Referral Nova baut Ihnen ein System, in dem Vorstellungen tatsächlich passieren – Woche für Woche.',
  'hero.ctaJoin': 'Kostenlos beitreten',
  'hero.ctaHow': 'So funktioniert es',
  'auth.signupTitle': 'Konto erstellen',
  'auth.signupSub': 'Dauert unter einer Minute. Keine Kreditkarte nötig.',
  'auth.loginTitle': 'Willkommen zurück',
  'auth.loginSub': 'Melden Sie sich bei Ihrem Konto an.',
  'auth.firstName': 'Vorname',
  'auth.lastName': 'Nachname',
  'auth.email': 'E-Mail',
  'auth.password': 'Passwort',
  'auth.createAccount': 'Konto erstellen',
  'auth.logIn': 'Anmelden',
  'auth.haveAccount': 'Haben Sie bereits ein Konto?',
  'auth.noAccount': 'Noch kein Konto?',
  'auth.orEmail': 'oder mit E-Mail',
  'auth.googleSignup': 'Mit Google registrieren',
  'auth.googleLogin': 'Mit Google fortfahren',
};

const fr: Dict = {
  'nav.howItWorks': 'Comment ça marche',
  'nav.forMembers': 'Pour les membres',
  'nav.forGroups': 'Pour les groupes',
  'nav.events': 'Événements',
  'nav.pricing': 'Tarifs',
  'nav.login': 'Se connecter',
  'nav.signup': "S'inscrire gratuitement",
  'nav.dashboard': 'Tableau de bord',
  'nav.logout': 'Se déconnecter',
  'common.language': 'Langue',
  'founding.bar': 'Offre de lancement : les 200 premières entreprises obtiennent toutes les fonctionnalités gratuitement.',
  'founding.barSpots': 'Plus que {n} places sur {limit}.',
  'founding.barCta': 'Sans carte bancaire. Réservez votre place →',
  'founding.cardTitle': 'Offre de lancement : les 200 premières entreprises obtiennent toutes les fonctionnalités payantes gratuitement',
  'founding.cardBody': 'Inscrivez-vous maintenant et gardez un accès Pro complet gratuitement.',
  'founding.cardAfter': 'Après les 200 premiers membres, les offres ci-dessous s’appliquent.',
  'founding.closedTitle': 'Les 200 places de lancement sont toutes prises 🙌',
  'founding.closedBody': 'Les offres ci-dessous s’appliquent désormais aux nouveaux membres. Merci à nos entreprises fondatrices !',
  'hero.badge': 'Le réseau de recommandation IA pour les entreprises',
  'hero.titleA': 'N’attendez plus les recommandations.',
  'hero.titleHighlight': 'Construisez un moteur de recommandations.',
  'hero.titleB': '',
  'hero.sub': 'Referral Nova transforme votre réseau en revenus : l’IA vous associe à des partenaires de confiance et les recommandations qualifiées circulent dans les deux sens, en continu.',
  'hero.sub2': 'D’autres outils vous aident à trouver qui pourrait vous présenter. Referral Nova vous construit un système où les mises en relation se produisent réellement, semaine après semaine.',
  'hero.ctaJoin': 'Rejoindre gratuitement',
  'hero.ctaHow': 'Voir comment ça marche',
  'auth.signupTitle': 'Créez votre compte',
  'auth.signupSub': 'Moins d’une minute. Aucune carte bancaire requise.',
  'auth.loginTitle': 'Bon retour',
  'auth.loginSub': 'Connectez-vous à votre compte.',
  'auth.firstName': 'Prénom',
  'auth.lastName': 'Nom',
  'auth.email': 'E-mail',
  'auth.password': 'Mot de passe',
  'auth.createAccount': 'Créer un compte',
  'auth.logIn': 'Se connecter',
  'auth.haveAccount': 'Vous avez déjà un compte ?',
  'auth.noAccount': 'Vous n’avez pas de compte ?',
  'auth.orEmail': 'ou par e-mail',
  'auth.googleSignup': 'S’inscrire avec Google',
  'auth.googleLogin': 'Continuer avec Google',
};

const pt: Dict = {
  'nav.howItWorks': 'Como funciona',
  'nav.forMembers': 'Para membros',
  'nav.forGroups': 'Para grupos',
  'nav.events': 'Eventos',
  'nav.pricing': 'Preços',
  'nav.login': 'Entrar',
  'nav.signup': 'Cadastre-se grátis',
  'nav.dashboard': 'Painel',
  'nav.logout': 'Sair',
  'common.language': 'Idioma',
  'founding.bar': 'Oferta de lançamento: as primeiras 200 empresas recebem todos os recursos grátis.',
  'founding.barSpots': 'Restam apenas {n} de {limit} vagas.',
  'founding.barCta': 'Sem cartão de crédito. Garanta sua vaga →',
  'founding.cardTitle': 'Oferta de lançamento: as primeiras 200 empresas recebem todos os recursos pagos grátis',
  'founding.cardBody': 'Cadastre-se agora e mantenha acesso Pro completo sem custo.',
  'founding.cardAfter': 'Após os primeiros 200 membros, os planos abaixo passam a valer.',
  'founding.closedTitle': 'As 200 vagas de lançamento foram preenchidas 🙌',
  'founding.closedBody': 'Os planos abaixo agora valem para novos membros. Obrigado às nossas empresas fundadoras!',
  'hero.badge': 'A rede de indicações com IA para negócios',
  'hero.titleA': 'Pare de esperar indicações.',
  'hero.titleHighlight': 'Construa um motor de indicações.',
  'hero.titleB': '',
  'hero.sub': 'A Referral Nova transforma sua rede em receita: a IA conecta você a parceiros de confiança e indicações qualificadas fluem nos dois sentidos, continuamente.',
  'hero.sub2': 'Outras ferramentas ajudam a descobrir quem poderia apresentá-lo. A Referral Nova constrói um sistema em que as apresentações realmente acontecem, semana após semana.',
  'hero.ctaJoin': 'Participe grátis',
  'hero.ctaHow': 'Ver como funciona',
  'auth.signupTitle': 'Crie sua conta',
  'auth.signupSub': 'Leva menos de um minuto. Sem cartão de crédito.',
  'auth.loginTitle': 'Bem-vindo de volta',
  'auth.loginSub': 'Entre na sua conta.',
  'auth.firstName': 'Nome',
  'auth.lastName': 'Sobrenome',
  'auth.email': 'E-mail',
  'auth.password': 'Senha',
  'auth.createAccount': 'Criar conta',
  'auth.logIn': 'Entrar',
  'auth.haveAccount': 'Já tem uma conta?',
  'auth.noAccount': 'Não tem uma conta?',
  'auth.orEmail': 'ou com e-mail',
  'auth.googleSignup': 'Cadastre-se com o Google',
  'auth.googleLogin': 'Continuar com o Google',
};

const ar: Dict = {
  'nav.howItWorks': 'كيف يعمل',
  'nav.forMembers': 'للأعضاء',
  'nav.forGroups': 'للمجموعات',
  'nav.events': 'الفعاليات',
  'nav.pricing': 'الأسعار',
  'nav.login': 'تسجيل الدخول',
  'nav.signup': 'سجّل مجانًا',
  'nav.dashboard': 'لوحة التحكم',
  'nav.logout': 'تسجيل الخروج',
  'common.language': 'اللغة',
  'founding.bar': 'عرض التأسيس: أول 200 شركة تحصل على جميع الميزات مجانًا.',
  'founding.barSpots': 'بقي {n} من {limit} مقعدًا فقط.',
  'founding.barCta': 'بدون بطاقة ائتمان. احجز مكانك →',
  'founding.cardTitle': 'عرض التأسيس: أول 200 شركة تحصل على كل الميزات المدفوعة مجانًا',
  'founding.cardBody': 'سجّل الآن واحتفظ بكامل صلاحيات Pro دون أي تكلفة.',
  'founding.cardAfter': 'بعد أول 200 عضو، تُطبَّق الخطط أدناه.',
  'founding.closedTitle': 'تم حجز كل المقاعد التأسيسية الـ200 🙌',
  'founding.closedBody': 'تنطبق الخطط أدناه الآن على الأعضاء الجدد. شكرًا لشركاتنا المؤسِّسة!',
  'hero.badge': 'شبكة الإحالات المدعومة بالذكاء الاصطناعي للأعمال',
  'hero.titleA': 'توقّف عن انتظار الإحالات.',
  'hero.titleHighlight': 'ابنِ محرّك إحالات.',
  'hero.titleB': '',
  'hero.sub': 'تحوّل Referral Nova شبكتك إلى إيرادات: يطابقك الذكاء الاصطناعي مع شركاء موثوقين، وتتدفق الإحالات المؤهلة في الاتجاهين باستمرار.',
  'hero.sub2': 'الأدوات الأخرى تساعدك على معرفة من قد يقدّمك. أما Referral Nova فتبني لك نظامًا تحدث فيه المقدمات فعلاً، أسبوعًا بعد أسبوع.',
  'hero.ctaJoin': 'انضم مجانًا',
  'hero.ctaHow': 'شاهد كيف يعمل',
  'auth.signupTitle': 'أنشئ حسابك',
  'auth.signupSub': 'يستغرق أقل من دقيقة. لا حاجة لبطاقة ائتمان.',
  'auth.loginTitle': 'مرحبًا بعودتك',
  'auth.loginSub': 'سجّل الدخول إلى حسابك.',
  'auth.firstName': 'الاسم الأول',
  'auth.lastName': 'اسم العائلة',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.createAccount': 'إنشاء حساب',
  'auth.logIn': 'تسجيل الدخول',
  'auth.haveAccount': 'لديك حساب بالفعل؟',
  'auth.noAccount': 'ليس لديك حساب؟',
  'auth.orEmail': 'أو بالبريد الإلكتروني',
  'auth.googleSignup': 'سجّل عبر Google',
  'auth.googleLogin': 'المتابعة عبر Google',
};

const DICTS: Record<Locale, Dict> = { en, es, de, fr, pt, ar };

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nValue | null>(null);

// To RE-ENABLE languages: restore auto-detect (browser language + saved
// preference) inside I18nProvider and re-add <LanguageSwitcher /> to TopNav.
// function detectLocale(): Locale {
//   if (typeof window === 'undefined') return 'en';
//   const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
//   if (saved && DICTS[saved]) return saved;
//   const nav = (window.navigator.language || 'en').slice(0, 2).toLowerCase() as Locale;
//   return DICTS[nav] ? nav : 'en';
// }

export function I18nProvider({ children }: { children: ReactNode }) {
  // TEMPORARILY DISABLED: the switcher is hidden and the site is locked to
  // English until translation coverage is complete, so partial translations
  // don't crack the layout. Re-enable auto-detect + persistence (see
  // detectLocale / the effects below) when ready to relaunch languages.
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = DICTS[locale]?.[key] ?? en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
        vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
      );
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t, dir: RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr' }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback if a component renders outside the provider.
    return {
      locale: 'en',
      setLocale: () => undefined,
      t: (key, vars) => {
        const raw = en[key] ?? key;
        return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : raw;
      },
      dir: 'ltr',
    };
  }
  return ctx;
}
