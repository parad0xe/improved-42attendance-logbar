import { getLabels, type Labels } from "./labels"
import { getDaysInMonth } from "./lib/time"
import { Attendance, type DayMark } from "./models/attendance"
import { MonthPlan } from "./models/month-plan"
import LAYOUT_STYLE from "./styles/layout.css"
import THEME_STYLE from "./styles/theme.css"
import { Page, renderError } from "./ui/page"
import { isDarkThemeChosen, saveThemeChoice } from "./ui/theme"

// CONSTANTES
const LANG_COOKIE_KEY = "PARAGLIDE_LOCALE"

const SELECTORS = {
    sidebarContent: "[data-slot='sidebar-content']",
}

// OBJECTS
/**
 * The settings block at the bottom of the sidebar: the plan, the theme and the credit.
 */
class Settings {
    /**
     * The language chosen on the site, such as "fr".
     */
    lang: string
    /**
     * The texts shown by the script, in lang.
     */
    labels: Labels
    /**
     * The block in the sidebar that holds every setting.
     */
    settingsElement: HTMLElement
    /**
     * The input of the planned capsules, only in the current month.
     */
    capsulesInputElement: HTMLInputElement | null
    /**
     * The plan settings of the month shown, replaced when the month changes.
     */
    planSectionElement: HTMLElement | null

    constructor(lang: string) {
        this.lang = lang
        this.labels = getLabels(lang)

        this.settingsElement = document.createElement("section")
        this.settingsElement.className = "improved-logbar-settings"

        this.capsulesInputElement = null
        this.planSectionElement = null
    }

    /**
     * Reads the language chosen on the site, or English when none was chosen.
     */
    static async load(): Promise<Settings> {
        const localeCookie = await cookieStore.get(LANG_COOKIE_KEY)
        return new Settings(localeCookie?.value ?? "en")
    }

    /**
     * Adds the theme and the credit, and keeps the block at the bottom of the sidebar.
     */
    mount(): void {
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

    mountThemeSwitch(): void {
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
     * Replaces the plan settings with the days off, the planned hours and, in the current month, the planned capsules of plan, and redraws page after each change.
     * @param plan
     * @param page
     * @param attendance - for the public holidays, the closures and the available capsules
     */
    mountPlan(plan: MonthPlan, page: Page, attendance: Attendance): void {
        this.planSectionElement?.remove()
        this.capsulesInputElement = null

        const sectionElement = document.createElement("div")
        sectionElement.className = "improved-logbar-settings-section"

        const titleElement = document.createElement("span")
        titleElement.className = "improved-logbar-settings-title"
        titleElement.textContent = this.labels.DAYS_OFF

        const calendarElement = document.createElement("improved-logbar-calendar")
        calendarElement.lang = this.lang
        calendarElement.setPlan(plan, attendance.getDayMarks())

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

            const capsulesInputElement = document.createElement("input")
            capsulesInputElement.type = "number"
            capsulesInputElement.min = "0"
            capsulesInputElement.step = "1"
            this.capsulesInputElement = capsulesInputElement
            this.updateCapsules(plan, attendance.availableCapsules)
            capsulesRowElement.append(capsulesInputElement)

            capsulesInputElement.addEventListener("change", () => {
                const capsules = capsulesInputElement.valueAsNumber
                if (!Number.isInteger(capsules) || capsules < 0) {
                    capsulesInputElement.value = String(plan.capsules)
                    return
                }
                plan.capsules = Math.min(capsules, Number(capsulesInputElement.max))
                capsulesInputElement.value = String(plan.capsules)
                savePlan()
            })

            sectionElement.append(capsulesRowElement)
        }

        this.planSectionElement = sectionElement
        this.settingsElement.prepend(sectionElement)
    }

    /**
     * Shows the planned capsules of plan, at most availableCapsules.
     */
    updateCapsules(plan: MonthPlan, availableCapsules: number): void {
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
    /**
     * The plan whose days off are shown.
     */
    plan: MonthPlan | null
    /**
     * The public holidays and closures of the month, by day from 1.
     */
    dayMarks: Map<number, DayMark>
    shadow: ShadowRoot
    /**
     * The grid of the days, created once the widget is in the page.
     */
    calendarElement: Element | null
    /**
     * The legend of the day marks, created once the widget is in the page.
     */
    legendElement: Element | null

    constructor() {
        super();
        this.plan = null
        this.dayMarks = new Map()
        this.shadow = this.attachShadow({ mode: 'open' })
        this.calendarElement = null
        this.legendElement = null
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
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
                    position: relative;
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

                .calendar-day.public-holiday::after,
                .calendar-day.closure::after,
                .legend-mark::before {
                    content: "";
                    display: block;
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                }
                .calendar-day.public-holiday::after,
                .calendar-day.closure::after {
                    position: absolute;
                    bottom: 2px;
                    left: calc(50% - 2px);
                }
                .calendar-day.past::after { opacity: 0.5; }
                .public-holiday::after, .legend-mark.public-holiday::before { background: var(--improved-logbar-public-holiday); }
                .closure::after, .legend-mark.closure::before { background: var(--improved-logbar-closure); }

                .legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem 0.75rem;
                    margin-top: 0.375rem;
                    font-size: 0.625rem;
                    color: var(--muted-foreground);
                }
                .legend-mark { display: flex; align-items: center; gap: 0.25rem; }
            </style>

            <div class="calendar"></div>
            <div class="legend"></div>
        `
        this.calendarElement = this.shadow.querySelector(".calendar")
        this.legendElement = this.shadow.querySelector(".legend")
        this.render()
    }

    /**
     * @param plan
     * @param dayMarks - the public holidays and closures of the month, by day from 1
     */
    setPlan(plan: MonthPlan, dayMarks: Map<number, DayMark>): void {
        this.plan = plan
        this.dayMarks = dayMarks
        this.render()
    }

    /**
     * Draws the month of the plan in weeks from Monday, then the legend of its day marks, in the lang of the widget.
     */
    render(): void {
        if (!this.plan || !this.calendarElement || !this.legendElement) { return }

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
            this.calendarElement.append(this.renderDay(this.plan, day))
        }

        this.legendElement.replaceChildren()
        for (const mark of new Set(this.dayMarks.values())) {
            const markElement = document.createElement("span")
            markElement.classList.add("legend-mark", mark)
            markElement.textContent = this.getMarkLabel(mark)
            this.legendElement.append(markElement)
        }
    }

    /**
     * @returns the name of mark, in the lang of the widget
     */
    getMarkLabel(mark: DayMark): string {
        const labels = getLabels(this.lang)
        return mark === "public-holiday" ? labels.PUBLIC_HOLIDAY : labels.CLOSURE
    }

    /**
     * Only the days after today can be toggled, as the others no longer change the gap.
     * @param plan
     * @param day - the day of the month, from 1
     */
    renderDay(plan: MonthPlan, day: number): HTMLDivElement {
        const dayElement = document.createElement("div")
        dayElement.classList.add("calendar-day")
        dayElement.classList.toggle("day-off", plan.daysOff.has(day))
        dayElement.textContent = String(day)

        const mark = this.dayMarks.get(day)
        if (mark) {
            dayElement.classList.add(mark)
            dayElement.title = this.getMarkLabel(mark)
        }

        const isPast = new Date(plan.year, plan.monthIndex, day) <= new Date()
        if (isPast) {
            dayElement.classList.add("past")
        } else {
            dayElement.addEventListener("click", () => {
                plan.toggleDayOff(day)
                dayElement.classList.toggle("day-off", plan.daysOff.has(day))
                this.dispatchEvent(new Event("change"))
            })
        }

        return dayElement
    }
}
customElements.define('improved-logbar-calendar', CalendarWidget)


declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-logbar-calendar": CalendarWidget
    }
}


// MAIN
/**
 * Calls callback when the query of the URL changes, as when the site shows another month without reloading.
 */
function watchUrl(callback: () => void): void {
    let search = location.search

    // The site changes the URL without any event, but always renders the page again.
    new MutationObserver(() => {
        if (location.search === search) { return }
        search = location.search
        callback()
    }).observe(document.body, { childList: true, subtree: true })
}

/**
 * Shows the gap of the month in the URL.
 * @param settings
 * @param isOutdated - whether another month was shown since the start
 * @returns stops watching the page
 */
async function showMonthGap(settings: Settings, isOutdated: () => boolean): Promise<() => void> {
    const attendance = await Attendance.fetch(settings.labels)
    if (isOutdated()) { return () => {} }

    const plan = MonthPlan.load(attendance)
    const page = new Page(settings.labels)

    const time = page.read()
    if (plan.isCurrentMonth()) {
        plan.syncCapsules(attendance.availableCapsules, time.monthGoalMinutes)
        plan.save()
    }
    page.update(plan, time)

    const stopWatching = page.watch(async (time) => {
        // A capsule used on the site lowers the goal of the month.
        if (plan.isCurrentMonth() && time.monthGoalMinutes !== plan.lastSync?.monthGoalMinutes) {
            const { availableCapsules } = await Attendance.fetch(settings.labels)
            plan.syncCapsules(availableCapsules, time.monthGoalMinutes)
            plan.save()
            settings.updateCapsules(plan, availableCapsules)
        }
        page.update(plan, time)
    })

    settings.mountPlan(plan, page, attendance)
    return stopWatching
}

async function main(): Promise<void> {
    const style = document.createElement("style")
    style.textContent = LAYOUT_STYLE + THEME_STYLE
    document.head.append(style)

    const settings = await Settings.load()
    settings.mount()

    let lastRun = 0
    let stopMonthGap = () => {}

    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => {
        const run = ++lastRun
        const isOutdated = () => run !== lastRun

        stopMonthGap()
        showMonthGap(settings, isOutdated)
            .then((stop) => {
                if (isOutdated()) {
                    stop()
                    return
                }
                stopMonthGap = stop
            })
            .catch((error) => {
                if (isOutdated()) { return }
                console.error(error)
                renderError(error, settings.labels)
            })
    }))

    start()
    watchUrl(start)
}

main().catch((error) => console.error(error))
