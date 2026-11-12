// ==UserScript==
// @name         Improved 42Attendance Logbar
// @namespace    https://github.com/parad0xe
// @version      2026.11.15
// @description  Show the gap with the expected logged time
// @author       parad0xe
// @match        https://attendance.42lyon.fr/me
// @match        https://attendance.42lyon.fr/me?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=42lyon.fr
// @updateURL    https://raw.githubusercontent.com/parad0xe/improved-42attendance-logbar/main/improved-42attendance-logbar.user.js
// @downloadURL  https://raw.githubusercontent.com/parad0xe/improved-42attendance-logbar/main/improved-42attendance-logbar.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CONSTANTES
    const SCRIPT_NAME = "Improved Attendance Logbar"

    const THEME_STORAGE_KEY = "improved-logbar-theme"
    const PLAN_STORAGE_KEY = "improved-logbar-plan"
    const LANG_COOKIE_KEY = "PARAGLIDE_LOCALE"

    const LABELS = {
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

    const WORKDAY_MINUTES = 7 * 60
    const CLOSURE_START_HOUR = 8
    const CLOSURE_END_HOUR = 20

    const SELECTORS = {
        sidebarContent: "[data-slot='sidebar-content']",
        main: "[data-slot='sidebar-inset'] main",
        summary: "[data-slot='sidebar-inset'] main div:nth-of-type(2) div:nth-of-type(1)",
        progressTrack: "[data-slot='sidebar-inset'] main div:nth-of-type(2) div:nth-of-type(2) div:nth-of-type(2)",
        loggedMonth: "[data-slot='sidebar-inset'] main div:nth-of-type(2) > div div:nth-of-type(2) span:nth-of-type(1)",
        monthGoal: "[data-slot='sidebar-inset'] main div:nth-of-type(2) > div div:nth-of-type(2) span:nth-of-type(3)",
        timerParts: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div > span",
        loggedToday: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div > div div > span:nth-of-type(1)",
    }

    const THEME_STYLE = `
        html.dark {
            color-scheme: dark !important;
        
            --background: oklch(17% 0.012 260);
            --foreground: oklch(96% 0.005 260);
            --card: oklch(21% 0.014 260);
            --card-foreground: oklch(96% 0.005 260);
            --popover: oklch(21% 0.014 260);
            --popover-foreground: oklch(96% 0.005 260);
            --primary: oklch(92% 0.01 260);
            --primary-foreground: oklch(21% 0.014 260);
            --secondary: oklch(27% 0.015 260);
            --secondary-foreground: oklch(96% 0.005 260);
            --muted: oklch(27% 0.015 260);
            --muted-foreground: oklch(71% 0.02 260);
            --accent: oklch(29% 0.018 260);
            --accent-foreground: oklch(96% 0.005 260);
            --destructive: oklch(70% 0.19 22);
            --border: oklch(100% 0 0 / 9%);
            --input: oklch(100% 0 0 / 14%);
            --ring: oklch(56% 0.02 260);
            --sidebar: oklch(19% 0.013 260);
            --sidebar-foreground: oklch(96% 0.005 260);
            --sidebar-primary: oklch(62% 0.19 260);
            --sidebar-primary-foreground: oklch(98% 0 0);
            --sidebar-accent: oklch(27% 0.015 260);
            --sidebar-accent-foreground: oklch(96% 0.005 260);
            --sidebar-border: oklch(100% 0 0 / 9%);
            --sidebar-ring: oklch(56% 0.02 260);
        
            --shadow-sm: 0 1px 3px 0 #00000066;
            --shadow: 0 1px 3px 0 #00000066;
            --shadow-md: 0 2px 6px -1px #00000080;
            --shadow-lg: 0 4px 10px -2px #00000080;
        
            --dark-cerulean: #6c9be0;
            --cg-blue: #2bb3d4;
            --violet: #a77bff;
        
            --improved-logbar-bonus: #4ade80;
            --improved-logbar-missing: #f87171;
            --improved-logbar-in-progress: #fbbf24;
            --improved-logbar-expected-bar: #facc1530;
            --improved-logbar-expected-label: #fde68ab3;
            --improved-logbar-gap-capsule: #ca7016;

            --improved-logbar-day-border: oklch(100% 0 0 / 12%);
            --improved-logbar-day-hover: oklch(100% 0 0 / 6%);
            --improved-logbar-day-off-background: #3b82f633;
            --improved-logbar-day-off-border: #3b82f680;
            --improved-logbar-day-off-text: #93c5fd;
            --improved-logbar-past-day-border: oklch(100% 0 0 / 5%);
            --improved-logbar-past-day-text: oklch(100% 0 0 / 30%);
            --improved-logbar-past-day-off-background: oklch(100% 0 0 / 6%);
        }
    
        @layer utilities {
            :where(.dark) .bg-white { background-color: var(--card); }
            :where(.dark) .bg-neutral-50,
            :where(.dark) .bg-slate-100,
            :where(.dark) .bg-slate-200 { background-color: var(--muted); }
            :where(.dark) .text-black,
            :where(.dark) .text-neutral-900 { color: var(--foreground); }
            :where(.dark) .text-neutral-600,
            :where(.dark) .text-neutral-500,
            :where(.dark) .text-slate-700,
            :where(.dark) .text-slate-600 { color: var(--muted-foreground); }
            :where(.dark) .border-neutral-200,
            :where(.dark) .border-slate-200 { border-color: var(--border); }
            :where(.dark) .fill-black { fill: var(--foreground); }
            :where(.dark) .bg-blue-100,
            :where(.dark) .bg-blue-200 { background-color: color-mix(in oklab, var(--color-blue-500) 20%, transparent); }
            :where(.dark) .border-blue-200 { border-color: color-mix(in oklab, var(--color-blue-500) 40%, transparent); }
            :where(.dark) .text-blue-700 { color: var(--color-blue-400); }
            :where(.dark) .bg-emerald-100 { background-color: color-mix(in oklab, var(--color-emerald-500) 20%, transparent); }
            :where(.dark) .border-emerald-200 { border-color: color-mix(in oklab, var(--color-emerald-500) 40%, transparent); }
            :where(.dark) .text-emerald-700 { color: var(--color-emerald-500); }
            :where(.dark) span.bg-yellow-400\\/60 {
                background-color: color-mix(in oklab, var(--color-yellow-400) 20%, transparent);
                color: var(--color-yellow-400);
            }
            :where(.dark) div.bg-yellow-400\\/60 {
                background-color: color-mix(in oklab, var(--color-amber-400) 55%, transparent);
            }
            :where(.dark) div.bg-yellow-400\\/20 {
                background-color: color-mix(in oklab, var(--color-amber-400) 22%, transparent);
            }
        }
    
        .improved-logbar-theme-switch {
            width: 2rem;
            height: 2rem;
            border: 1px solid var(--border);
            border-radius: 9999px;
            background: var(--card);
            color: var(--foreground);
            font-size: 1rem;
            cursor: pointer;
        }
    `
    const LAYOUT_STYLE = `
        :root {
            --improved-logbar-bonus: #15803d;
            --improved-logbar-missing: #612c2c;
            --improved-logbar-in-progress: #cd9b2a;
            --improved-logbar-expected-bar: #ffca0033;
            --improved-logbar-expected-label: #4e2f08a1;
            --improved-logbar-gap-capsule: #b45309;

            --improved-logbar-day-border: #e4e4e7;
            --improved-logbar-day-hover: #f4f4f5;
            --improved-logbar-day-off-background: #dbeafe;
            --improved-logbar-day-off-border: #93c5fd;
            --improved-logbar-day-off-text: #1d4ed8;
            --improved-logbar-past-day-border: #f4f4f5;
            --improved-logbar-past-day-text: #a1a1aa;
            --improved-logbar-past-day-off-background: #f4f4f5;
        }
        
        .improved-logbar-summary { flex-wrap: wrap; }

        .improved-logbar-expected-bar {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            top: 0;
            height: 100%;
            border-radius: 9999px;
            background: var(--improved-logbar-expected-bar);
            transition: width 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .improved-logbar-expected-bar-label { margin-right: 10px; z-index: 10; font-size: 0.9rem; color: var(--improved-logbar-expected-label); }

        .improved-logbar-gap-container { display: flex; align-items: center; justify-content: end; flex-basis: 100%; margin-bottom: 0.25rem; font-size: 0.9rem; gap: 0.5rem; }
        .improved-logbar-gap-days {  }
        .improved-logbar-gap-capsule { color: var(--improved-logbar-gap-capsule); }
        
        .improved-logbar-bonus { color: var(--improved-logbar-bonus); }
        .improved-logbar-missing { color: var(--improved-logbar-missing); }
        .improved-logbar-in-progress { color: var(--improved-logbar-in-progress); }
        
        .improved-logbar-settings {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.75rem 0.5rem;
            font-size: 0.875rem;
            color: var(--sidebar-foreground);
        }
        [data-collapsible="icon"] .improved-logbar-settings { display: none; }
        .improved-logbar-settings-section { display: flex; flex-direction: column; gap: 0.5rem; }
        .improved-logbar-settings-title { font-size: 0.75rem; font-weight: 500; color: var(--muted-foreground); }
        .improved-logbar-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .improved-logbar-settings-row input {
            width: 4rem;
            padding: 0.125rem 0.375rem;
            border: 1px solid var(--input);
            border-radius: 0.375rem;
            background: transparent;
            color: inherit;
        }

        .improved-logbar-credit { font-size: 0.75rem; color: var(--muted-foreground); }
        .improved-logbar-credit:hover { text-decoration: underline; }

        @media (min-width: 768px) {
            .improved-logbar-summary { flex-wrap: nowrap; }
            .improved-logbar-gap-container { flex-basis: auto; margin-bottom: 0; }
        }
    `

    // TYPES
    /**
     * @typedef {Object} AttendanceCalendar
     * @property {number} year
     * @property {number} monthIndex - 0 for January
     * @property {Date[]} workdays - the working days of the month, without weekends and public holidays
     */

    /**
     * @typedef {Object} AttendanceClosure
     * @property {Date} beginAt
     * @property {Date} endAt
     */

    /**
     * @typedef {Object} AttendanceHistory
     * @property {AttendanceClosure[]} closures - the times when the campus is closed
     */

    /**
     * @typedef {Object} PageTime
     * @property {number} loggedMonthMinutes
     * @property {number} monthGoalMinutes
     * @property {number} loggedTodayMinutes
     */

    /**
     * @typedef {Object} CapsuleSync
     * @property {number} availableCapsules
     * @property {number} monthGoalMinutes - the goal shown by the site
     */

    /**
     * @typedef {Object} MonthPlanData
     * @property {number[]} daysOff - the days of the month, from 1, with no planned time
     * @property {number} dailyMinutes - the time planned on each remaining day
     * @property {number} [capsules] - the capsules planned to be used this month
     * @property {CapsuleSync | null} [lastSync] - what the site showed at the last capsule sync
     */

    /**
     * @typedef {Object} Labels
     * @property {string[]} WEEKDAYS - from Monday
     * @property {string} THEME
     * @property {string} DAYS_OFF
     * @property {string} HOURS_PER_REMAINING_DAY
     * @property {(time: string) => string} EXPECTED
     * @property {(days: number) => string} BONUS_DAYS
     * @property {(days: number) => string} MISSING_DAYS
     * @property {(time: string) => string} REMAINING_TODAY
     * @property {string} CAPSULES_TO_USE
     * @property {(count: number) => string} CAPSULES_LEFT
     * @property {string} GAP_UNAVAILABLE
     * @property {string} ERROR_WORKDAYS_MISSING
     * @property {(status: number) => string} ERROR_DATA_UNAVAILABLE
     * @property {string} ERROR_SESSION_EXPIRED
     * @property {string} ERROR_SUMMARY_NOT_FOUND
     * @property {string} ERROR_PROGRESS_BAR_NOT_FOUND
     * @property {string} ERROR_LOGGED_MONTH_NOT_FOUND
     * @property {string} ERROR_MONTH_GOAL_NOT_FOUND
     * @property {string} WARNING_LOGGED_TODAY_NOT_FOUND
     */


    // HELPERS
    /**
     * @param {string} lang
     * @returns {Labels} the labels in lang, or in English when lang has none
     */
    function getLabels(lang) {
        return LABELS[lang] ?? LABELS.en
    }

    /**
     * @param {string} text - a duration such as "26:33"
     * @returns {number}
     */
    function parseMinutes(text) {
        let [hours, minutes] = text.split(":").map((x) => parseInt(x))
        return hours * 60 + minutes
    }

    /**
     * @param {number} minutes
     * @returns {string} the duration as HH:MM, with a minus sign when negative
     */
    function formatMinutes(minutes) {
        const sign = minutes < 0 ? "-" : ""
        const absoluteMinutes = Math.abs(minutes)
        return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')}:${String(absoluteMinutes % 60).padStart(2, '0')}`
    }

    /**
     * @param {number} year
     * @param {number} monthIndex - 0 for January
     * @returns {number}
     */
    function getDaysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate()
    }

    /**
     * @param {string} selector
     * @returns {[string, boolean]} the text of the element, and whether the element exists
     */
    function getTimeText(selector) {
        const element = document.querySelector(selector)
        if (!element) {
            return ["00:00", false]
        }
        return [element.textContent, true]
    }

    /**
     * Decodes the devalue format of SvelteKit: each value refers to the others by their index.
     * @param {unknown[]} values
     * @returns {any}
     */
    function decodeDevalue(values) {
        const specials = new Map([[-1, undefined], [-3, NaN], [-4, Infinity], [-5, -Infinity], [-6, -0]])
        const decoded = new Map()

        /**
         * @param {number} index
         * @returns {any}
         */
        function read(index) {
            if (index < 0) return specials.get(index)
            if (decoded.has(index)) return decoded.get(index)

            const value = values[index]
            if (value === null || typeof value !== "object") {
                decoded.set(index, value)
                return value
            }

            if (!Array.isArray(value)) {
                const object = {}
                decoded.set(index, object)
                for (const key in value) object[key] = read(value[key])
                return object
            }

            if (typeof value[0] !== "string") {
                const array = []
                decoded.set(index, array)
                value.forEach((item, position) => { if (item !== -2) array[position] = read(item) })
                return array
            }

            const [type, ...fields] = value
            let result
            switch (type) {
                case "Date": result = new Date(fields[0]); break
                case "BigInt": result = BigInt(fields[0]); break
                case "RegExp": result = new RegExp(fields[0], fields[1]); break
                case "Set": result = new Set(); decoded.set(index, result); fields.forEach((item) => result.add(read(item))); return result
                case "Map": result = new Map(); decoded.set(index, result); for (let i = 0; i < fields.length; i += 2) result.set(read(fields[i]), read(fields[i + 1])); return result
                case "null": result = Object.create(null); decoded.set(index, result); for (let i = 0; i < fields.length; i += 2) result[fields[i]] = read(fields[i + 1]); return result
                default: result = read(fields[0])
            }
            decoded.set(index, result)
            return result
        }

        return read(0)
    }

    /**
     * @returns {boolean} whether the dark theme was chosen, or else whether the system uses one
     */
    function isDarkThemeChosen() {
        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
            if (savedTheme !== null) {
                return savedTheme === "dark"
            }
        } catch {
            // The storage can be unavailable, for example in a private window.
        }
        return window.matchMedia("(prefers-color-scheme: dark)").matches
    }

    /**
     * @param {boolean} isDark
     * @returns {void}
     */
    function saveThemeChoice(isDark) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light")
        } catch {
            // Without storage, the choice lasts until the page is reloaded.
        }
    }


    // OBJECTS
    class Attendance {
        /**
         * @param {Record<string, any>} data - the decoded data of the /me page
         * @param {Labels} labels - for the error messages
         */
        constructor(data, labels) {
            const { calendar, history } = data

            if (!Array.isArray(calendar?.workdays) || !calendar.workdays.every((day) => day instanceof Date)) {
                throw new Error(`${SCRIPT_NAME}: ${labels.ERROR_WORKDAYS_MISSING}`)
            }

            /** @type {AttendanceCalendar} */
            this.calendar = {
                year: calendar.year,
                monthIndex: calendar.monthIndex,
                workdays: calendar.workdays,
            }

            /** @type {AttendanceHistory} */
            this.history = {
                closures: history?.closures ?? [],
            }

            /**
             * The capsules left to use, shared by every month.
             * @type {number}
             */
            this.availableCapsules = Array.isArray(data.availableCapsules) ? data.availableCapsules.length : 0
        }

        /**
         * Reports whether closures cover a full workday between 08:00 and 20:00, as on the site.
         * @param {Date} workday
         * @returns {boolean}
         */
        isClosedDay(workday) {
            const workdayStart = new Date(workday.getFullYear(), workday.getMonth(), workday.getDate(), CLOSURE_START_HOUR)
            const workdayEnd = new Date(workday.getFullYear(), workday.getMonth(), workday.getDate(), CLOSURE_END_HOUR)

            let closedMinutes = 0
            for (const closure of this.history.closures) {
                const start = closure.beginAt > workdayStart ? closure.beginAt : workdayStart
                const end = closure.endAt < workdayEnd ? closure.endAt : workdayEnd
                if (end > start) {
                    closedMinutes += (end - start) / (60 * 1000)
                }
            }

            return closedMinutes >= WORKDAY_MINUTES
        }

        /**
         * Reports whether time is expected on date: a workday when the campus is not closed.
         * @param {Date} date
         * @returns {boolean}
         */
        isOpenWorkday(date) {
            const isWorkday = this.calendar.workdays.some((workday) => workday.toDateString() === date.toDateString())
            return isWorkday && !this.isClosedDay(date)
        }

        /**
         * Loads the attendance data of the month shown by the page.
         * @param {Labels} labels - for the error messages
         * @returns {Promise<Attendance>}
         */
        static async fetch(labels) {
            const response = await fetch(`/me/__data.json${location.search}`, { credentials: "same-origin" })
            if (!response.ok) {
                throw new Error(`${SCRIPT_NAME}: ${labels.ERROR_DATA_UNAVAILABLE(response.status)}`)
            }

            // SvelteKit can stream more chunks on the next lines; the page data is the first one.
            const page = JSON.parse((await response.text()).split("\n")[0])
            if (page.type === "redirect") {
                throw new Error(`${SCRIPT_NAME}: ${labels.ERROR_SESSION_EXPIRED}`)
            }

            const data = Object.assign({}, ...(page.nodes ?? [])
                .filter((node) => node?.type === "data" && Array.isArray(node.data))
                .map((node) => decodeDevalue(node.data)))

            return new Attendance(data, labels)
        }
    }

    class MonthPlan {
        /**
         * @param {number} year
         * @param {number} monthIndex - 0 for January
         * @param {Set<number>} daysOff - the days of the month, from 1, with no planned time
         * @param {number} dailyMinutes - the time planned on each remaining day
         * @param {number} capsules - the capsules planned to be used this month
         * @param {CapsuleSync | null} lastSync - what the site showed at the last capsule sync
         */
        constructor(year, monthIndex, daysOff, dailyMinutes, capsules, lastSync) {
            /** @type {number} */
            this.year = year
            /** @type {number} */
            this.monthIndex = monthIndex
            /** @type {Set<number>} */
            this.daysOff = daysOff
            /** @type {number} */
            this.dailyMinutes = dailyMinutes
            /** @type {number} */
            this.capsules = capsules
            /** @type {CapsuleSync | null} */
            this.lastSync = lastSync
        }

        /**
         * @param {number} year
         * @param {number} monthIndex
         * @returns {string} the storage key of the plan of this month
         */
        static storageKey(year, monthIndex) {
            return `${PLAN_STORAGE_KEY}-${year}-${String(monthIndex + 1).padStart(2, '0')}`
        }

        /**
         * Loads the saved plan of the month of attendance, or else a plan with its days that are not open workdays as days off.
         * @param {Attendance} attendance
         * @returns {MonthPlan}
         */
        static load(attendance) {
            const { year, monthIndex } = attendance.calendar

            try {
                const savedPlan = localStorage.getItem(MonthPlan.storageKey(year, monthIndex))
                if (savedPlan !== null) {
                    /** @type {MonthPlanData} */
                    const { daysOff, dailyMinutes, capsules = 0, lastSync = null } = JSON.parse(savedPlan)
                    const isValidSync = lastSync === null
                        || (Number.isInteger(lastSync.availableCapsules) && Number.isFinite(lastSync.monthGoalMinutes))
                    if (Array.isArray(daysOff) && daysOff.every(Number.isInteger) && Number.isFinite(dailyMinutes) && dailyMinutes >= 0
                        && Number.isInteger(capsules) && capsules >= 0 && isValidSync) {
                        return new MonthPlan(year, monthIndex, new Set(daysOff), dailyMinutes, capsules, lastSync)
                    }
                }
            } catch {
                // The storage can be unavailable, or the saved plan unreadable.
            }

            const daysOff = new Set()
            for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
                if (!attendance.isOpenWorkday(new Date(year, monthIndex, day))) {
                    daysOff.add(day)
                }
            }

            return new MonthPlan(year, monthIndex, daysOff, WORKDAY_MINUTES, 0, null)
        }

        /**
         * @returns {void}
         */
        save() {
            /** @type {MonthPlanData} */
            const storedPlan = {
                daysOff: [...this.daysOff],
                dailyMinutes: this.dailyMinutes,
                capsules: this.capsules,
                lastSync: this.lastSync,
            }

            try {
                localStorage.setItem(MonthPlan.storageKey(this.year, this.monthIndex), JSON.stringify(storedPlan))
            } catch {
                // Without storage, the plan lasts until the page is reloaded.
            }
        }

        /**
         * @param {number} day - the day of the month, from 1
         * @returns {void}
         */
        toggleDayOff(day) {
            if (this.daysOff.has(day)) {
                this.daysOff.delete(day)
            } else {
                this.daysOff.add(day)
            }
        }

        /**
         * @param {Date} [now]
         * @returns {number} the days after now that are not days off
         */
        countRemainingDays(now = new Date()) {
            let remainingDays = 0
            for (let day = 1; day <= getDaysInMonth(this.year, this.monthIndex); day++) {
                const date = new Date(this.year, this.monthIndex, day)
                if (date > now && !this.daysOff.has(day)) {
                    remainingDays++
                }
            }

            return remainingDays
        }

        /**
         * @param {number} monthGoalMinutes
         * @returns {number} the minutes to have logged by today to reach the goal with the planned time
         */
        getExpectedMinutes(monthGoalMinutes) {
            return this.getExpectedRange(monthGoalMinutes).end
        }

        /**
         * @param {Date} [now]
         * @returns {boolean}
         */
        isCurrentMonth(now = new Date()) {
            return this.year === now.getFullYear() && this.monthIndex === now.getMonth()
        }

        /**
         * Reports whether time is planned on the day of now, in the month of the plan.
         * @param {Date} [now]
         * @returns {boolean}
         */
        isPlannedDay(now = new Date()) {
            return this.isCurrentMonth(now) && !this.daysOff.has(now.getDate())
        }

        /**
         * The capsules count only in the current month, as the available capsules are shared by every month.
         * @param {number} monthGoalMinutes - the goal shown by the site
         * @param {Date} [now]
         * @returns {number} the goal lowered by a workday for each planned capsule
         */
        getGoalMinutes(monthGoalMinutes, now = new Date()) {
            if (!this.isCurrentMonth(now)) { return monthGoalMinutes }
            return monthGoalMinutes - this.capsules * WORKDAY_MINUTES
        }

        /**
         * Removes the capsules used since the last sync from the planned ones, and keeps at most availableCapsules.
         * A capsule counts as used when the available capsules and the goal of the month both went down.
         * @param {number} availableCapsules
         * @param {number} monthGoalMinutes - the goal shown by the site
         * @returns {void}
         */
        syncCapsules(availableCapsules, monthGoalMinutes) {
            if (this.lastSync) {
                const usedCapsules = Math.min(
                    this.lastSync.availableCapsules - availableCapsules,
                    Math.round((this.lastSync.monthGoalMinutes - monthGoalMinutes) / WORKDAY_MINUTES),
                )
                this.capsules -= Math.max(0, usedCapsules)
            }
            this.capsules = Math.max(0, Math.min(this.capsules, availableCapsules))
            this.lastSync = { availableCapsules, monthGoalMinutes }
        }

        /**
         * @param {number} monthGoalMinutes - the goal shown by the site
         * @param {Date} [now]
         * @returns {{ start: number, end: number }} the minutes to have logged at the start and at the end of the day of now
         */
        getExpectedRange(monthGoalMinutes, now = new Date()) {
            const end = this.getGoalMinutes(monthGoalMinutes, now) - this.countRemainingDays(now) * this.dailyMinutes
            const start = this.isPlannedDay(now) ? end - this.dailyMinutes : end
            return { start, end }
        }
    }

    class Page {
        /**
         * @param {Labels} labels
         */
        constructor(labels) {
            /**
             * The texts shown in the page, in the language of the site.
             * @type {Labels}
             */
            this.labels = labels

            /**
             * The month summary, where the gap is shown.
             * @type {Element}
             */
            this.summaryElement = document.querySelector(SELECTORS.summary)
            if (!this.summaryElement) {
                throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_SUMMARY_NOT_FOUND}`)
            }

            /**
             * The progress bar of the month, where the expected bar is shown.
             * @type {Element}
             */
            this.progressTrackElement = document.querySelector(SELECTORS.progressTrack)
            if (!this.progressTrackElement) {
                throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_PROGRESS_BAR_NOT_FOUND}`)
            }
            this.progressTrackElement.classList.add("relative")
            this.progressTrackElement.querySelector("div").classList.add("relative", "z-[1]")
        }

        /**
         * @returns {PageTime}
         */
        read() {
            let [loggedMonthText, loggedMonthTextOk] = getTimeText(SELECTORS.loggedMonth)
            if (!loggedMonthTextOk) {
                throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_LOGGED_MONTH_NOT_FOUND}`)
            }

            let [monthGoalText, monthGoalTextOk] = getTimeText(SELECTORS.monthGoal)
            if (!monthGoalTextOk) {
                throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_MONTH_GOAL_NOT_FOUND}`)
            }

            let timerStarted = document.querySelectorAll(SELECTORS.timerParts).length === 2
            let [loggedTodayText, loggedTodayTextOk] = timerStarted
                ? getTimeText(SELECTORS.loggedToday)
                : ["00:00", true]
            if (!loggedTodayTextOk) {
                console.warn(`${SCRIPT_NAME}: ${this.labels.WARNING_LOGGED_TODAY_NOT_FOUND}`)
            }

            return {
                loggedMonthMinutes: parseMinutes(loggedMonthText),
                monthGoalMinutes: parseMinutes(monthGoalText),
                loggedTodayMinutes: parseMinutes(loggedTodayText.replace("+", "").trim()),
            }
        }

        /**
         * Redraws the expected bar and the gap from plan.
         * @param {MonthPlan} plan
         * @param {PageTime} time
         * @returns {void}
         */
        update(plan, time) {
            this.renderExpectedBar(plan, time)
            this.renderGap(plan, time)
        }

        /**
         * @param {PageTime} a
         * @param {PageTime} b
         * @returns {boolean}
         */
        static equal(a, b) {
            return a.loggedMonthMinutes === b.loggedMonthMinutes
                && a.monthGoalMinutes === b.monthGoalMinutes
                && a.loggedTodayMinutes === b.loggedTodayMinutes
        }

        /**
         * Replaces the expected bar, shown only while the logged time is behind it.
         * Its width follows the goal shown by the site, as the progress bar of the site does.
         * @param {MonthPlan} plan
         * @param {PageTime} time
         * @returns {void}
         */
        renderExpectedBar(plan, time) {
            const expectedMinutes = plan.getExpectedMinutes(time.monthGoalMinutes)
            let expectedProgressBarElement = this.progressTrackElement.querySelector(".improved-logbar-expected-bar")
            let barExists = expectedProgressBarElement !== null

            const loggedTotalMinutes = time.loggedMonthMinutes + time.loggedTodayMinutes
            if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes) || expectedMinutes <= loggedTotalMinutes) {
                expectedProgressBarElement?.remove()
                return
            }

            if (!barExists) {
                expectedProgressBarElement = document.createElement("div")
                expectedProgressBarElement.classList.add("improved-logbar-expected-bar")
                expectedProgressBarElement.style.width = `0%`
                this.progressTrackElement.appendChild(expectedProgressBarElement)
            }

            let expectedProgressBarLabelElement = this.progressTrackElement.querySelector(".improved-logbar-expected-bar-label")
            let barLabelExists = expectedProgressBarLabelElement !== null
            if (!barLabelExists) {
                expectedProgressBarLabelElement = document.createElement("span")
                expectedProgressBarLabelElement.classList.add("improved-logbar-expected-bar-label")
                expectedProgressBarElement.append(expectedProgressBarLabelElement)
            }
            expectedProgressBarLabelElement.textContent = `${formatMinutes(expectedMinutes)}`

            setTimeout(() => {
                expectedProgressBarElement.style.width = `${expectedMinutes / time.monthGoalMinutes * 100}%`
            }, 30)
        }

        /**
         * Replaces the gap, shown only while the goal of the month is not reached.
         * Below the time expected at the start of today, the gap is the delay; below the time expected at the end of today, it is the time remaining today.
         * @param {MonthPlan} plan
         * @param {PageTime} time
         * @returns {void}
         */
        renderGap(plan, time) {
            this.summaryElement.querySelector(".improved-logbar-gap-container")?.remove()

            if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes)) { return }

            this.summaryElement.classList.add("improved-logbar-summary")

            const { start, end } = plan.getExpectedRange(time.monthGoalMinutes)
            const loggedTotalMinutes = time.loggedMonthMinutes + time.loggedTodayMinutes
            const expectedMinutes = loggedTotalMinutes < start ? start : end
            const gapMinutes = Math.abs(expectedMinutes - loggedTotalMinutes)
            const gapDays = gapMinutes / plan.dailyMinutes

            let gapDirection
            if (loggedTotalMinutes < start) {
                gapDirection = {
                    label: `-${formatMinutes(gapMinutes)}`,
                    className: "improved-logbar-missing",
                    formatDays: this.labels.MISSING_DAYS,
                }
            } else if (loggedTotalMinutes < end) {
                gapDirection = {
                    label: this.labels.REMAINING_TODAY(formatMinutes(gapMinutes)),
                    className: "improved-logbar-in-progress",
                    formatDays: null,
                }
            } else {
                gapDirection = {
                    label: `+${formatMinutes(gapMinutes)}`,
                    className: "improved-logbar-bonus",
                    formatDays: this.labels.BONUS_DAYS,
                }
            }

            const gapContainer = document.createElement("span")
            gapContainer.className = "improved-logbar-gap-container"
            this.summaryElement.prepend(gapContainer)

            const gapTimeLabelElement = document.createElement("strong")
            gapTimeLabelElement.classList.add(gapDirection.className)
            gapTimeLabelElement.title = this.labels.EXPECTED(formatMinutes(expectedMinutes))
            gapTimeLabelElement.textContent = gapDirection.label
            gapContainer.prepend(gapTimeLabelElement)

            if (plan.dailyMinutes > 0 && gapDirection.formatDays) {
                const gapDaysLabelElement = document.createElement("span")
                gapDaysLabelElement.className = "improved-logbar-gap-days"
                gapDaysLabelElement.classList.add(gapDirection.className)
                gapDaysLabelElement.textContent = `(${gapDirection.formatDays(gapDays)})`
                gapContainer.append(gapDaysLabelElement)
            }

            if (plan.isCurrentMonth() && plan.capsules > 0) {
                const capsuleLabelElement = document.createElement("span")
                capsuleLabelElement.className = "improved-logbar-gap-capsule"
                capsuleLabelElement.textContent = `(${this.labels.CAPSULES_LEFT(plan.capsules)})`
                gapContainer.append(capsuleLabelElement)
            }
        }

        /**
         * Calls callback with the new time when one of the times changes, until an error occurs.
         * @param {(time: PageTime) => void | Promise<void>} callback
         * @returns {void}
         */
        watch(callback) {
            let time = this.read()

            const stop = (error) => {
                observer.disconnect()
                console.error(error)
                renderError(error, this.labels)
            }

            const observer = new MutationObserver(() => {
                try {
                    const newTime = this.read()
                    if (Page.equal(newTime, time)) { return }

                    time = newTime
                    Promise.resolve(callback(time)).catch(stop)
                } catch (error) {
                    stop(error)
                }
            })
            observer.observe(document.querySelector(SELECTORS.main), { childList: true, subtree: true, characterData: true })
        }
    }

    /**
     * The settings block at the bottom of the sidebar: the plan, the theme and the credit.
     */
    class Settings {
        /**
         * @param {string} lang
         */
        constructor(lang) {
            /**
             * The language chosen on the site, such as "fr".
             * @type {string}
             */
            this.lang = lang

            /**
             * The texts shown by the script, in lang.
             * @type {Labels}
             */
            this.labels = getLabels(lang)

            /**
             * The block in the sidebar that holds every setting.
             * @type {HTMLElement}
             */
            this.settingsElement = document.createElement("section")
            this.settingsElement.className = "improved-logbar-settings"

            /**
             * The input of the planned capsules, only in the current month.
             * @type {HTMLInputElement | null}
             */
            this.capsulesInputElement = null
        }

        /**
         * Reads the language chosen on the site, or English when none was chosen.
         * @returns {Promise<Settings>}
         */
        static async load() {
            const localeCookie = await cookieStore.get(LANG_COOKIE_KEY)
            return new Settings(localeCookie?.value ?? "en")
        }

        /**
         * Adds the theme and the credit, and keeps the block at the bottom of the sidebar.
         * @returns {void}
         */
        mount() {
            this.mountThemeSwitch()

            const creditElement = document.createElement("a")
            creditElement.className = "improved-logbar-credit"
            creditElement.href = "https://github.com/parad0xe"
            creditElement.target = "_blank"
            creditElement.rel = "noopener noreferrer"
            creditElement.textContent = "@nlallema"
            this.settingsElement.append(creditElement)

            // The sidebar content can be rendered again, for example when the mobile sidebar opens.
            const attach = () => {
                const sidebarContentElement = document.querySelector(SELECTORS.sidebarContent)
                if (sidebarContentElement && !sidebarContentElement.contains(this.settingsElement)) {
                    sidebarContentElement.append(this.settingsElement)
                }
            }
            attach()
            new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
        }

        /**
         * @returns {void}
         */
        mountThemeSwitch() {
            let isDark = isDarkThemeChosen()

            const rowElement = document.createElement("div")
            rowElement.className = "improved-logbar-settings-row"
            rowElement.textContent = this.labels.THEME

            const switchElement = document.createElement("button")
            switchElement.type = "button"
            switchElement.className = "improved-logbar-theme-switch"
            switchElement.title = this.labels.THEME
            switchElement.setAttribute("aria-label", this.labels.THEME)

            const applyTheme = () => {
                const root = document.documentElement
                if (root.classList.contains("dark") !== isDark) {
                    root.classList.toggle("dark", isDark)
                }
                switchElement.textContent = isDark ? "☀" : "☾"
                switchElement.setAttribute("aria-pressed", String(isDark))
            }

            switchElement.addEventListener("click", () => {
                isDark = !isDark
                saveThemeChoice(isDark)
                applyTheme()
            })
            rowElement.append(switchElement)
            this.settingsElement.append(rowElement)

            applyTheme()
            new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
        }

        /**
         * Adds the days off, the planned hours and, in the current month, the planned capsules of plan, and redraws page after each change.
         * @param {MonthPlan} plan
         * @param {Page} page
         * @param {number} availableCapsules
         * @returns {void}
         */
        mountPlan(plan, page, availableCapsules) {
            const sectionElement = document.createElement("div")
            sectionElement.className = "improved-logbar-settings-section"

            const titleElement = document.createElement("span")
            titleElement.className = "improved-logbar-settings-title"
            titleElement.textContent = this.labels.DAYS_OFF

            const calendarElement = document.createElement("improved-logbar-calendar")
            calendarElement.lang = this.lang
            calendarElement.setPlan(plan)

            const hoursRowElement = document.createElement("label")
            hoursRowElement.className = "improved-logbar-settings-row"
            hoursRowElement.textContent = this.labels.HOURS_PER_REMAINING_DAY

            const hoursInputElement = document.createElement("input")
            hoursInputElement.type = "number"
            hoursInputElement.min = "0"
            hoursInputElement.max = "24"
            hoursInputElement.step = "0.5"
            hoursInputElement.value = String(plan.dailyMinutes / 60)
            hoursRowElement.append(hoursInputElement)

            const savePlan = () => {
                plan.save()
                page.update(plan, page.read())
            }

            calendarElement.addEventListener("change", savePlan)
            hoursInputElement.addEventListener("change", () => {
                const hours = hoursInputElement.valueAsNumber
                if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
                    hoursInputElement.value = String(plan.dailyMinutes / 60)
                    return
                }
                plan.dailyMinutes = Math.round(hours * 60)
                savePlan()
            })

            sectionElement.append(titleElement, calendarElement, hoursRowElement)

            if (plan.isCurrentMonth()) {
                const capsulesRowElement = document.createElement("label")
                capsulesRowElement.className = "improved-logbar-settings-row"
                capsulesRowElement.textContent = this.labels.CAPSULES_TO_USE

                this.capsulesInputElement = document.createElement("input")
                this.capsulesInputElement.type = "number"
                this.capsulesInputElement.min = "0"
                this.capsulesInputElement.step = "1"
                this.updateCapsules(plan, availableCapsules)
                capsulesRowElement.append(this.capsulesInputElement)

                this.capsulesInputElement.addEventListener("change", () => {
                    const capsules = this.capsulesInputElement.valueAsNumber
                    if (!Number.isInteger(capsules) || capsules < 0) {
                        this.capsulesInputElement.value = String(plan.capsules)
                        return
                    }
                    plan.capsules = Math.min(capsules, Number(this.capsulesInputElement.max))
                    this.capsulesInputElement.value = String(plan.capsules)
                    savePlan()
                })

                sectionElement.append(capsulesRowElement)
            }

            this.settingsElement.prepend(sectionElement)
        }

        /**
         * Shows the planned capsules of plan, at most availableCapsules.
         * @param {MonthPlan} plan
         * @param {number} availableCapsules
         * @returns {void}
         */
        updateCapsules(plan, availableCapsules) {
            if (!this.capsulesInputElement) { return }
            this.capsulesInputElement.max = String(availableCapsules)
            this.capsulesInputElement.value = String(plan.capsules)
        }
    }



    // CUSTOM ELEMENTS - CALENDAR WIDGET
    /**
     * Shows the days of a month plan and toggles its days off, then dispatches change.
     */
    class CalendarWidget extends HTMLElement {
        constructor() {
            super();
            /**
             * The plan whose days off are shown.
             * @type {MonthPlan | null}
             */
            this.plan = null
            /** @type {ShadowRoot} */
            this.shadow = this.attachShadow({ mode: 'open' })
            /**
             * The grid of the days, created once the widget is in the page.
             * @type {Element | null}
             */
            this.calendarElement = null
        }

        /** @returns {void} */
        connectedCallback() {
            this.shadow.innerHTML = `
            <style>
                .calendar {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }

                .calendar-weekday {
                    text-align: center;
                    font-size: 0.625rem;
                    color: var(--muted-foreground);
                }

                .calendar-day {
                    padding: 4px 0;
                    border: 1px solid var(--improved-logbar-day-border);
                    border-radius: 4px;
                    text-align: center;
                    font-size: 0.75rem;
                    color: var(--sidebar-foreground);
                    cursor: pointer;
                    transition: background-color 150ms, border-color 150ms;
                }
                .calendar-day:not(.past):not(.day-off):hover {
                    background: var(--improved-logbar-day-hover);
                }
                .calendar-day.day-off {
                    background: var(--improved-logbar-day-off-background);
                    border-color: var(--improved-logbar-day-off-border);
                    color: var(--improved-logbar-day-off-text);
                    font-weight: 500;
                }
                .calendar-day.day-off:not(.past):hover {
                    border-color: var(--improved-logbar-day-off-text);
                }
                .calendar-day.past {
                    border-color: var(--improved-logbar-past-day-border);
                    color: var(--improved-logbar-past-day-text);
                    cursor: default;
                }
                .calendar-day.past.day-off {
                    background: var(--improved-logbar-past-day-off-background);
                    font-weight: normal;
                }
            </style>

            <div class="calendar"></div>
        `
            this.calendarElement = this.shadow.querySelector(".calendar")
            this.render()
        }

        /**
         * @param {MonthPlan} plan
         * @returns {void}
         */
        setPlan(plan) {
            this.plan = plan
            this.render()
        }

        /**
         * Draws the month of the plan in weeks from Monday, with the weekdays in the lang of the widget.
         * @returns {void}
         */
        render() {
            if (!this.plan || !this.calendarElement) { return }

            this.calendarElement.replaceChildren()

            for (const weekday of getLabels(this.lang).WEEKDAYS) {
                const weekdayElement = document.createElement("div")
                weekdayElement.classList.add("calendar-weekday")
                weekdayElement.textContent = weekday
                this.calendarElement.append(weekdayElement)
            }

            const firstWeekday = (new Date(this.plan.year, this.plan.monthIndex, 1).getDay() + 6) % 7
            for (let i = 0; i < firstWeekday; i++) {
                this.calendarElement.append(document.createElement("div"))
            }

            for (let day = 1; day <= getDaysInMonth(this.plan.year, this.plan.monthIndex); day++) {
                this.calendarElement.append(this.renderDay(day))
            }
        }

        /**
         * Only the days after today can be toggled, as the others no longer change the gap.
         * @param {number} day - the day of the month, from 1
         * @returns {HTMLDivElement}
         */
        renderDay(day) {
            const dayElement = document.createElement("div")
            dayElement.classList.add("calendar-day")
            dayElement.classList.toggle("day-off", this.plan.daysOff.has(day))
            dayElement.textContent = String(day)

            const isPast = new Date(this.plan.year, this.plan.monthIndex, day) <= new Date()
            if (isPast) {
                dayElement.classList.add("past")
            } else {
                dayElement.addEventListener("click", () => {
                    this.plan.toggleDayOff(day)
                    dayElement.classList.toggle("day-off", this.plan.daysOff.has(day))
                    this.dispatchEvent(new Event("change"))
                })
            }

            return dayElement
        }
    }
    customElements.define('improved-logbar-calendar', CalendarWidget)


    // MAIN
    /**
     * @param {Error} error
     * @param {Labels} labels
     * @returns {void}
     */
    function renderError(error, labels) {
        const summaryElement = document.querySelector(SELECTORS.summary)
        if (summaryElement) {
            summaryElement.querySelector(".improved-logbar-gap-container")?.remove()

            const errorElement = document.createElement("span")
            errorElement.className = "improved-logbar-gap-container"
            errorElement.title = error.message
            errorElement.textContent = labels.GAP_UNAVAILABLE
            summaryElement.prepend(errorElement)
        }
    }

    /**
     * @param {Settings} settings
     * @returns {Promise<void>}
     */
    async function showMonthGap(settings) {
        const attendance = await Attendance.fetch(settings.labels)
        const plan = MonthPlan.load(attendance)
        const page = new Page(settings.labels)

        const time = page.read()
        if (plan.isCurrentMonth()) {
            plan.syncCapsules(attendance.availableCapsules, time.monthGoalMinutes)
            plan.save()
        }
        page.update(plan, time)

        page.watch(async (time) => {
            // A capsule used on the site lowers the goal of the month.
            if (plan.isCurrentMonth() && time.monthGoalMinutes !== plan.lastSync.monthGoalMinutes) {
                const { availableCapsules } = await Attendance.fetch(settings.labels)
                plan.syncCapsules(availableCapsules, time.monthGoalMinutes)
                plan.save()
                settings.updateCapsules(plan, availableCapsules)
            }
            page.update(plan, time)
        })

        settings.mountPlan(plan, page, attendance.availableCapsules)
    }

    /** @returns {Promise<void>} */
    async function main() {
        const style = document.createElement("style")
        style.textContent = LAYOUT_STYLE + THEME_STYLE
        document.head.append(style)

        const settings = await Settings.load()
        settings.mount()

        setTimeout(() => {
            showMonthGap(settings).catch((error) => {
                console.error(error)
                renderError(error, settings.labels)
            })
        }, 100)
    }

    main()
})();
