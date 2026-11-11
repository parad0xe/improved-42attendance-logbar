// ==UserScript==
// @name         Improved 42Attendance Logbar
// @namespace    https://github.com/parad0xe
// @version      2026.11.13
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

    const WORKDAY_MINUTES = 7 * 60
    const CLOSURE_START_HOUR = 8
    const CLOSURE_END_HOUR = 20

    const SELECTORS = {
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
            --improved-logbar-expected-bar: #facc1530;
            --improved-logbar-expected-label: #fde68ab3;
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
            position: fixed;
            right: 1rem;
            bottom: 1rem;
            z-index: 100;
            width: 2.5rem;
            height: 2.5rem;
            border: 1px solid var(--border);
            border-radius: 9999px;
            background: var(--card);
            color: var(--foreground);
            font-size: 1.1rem;
            cursor: pointer;
            box-shadow: var(--shadow-md);
        }
    `
    const LAYOUT_STYLE = `
        :root {
            --improved-logbar-bonus: #15803d;
            --improved-logbar-missing: #612c2c;
            --improved-logbar-expected-bar: #ffca0033;
            --improved-logbar-expected-label: #4e2f08a1;
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

        .improved-logbar-gap-container { display: flex; align-items: center; justify-content: end; flex-basis: 100%; margin-bottom: 0.25rem; font-size: 0.9rem; }
        .improved-logbar-gap-days { padding: 0 0.5rem; }
        
        .improved-logbar-bonus { color: var(--improved-logbar-bonus); }
        .improved-logbar-missing { color: var(--improved-logbar-missing); }
        
        .improved-logbar-credit {
            position: fixed;
            right: 4rem;
            bottom: 1rem;
            z-index: 100;
            line-height: 2.5rem;
            font-size: 0.75rem;
            color: var(--muted-foreground);
        }
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


    // HELPERS
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
     * @returns {string} the duration as HH:MM
     */
    function formatMinutes(minutes) {
        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
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


    class Attendance {
        /**
         * @param {Record<string, any>} data - the decoded data of the /me page
         */
        constructor(data) {
            const { calendar, history } = data

            if (!Array.isArray(calendar?.workdays) || !calendar.workdays.every((day) => day instanceof Date)) {
                throw new Error(`${SCRIPT_NAME}: the working days of the month are missing, the page may have changed`)
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
         * @returns {number} the minutes expected by today, from the open working days
         */
        getExpectedMinutes() {
            const today = new Date()
            const endOfToday = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() + 1
            )

            let elapsedWorkingDays = 0

            for (let date of this.calendar.workdays) {
                if (date < endOfToday && !this.isClosedDay(date)) {
                    elapsedWorkingDays++
                }
            }

            return elapsedWorkingDays * WORKDAY_MINUTES
        }

        /**
         * Loads the attendance data of the month shown by the page.
         * @returns {Promise<Attendance>}
         */
        static async fetch() {
            const response = await fetch(`/me/__data.json${location.search}`, { credentials: "same-origin" })
            if (!response.ok) {
                throw new Error(`${SCRIPT_NAME}: cannot load the attendance data (HTTP ${response.status})`)
            }

            // SvelteKit can stream more chunks on the next lines; the page data is the first one.
            const page = JSON.parse((await response.text()).split("\n")[0])
            if (page.type === "redirect") {
                throw new Error(`${SCRIPT_NAME}: the session has expired, reload the page`)
            }

            const data = Object.assign({}, ...(page.nodes ?? [])
                .filter((node) => node?.type === "data" && Array.isArray(node.data))
                .map((node) => decodeDevalue(node.data)))

            return new Attendance(data)
        }
    }

    class Page {
        constructor() {
            /**
             * The month summary, where the gap is shown.
             * @type {Element}
             */
            this.summaryElement = document.querySelector(SELECTORS.summary)
            if (!this.summaryElement) {
                throw new Error(`${SCRIPT_NAME}: cannot find the month summary, the page layout may have changed`)
            }

            /**
             * The progress bar of the month, where the expected bar is shown.
             * @type {Element}
             */
            this.progressTrackElement = document.querySelector(SELECTORS.progressTrack)
            if (!this.progressTrackElement) {
                throw new Error(`${SCRIPT_NAME}: cannot find the progress bar, the page layout may have changed`)
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
                throw new Error(`${SCRIPT_NAME}: cannot find the logged time of the month, the page layout may have changed`)
            }

            let [monthGoalText, monthGoalTextOk] = getTimeText(SELECTORS.monthGoal)
            if (!monthGoalTextOk) {
                throw new Error(`${SCRIPT_NAME}: cannot find the goal of the month, the page layout may have changed`)
            }

            let timerStarted = document.querySelectorAll(SELECTORS.timerParts).length === 2
            let [loggedTodayText, loggedTodayTextOk] = timerStarted
                ? getTimeText(SELECTORS.loggedToday)
                : ["00:00", true]
            if (!loggedTodayTextOk) {
                console.warn(`${SCRIPT_NAME}: cannot find the time logged today`)
            }

            return {
                loggedMonthMinutes: parseMinutes(loggedMonthText),
                monthGoalMinutes: parseMinutes(monthGoalText),
                loggedTodayMinutes: parseMinutes(loggedTodayText.replace("+", "").trim()),
            }
        }

        /**
         * Redraws the expected bar and the gap.
         * @param {number} expectedMinutes
         * @param {PageTime} time
         * @returns {void}
         */
        update(expectedMinutes, time) {
            this.renderExpectedBar(expectedMinutes, time)
            this.renderGap(expectedMinutes, time)
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
         * @param {number} expectedMinutes
         * @param {PageTime} time
         * @returns {void}
         */
        renderExpectedBar(expectedMinutes, time) {
            let expectedProgressBarElement = this.progressTrackElement.querySelector(".improved-logbar-expected-bar")
            let barExists = expectedProgressBarElement !== null

            const loggedTotalMinutes = time.loggedMonthMinutes + time.loggedTodayMinutes
            if (time.loggedMonthMinutes >= time.monthGoalMinutes || expectedMinutes <= loggedTotalMinutes) {
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
         * @param {number} expectedMinutes
         * @param {PageTime} time
         * @returns {void}
         */
        renderGap(expectedMinutes, time) {
            this.summaryElement.querySelector(".improved-logbar-gap-container")?.remove()

            if (time.loggedMonthMinutes >= time.monthGoalMinutes) { return }

            this.summaryElement.classList.add("improved-logbar-summary")

            const loggedTotalMinutes = time.loggedMonthMinutes + time.loggedTodayMinutes
            const gapMinutes = Math.abs(expectedMinutes - loggedTotalMinutes)
            const gapDays = gapMinutes / WORKDAY_MINUTES
            const gapDirection = (expectedMinutes <= loggedTotalMinutes) ? {
                daysLabel: "bonus",
                sign: "+",
                className: "improved-logbar-bonus"
            } : {
                daysLabel: "missing",
                sign: "-",
                className: "improved-logbar-missing"
            }

            const gapContainer = document.createElement("span")
            gapContainer.className = "improved-logbar-gap-container"
            this.summaryElement.prepend(gapContainer)

            const gapTimeLabelElement = document.createElement("strong")
            gapTimeLabelElement.classList.add(gapDirection.className)
            gapTimeLabelElement.title = `expected ${formatMinutes(expectedMinutes)}`
            gapTimeLabelElement.textContent = `${gapDirection.sign}${formatMinutes(gapMinutes)}`
            gapContainer.prepend(gapTimeLabelElement)

            const gapDaysLabelElement = document.createElement("span")
            gapDaysLabelElement.className = "improved-logbar-gap-days"
            gapDaysLabelElement.classList.add(gapDirection.className)
            gapDaysLabelElement.textContent = `(${gapDays.toFixed(1)} ${gapDirection.daysLabel} ${gapDays < 2 ? "day" : "days"})`
            gapContainer.append(gapDaysLabelElement)
        }

        /**
         * Calls callback with the new time when one of the times changes, until an error occurs.
         * @param {(time: PageTime) => void} callback
         * @returns {void}
         */
        watch(callback) {
            let time = this.read()

            const observer = new MutationObserver(() => {
                try {
                    const newTime = this.read()
                    if (Page.equal(newTime, time)) { return }

                    time = newTime
                    callback(time)
                } catch (error) {
                    observer.disconnect()
                    console.error(error)
                    renderError(error)
                }
            })
            observer.observe(document.querySelector(SELECTORS.main), { childList: true, subtree: true, characterData: true })
        }
    }


    /**
     * @returns {void}
     */
    function mountThemeSwitcher() {
        let isDark = isDarkThemeChosen()

        const switchElement = document.createElement("button")
        switchElement.type = "button"
        switchElement.className = "improved-logbar-theme-switch"
        switchElement.title = "Dark theme"
        switchElement.setAttribute("aria-label", "Dark theme")

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
        document.body.append(switchElement)

        const creditElement = document.createElement("a")
        creditElement.className = "improved-logbar-credit"
        creditElement.href = "https://github.com/parad0xe"
        creditElement.target = "_blank"
        creditElement.rel = "noopener noreferrer"
        creditElement.textContent = "@nlallema"
        document.body.append(creditElement)

        applyTheme()
        new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    }



    // MAIN
    /**
     * @param {Error} error
     * @returns {void}
     */
    function renderError(error) {
        const summaryElement = document.querySelector(SELECTORS.summary)
        if (summaryElement) {
            summaryElement.querySelector(".improved-logbar-gap-container")?.remove()

            const errorElement = document.createElement("span")
            errorElement.className = "improved-logbar-gap-container"
            errorElement.title = error.message
            errorElement.textContent = "gap unavailable"
            summaryElement.prepend(errorElement)
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async function showMonthGap() {
        const attendance = await Attendance.fetch()
        const page = new Page()

        page.update(attendance.getExpectedMinutes(), page.read())
        page.watch((time) => page.update(attendance.getExpectedMinutes(), time))
    }

    /** @returns {void} */
    function main() {
        const style = document.createElement("style")
        style.textContent = LAYOUT_STYLE + THEME_STYLE
        document.head.append(style)

        mountThemeSwitcher()
        setTimeout(() => {
            showMonthGap().catch((error) => {
                console.error(error)
                renderError(error)
            })
        }, 100)
    }

    main()
})();
