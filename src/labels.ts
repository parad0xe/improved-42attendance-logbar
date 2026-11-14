const LANG_COOKIE_KEY = "PARAGLIDE_LOCALE"

export interface Labels {
    SETTINGS_THEME: string
    SETTINGS_DAYS_OFF: string
    SETTINGS_PACE: string
    SETTINGS_TIME_PER_REMAINING_DAY: string
    SETTINGS_NEEDED_PER_DAY: (time: string) => string
    SETTINGS_CAPSULES_TO_USE: string

    GAP_EXPECTED: (time: string) => string
    GAP_BONUS_DAYS: (days: number) => string
    GAP_MISSING_DAYS: (days: number) => string
    GAP_REMAINING_TODAY: string
    GAP_MONTH_END: string
    GAP_CAPSULES_LEFT: (count: number) => string
    GAP_UNAVAILABLE: string

    /** The weekdays, from Monday. */
    CALENDAR_WEEKDAYS: string[]
    CALENDAR_PUBLIC_HOLIDAY: string
    CALENDAR_CLOSURE: string

    ERROR_WORKDAYS_MISSING: string
    ERROR_DATA_UNAVAILABLE: (status: number) => string
    ERROR_SESSION_EXPIRED: string
    ERROR_SUMMARY_NOT_FOUND: string
    ERROR_PROGRESS_BAR_NOT_FOUND: string
    ERROR_LOGGED_MONTH_NOT_FOUND: string
    ERROR_MONTH_GOAL_NOT_FOUND: string
    WARNING_RUNNING_SESSION_NOT_FOUND: string
    WARNING_LOGGED_TODAY_NOT_FOUND: string
}

const LABELS: Record<string, Labels> = {
    fr: {
        SETTINGS_THEME: "Thème",
        SETTINGS_DAYS_OFF: "Jours de repos",
        SETTINGS_PACE: "Rythme",
        SETTINGS_TIME_PER_REMAINING_DAY: "Temps par jour restant",
        SETTINGS_NEEDED_PER_DAY: (time) => `Nécessaire : ${time} par jour`,
        SETTINGS_CAPSULES_TO_USE: "Capsules à poser",

        GAP_EXPECTED: (time) => `Prévu ${time}`,
        GAP_BONUS_DAYS: (days) => `${days.toFixed(1).replace(".", ",")} ${days < 2 ? "jour" : "jours"} bonus`,
        GAP_MISSING_DAYS: (days) => `${days.toFixed(1).replace(".", ",")} ${days < 2 ? "jour manquant" : "jours manquants"}`,
        GAP_REMAINING_TODAY: "restant aujourd'hui",
        GAP_MONTH_END: "fin du mois",
        GAP_CAPSULES_LEFT: (count) => `${count} ${count > 1 ? "capsules" : "capsule"} à poser`,
        GAP_UNAVAILABLE: "écart indisponible",

        CALENDAR_WEEKDAYS: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
        CALENDAR_PUBLIC_HOLIDAY: "Jour férié",
        CALENDAR_CLOSURE: "Fermeture de l'école",

        ERROR_WORKDAYS_MISSING: "les jours ouvrés du mois sont introuvables, la page a peut-être changé",
        ERROR_DATA_UNAVAILABLE: (status) => `impossible de charger les données d'attendance (HTTP ${status})`,
        ERROR_SESSION_EXPIRED: "la session a expiré, rechargez la page",
        ERROR_SUMMARY_NOT_FOUND: "impossible de trouver le résumé du mois, la mise en page a peut-être changé",
        ERROR_PROGRESS_BAR_NOT_FOUND: "impossible de trouver la barre de progression, la mise en page a peut-être changé",
        ERROR_LOGGED_MONTH_NOT_FOUND: "impossible de trouver le temps logué du mois, la mise en page a peut-être changé",
        ERROR_MONTH_GOAL_NOT_FOUND: "impossible de trouver l'objectif du mois, la mise en page a peut-être changé",
        WARNING_RUNNING_SESSION_NOT_FOUND: "impossible de trouver la session en cours",
        WARNING_LOGGED_TODAY_NOT_FOUND: "impossible de trouver le temps logué aujourd'hui",
    },
    en: {
        SETTINGS_THEME: "Theme",
        SETTINGS_DAYS_OFF: "Days off",
        SETTINGS_PACE: "Pace",
        SETTINGS_TIME_PER_REMAINING_DAY: "Time per remaining day",
        SETTINGS_NEEDED_PER_DAY: (time) => `Needed: ${time} per day`,
        SETTINGS_CAPSULES_TO_USE: "Capsules to use",

        GAP_EXPECTED: (time) => `Expected ${time}`,
        GAP_BONUS_DAYS: (days) => `${days.toFixed(1)} bonus ${days < 2 ? "day" : "days"}`,
        GAP_MISSING_DAYS: (days) => `${days.toFixed(1)} missing ${days < 2 ? "day" : "days"}`,
        GAP_REMAINING_TODAY: "remaining today",
        GAP_MONTH_END: "month end",
        GAP_CAPSULES_LEFT: (count) => `${count} ${count > 1 ? "capsules" : "capsule"} to use`,
        GAP_UNAVAILABLE: "gap unavailable",

        CALENDAR_WEEKDAYS: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        CALENDAR_PUBLIC_HOLIDAY: "Public holiday",
        CALENDAR_CLOSURE: "School closure",

        ERROR_WORKDAYS_MISSING: "the working days of the month are missing, the page may have changed",
        ERROR_DATA_UNAVAILABLE: (status) => `cannot load the attendance data (HTTP ${status})`,
        ERROR_SESSION_EXPIRED: "the session has expired, reload the page",
        ERROR_SUMMARY_NOT_FOUND: "cannot find the month summary, the page layout may have changed",
        ERROR_PROGRESS_BAR_NOT_FOUND: "cannot find the progress bar, the page layout may have changed",
        ERROR_LOGGED_MONTH_NOT_FOUND: "cannot find the logged time of the month, the page layout may have changed",
        ERROR_MONTH_GOAL_NOT_FOUND: "cannot find the goal of the month, the page layout may have changed",
        WARNING_RUNNING_SESSION_NOT_FOUND: "cannot find the running session",
        WARNING_LOGGED_TODAY_NOT_FOUND: "cannot find the time logged today",
    },
}

/** Returns the language of the site. */
export function loadLang(): string {
    const langCookie = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${LANG_COOKIE_KEY}=`))
    return langCookie ? langCookie.slice(LANG_COOKIE_KEY.length + 1) : "en"
}

/**
 * Returns the labels in `lang`.
 * @param lang - the language, such as "fr"
 */
export function getLabels(lang: string): Labels {
    return LABELS[lang] ?? LABELS.en
}
