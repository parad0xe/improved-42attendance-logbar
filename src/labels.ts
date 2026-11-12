export interface Labels {
    /** from Monday */
    WEEKDAYS: string[]
    THEME: string
    DAYS_OFF: string
    HOURS_PER_REMAINING_DAY: string
    EXPECTED: (time: string) => string
    BONUS_DAYS: (days: number) => string
    MISSING_DAYS: (days: number) => string
    REMAINING_TODAY: (time: string) => string
    CAPSULES_TO_USE: string
    CAPSULES_LEFT: (count: number) => string
    PUBLIC_HOLIDAY: string
    CLOSURE: string
    GAP_UNAVAILABLE: string
    ERROR_WORKDAYS_MISSING: string
    ERROR_DATA_UNAVAILABLE: (status: number) => string
    ERROR_SESSION_EXPIRED: string
    ERROR_SUMMARY_NOT_FOUND: string
    ERROR_PROGRESS_BAR_NOT_FOUND: string
    ERROR_LOGGED_MONTH_NOT_FOUND: string
    ERROR_MONTH_GOAL_NOT_FOUND: string
    WARNING_LOGGED_TODAY_NOT_FOUND: string
}

const LABELS: Record<string, Labels> = {
    fr: {
        WEEKDAYS: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
        THEME: "Thème",
        DAYS_OFF: "Jours de repos",
        HOURS_PER_REMAINING_DAY: "Heures par jour restant",
        GAP_UNAVAILABLE: "écart indisponible",

        EXPECTED: (time) => `Prévu ${time}`,
        BONUS_DAYS: (days) => `${days.toFixed(1).replace(".", ",")} ${days < 2 ? "jour" : "jours"} bonus`,
        MISSING_DAYS: (days) => `${days.toFixed(1).replace(".", ",")} ${days < 2 ? "jour manquant" : "jours manquants"}`,
        REMAINING_TODAY: (time) => `reste ${time} aujourd'hui`,
        CAPSULES_TO_USE: "Capsules à poser",
        CAPSULES_LEFT: (count) => `${count} ${count > 1 ? "capsules" : "capsule"} à poser`,
        PUBLIC_HOLIDAY: "Jour férié",
        CLOSURE: "Fermeture de l'école",

        ERROR_WORKDAYS_MISSING: "les jours ouvrés du mois sont introuvables, la page a peut-être changé",
        ERROR_DATA_UNAVAILABLE: (status) => `impossible de charger les données d'attendance (HTTP ${status})`,
        ERROR_SESSION_EXPIRED: "la session a expiré, rechargez la page",
        ERROR_SUMMARY_NOT_FOUND: "impossible de trouver le résumé du mois, la mise en page a peut-être changé",
        ERROR_PROGRESS_BAR_NOT_FOUND: "impossible de trouver la barre de progression, la mise en page a peut-être changé",
        ERROR_LOGGED_MONTH_NOT_FOUND: "impossible de trouver le temps logué du mois, la mise en page a peut-être changé",
        ERROR_MONTH_GOAL_NOT_FOUND: "impossible de trouver l'objectif du mois, la mise en page a peut-être changé",
        WARNING_LOGGED_TODAY_NOT_FOUND: "impossible de trouver le temps logué aujourd'hui",
    },
    en: {
        WEEKDAYS: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        THEME: "Theme",
        DAYS_OFF: "Days off",
        HOURS_PER_REMAINING_DAY: "Hours per remaining day",
        GAP_UNAVAILABLE: "gap unavailable",

        EXPECTED: (time) => `Expected ${time}`,
        BONUS_DAYS: (days) => `${days.toFixed(1)} bonus ${days < 2 ? "day" : "days"}`,
        MISSING_DAYS: (days) => `${days.toFixed(1)} missing ${days < 2 ? "day" : "days"}`,
        REMAINING_TODAY: (time) => `remaining ${time} today`,
        CAPSULES_TO_USE: "Capsules to use",
        CAPSULES_LEFT: (count) => `${count} ${count > 1 ? "capsules" : "capsule"} to use`,
        PUBLIC_HOLIDAY: "Public holiday",
        CLOSURE: "School closure",

        ERROR_WORKDAYS_MISSING: "the working days of the month are missing, the page may have changed",
        ERROR_DATA_UNAVAILABLE: (status) => `cannot load the attendance data (HTTP ${status})`,
        ERROR_SESSION_EXPIRED: "the session has expired, reload the page",
        ERROR_SUMMARY_NOT_FOUND: "cannot find the month summary, the page layout may have changed",
        ERROR_PROGRESS_BAR_NOT_FOUND: "cannot find the progress bar, the page layout may have changed",
        ERROR_LOGGED_MONTH_NOT_FOUND: "cannot find the logged time of the month, the page layout may have changed",
        ERROR_MONTH_GOAL_NOT_FOUND: "cannot find the goal of the month, the page layout may have changed",
        WARNING_LOGGED_TODAY_NOT_FOUND: "cannot find the time logged today",
    },
}

/**
 * @returns the labels in lang, or in English when lang has none
 */
export function getLabels(lang: string): Labels {
    return LABELS[lang] ?? LABELS.en
}
