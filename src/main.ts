import { getLabels, type Labels } from "./labels"
import { Attendance } from "./models/attendance"
import { MonthPlan } from "./models/month-plan"
import LAYOUT_STYLE from "./styles/layout.css"
import THEME_STYLE from "./styles/theme.css"
import "./ui/components/calendar"
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
