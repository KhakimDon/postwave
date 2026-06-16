import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const LANGS = [
  { code: "ru", label: "Русский", cc: "ru" },
  { code: "en", label: "English", cc: "gb" },
  { code: "uz", label: "O'zbekcha", cc: "uz" },
  { code: "kk", label: "Қазақша", cc: "kz" },
  { code: "ky", label: "Кыргызча", cc: "kg" },
  { code: "tg", label: "Тоҷикӣ", cc: "tj" },
  { code: "tr", label: "Türkçe", cc: "tr" },
  { code: "az", label: "Azərbaycan", cc: "az" },
  { code: "uk", label: "Українська", cc: "ua" },
  { code: "ar", label: "العربية", cc: "sa" },
] as const;

const t = (
  taglineLogin: string,
  taglineRegister: string,
  name: string,
  namePh: string,
  phone: string,
  password: string,
  passwordPh: string,
  signIn: string,
  signUp: string,
  noAccount: string,
  haveAccount: string,
  createLink: string,
  loginLink: string,
  welcome: string,
  errPhone: string,
  errPassword: string,
  navOverview: string,
  navPublications: string,
  navCalendar: string,
  navInbox: string,
  navAccounts: string,
  logout: string,
  language: string
) => ({
  translation: {
    tagline_login: taglineLogin,
    tagline_register: taglineRegister,
    name,
    name_ph: namePh,
    phone,
    password,
    password_ph: passwordPh,
    sign_in: signIn,
    sign_up: signUp,
    no_account: noAccount,
    have_account: haveAccount,
    create_link: createLink,
    login_link: loginLink,
    welcome,
    err_phone: errPhone,
    err_password: errPassword,
    nav_overview: navOverview,
    nav_publications: navPublications,
    nav_calendar: navCalendar,
    nav_inbox: navInbox,
    nav_accounts: navAccounts,
    logout,
    language,
  },
});

const resources = {
  ru: t(
    "Войдите, чтобы продолжить", "Создайте аккаунт за минуту", "Имя",
    "Как к вам обращаться", "Телефон", "Пароль", "Введите пароль",
    "Войти", "Зарегистрироваться", "Нет аккаунта?", "Уже есть аккаунт?",
    "Создать", "Войти", "Добро пожаловать 👋",
    "Введите корректный номер телефона", "Пароль минимум 6 символов",
    "Обзор", "Публикации", "Календарь", "Входящие", "Аккаунты", "Выйти", "Язык"
  ),
  en: t(
    "Sign in to continue", "Create an account in a minute", "Name",
    "How should we call you", "Phone", "Password", "Enter password",
    "Sign in", "Sign up", "No account?", "Already have an account?",
    "Create", "Sign in", "Welcome 👋",
    "Enter a valid phone number", "Password must be at least 6 characters",
    "Overview", "Publications", "Calendar", "Inbox", "Accounts", "Log out", "Language"
  ),
  uz: t(
    "Davom etish uchun kiring", "Bir daqiqada hisob yarating", "Ism",
    "Sizni qanday chaqiraylik", "Telefon", "Parol", "Parolni kiriting",
    "Kirish", "Ro'yxatdan o'tish", "Hisob yo'qmi?", "Hisobingiz bormi?",
    "Yaratish", "Kirish", "Xush kelibsiz 👋",
    "To'g'ri telefon raqamini kiriting", "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
    "Umumiy", "Nashrlar", "Kalendar", "Xabarlar", "Hisoblar", "Chiqish", "Til"
  ),
  kk: t(
    "Жалғастыру үшін кіріңіз", "Бір минутта тіркелгі жасаңыз", "Аты",
    "Сізді қалай атайық", "Телефон", "Құпиясөз", "Құпиясөзді енгізіңіз",
    "Кіру", "Тіркелу", "Тіркелгі жоқ па?", "Тіркелгіңіз бар ма?",
    "Жасау", "Кіру", "Қош келдіңіз 👋",
    "Жарамды телефон нөмірін енгізіңіз", "Құпиясөз кемінде 6 таңба болуы керек",
    "Шолу", "Жарияланымдар", "Күнтізбе", "Кіріс хаттар", "Тіркелгілер", "Шығу", "Тіл"
  ),
  ky: t(
    "Улантуу үчүн кириңиз", "Бир мүнөттө аккаунт түзүңүз", "Аты",
    "Сизди кантип атайбыз", "Телефон", "Сырсөз", "Сырсөздү киргизиңиз",
    "Кирүү", "Катталуу", "Аккаунт жокпу?", "Аккаунтуңуз барбы?",
    "Түзүү", "Кирүү", "Кош келиңиз 👋",
    "Туура телефон номерин киргизиңиз", "Сырсөз кеминде 6 белги болушу керек",
    "Жалпы", "Жарыялоолор", "Календарь", "Кириш каттар", "Аккаунттар", "Чыгуу", "Тил"
  ),
  tg: t(
    "Барои идома ворид шавед", "Дар як дақиқа ҳисоб созед", "Ном",
    "Шуморо чӣ хел нависем", "Телефон", "Парол", "Паролро ворид кунед",
    "Ворид шудан", "Бақайдгирӣ", "Ҳисоб надоред?", "Ҳисоб доред?",
    "Сохтан", "Ворид шудан", "Хуш омадед 👋",
    "Рақами дурусти телефонро ворид кунед", "Парол бояд камаш аз 6 аломат иборат бошад",
    "Шарҳ", "Нашрҳо", "Тақвим", "Воридотӣ", "Ҳисобҳо", "Баромадан", "Забон"
  ),
  tr: t(
    "Devam etmek için giriş yapın", "Bir dakikada hesap oluşturun", "Ad",
    "Size nasıl hitap edelim", "Telefon", "Şifre", "Şifreyi girin",
    "Giriş yap", "Kayıt ol", "Hesabınız yok mu?", "Zaten hesabınız var mı?",
    "Oluştur", "Giriş yap", "Hoş geldiniz 👋",
    "Geçerli bir telefon numarası girin", "Şifre en az 6 karakter olmalı",
    "Genel", "Yayınlar", "Takvim", "Gelen kutusu", "Hesaplar", "Çıkış", "Dil"
  ),
  az: t(
    "Davam etmək üçün daxil olun", "Bir dəqiqəyə hesab yaradın", "Ad",
    "Sizə necə müraciət edək", "Telefon", "Parol", "Parolu daxil edin",
    "Daxil ol", "Qeydiyyat", "Hesabınız yoxdur?", "Hesabınız var?",
    "Yarat", "Daxil ol", "Xoş gəlmisiniz 👋",
    "Düzgün telefon nömrəsi daxil edin", "Parol ən azı 6 simvol olmalıdır",
    "İcmal", "Nəşrlər", "Təqvim", "Gələnlər", "Hesablar", "Çıxış", "Dil"
  ),
  uk: t(
    "Увійдіть, щоб продовжити", "Створіть акаунт за хвилину", "Ім'я",
    "Як до вас звертатися", "Телефон", "Пароль", "Введіть пароль",
    "Увійти", "Зареєструватися", "Немає акаунта?", "Вже є акаунт?",
    "Створити", "Увійти", "Ласкаво просимо 👋",
    "Введіть коректний номер телефону", "Пароль мінімум 6 символів",
    "Огляд", "Публікації", "Календар", "Вхідні", "Акаунти", "Вийти", "Мова"
  ),
  ar: t(
    "سجّل الدخول للمتابعة", "أنشئ حسابًا في دقيقة", "الاسم",
    "كيف نناديك", "الهاتف", "كلمة المرور", "أدخل كلمة المرور",
    "تسجيل الدخول", "إنشاء حساب", "ليس لديك حساب؟", "لديك حساب بالفعل؟",
    "إنشاء", "تسجيل الدخول", "مرحبًا 👋",
    "أدخل رقم هاتف صحيح", "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
    "نظرة عامة", "المنشورات", "التقويم", "الوارد", "الحسابات", "تسجيل الخروج", "اللغة"
  ),
};

const saved = localStorage.getItem("postwave_lang") || "ru";

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(code: string) {
  i18n.changeLanguage(code);
  localStorage.setItem("postwave_lang", code);
  document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
}

document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";

export default i18n;
