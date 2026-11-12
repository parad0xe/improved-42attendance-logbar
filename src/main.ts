import { SCRIPT_NAME, WORKDAY_MINUTES } from "./constants"
import { getLabels, type Labels } from "./labels"
import { decodeDevalue } from "./lib/devalue"
import { formatMinutes, getDaysInMonth, parseMinutes } from "./lib/time"
import LAYOUT_STYLE from "./styles/layout.css"
import THEME_STYLE from "./styles/theme.css"
import { isDarkThemeChosen, saveThemeChoice } from "./ui/theme"

// CONSTANTES
const PLAN_STORAGE_KEY = "improved-logbar-plan"
const LANG_COOKIE_KEY = "PARAGLIDE_LOCALE"

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

// TYPES
interface AttendanceCalendar {
    year: number
    /** 0 for January */
    monthIndex: number
    /** the working days of the month, without weekends and public holidays */
    workdays: Date[]
}

interface AttendanceClosure {
    beginAt: Date
    endAt: Date
}

interface AttendanceHistory {
    /** the times when the campus is closed */
    closures: AttendanceClosure[]
}

interface PageTime {
    loggedMonthMinutes: number
    monthGoalMinutes: number
    loggedTodayMinutes: number
}

type DayMark = "public-holiday" | "closure"

interface CapsuleSync {
    availableCapsules: number
    /** the goal shown by the site */
    monthGoalMinutes: number
}

interface MonthPlanData {
    /** the days of the month, from 1, with no planned time */
    daysOff: number[]
    /** the time planned on each remaining day */
    dailyMinutes: number
    /** the capsules planned to be used this month */
    capsules?: number
    /** what the site showed at the last capsule sync */
    lastSync?: CapsuleSync | null
}


// HELPERS
/**
 * @returns the text of the element, and whether the element exists
 */
function getTimeText(selector: string): [string, boolean] {
    const element = document.querySelector(selector)
    if (!element) {
        return ["00:00", false]
    }
    return [element.textContent, true]
}


// OBJECTS
class Attendance {
    calendar: AttendanceCalendar
    history: AttendanceHistory
    /**
     * The capsules left to use, shared by every month.
     */
    availableCapsules: number

    /**
     * @param data - the decoded data of the /me page
     * @param labels - for the error messages
     */
    constructor(data: Record<string, any>, labels: Labels) {
        const { calendar, history } = data

        if (!Array.isArray(calendar?.workdays) || !calendar.workdays.every((day: unknown) => day instanceof Date)) {
            throw new Error(`${SCRIPT_NAME}: ${labels.ERROR_WORKDAYS_MISSING}`)
        }

        this.calendar = {
            year: calendar.year,
            monthIndex: calendar.monthIndex,
            workdays: calendar.workdays,
        }

        this.history = {
            closures: history?.closures ?? [],
        }

        this.availableCapsules = Array.isArray(data.availableCapsules) ? data.availableCapsules.length : 0
    }

    /**
     * Reports whether closures cover a full workday between 08:00 and 20:00, as on the site.
     */
    isClosedDay(workday: Date): boolean {
        const workdayStart = new Date(workday.getFullYear(), workday.getMonth(), workday.getDate(), CLOSURE_START_HOUR)
        const workdayEnd = new Date(workday.getFullYear(), workday.getMonth(), workday.getDate(), CLOSURE_END_HOUR)

        let closedMinutes = 0
        for (const closure of this.history.closures) {
            const start = closure.beginAt > workdayStart ? closure.beginAt : workdayStart
            const end = closure.endAt < workdayEnd ? closure.endAt : workdayEnd
            if (end > start) {
                closedMinutes += (end.getTime() - start.getTime()) / (60 * 1000)
            }
        }

        return closedMinutes >= WORKDAY_MINUTES
    }

    /**
     * @returns whether date is in the workdays of the month
     */
    isWorkday(date: Date): boolean {
        return this.calendar.workdays.some((workday) => workday.toDateString() === date.toDateString())
    }

    /**
     * Reports whether time is expected on date: a workday when the campus is not closed.
     */
    isOpenWorkday(date: Date): boolean {
        return this.isWorkday(date) && !this.isClosedDay(date)
    }

    /**
     * @returns the public holidays and the closed workdays of the month, by day from 1
     */
    getDayMarks(): Map<number, DayMark> {
        const { year, monthIndex } = this.calendar

        const dayMarks = new Map<number, DayMark>()
        for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
            const date = new Date(year, monthIndex, day)
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            if (!isWeekend && !this.isWorkday(date)) {
                dayMarks.set(day, "public-holiday")
            } else if (this.isWorkday(date) && this.isClosedDay(date)) {
                dayMarks.set(day, "closure")
            }
        }

        return dayMarks
    }

    /**
     * Loads the attendance data of the month shown by the page.
     * @param labels - for the error messages
     */
    static async fetch(labels: Labels): Promise<Attendance> {
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
            .filter((node: any) => node?.type === "data" && Array.isArray(node.data))
            .map((node: any) => decodeDevalue(node.data)))

        return new Attendance(data, labels)
    }
}

class MonthPlan {
    year: number
    monthIndex: number
    daysOff: Set<number>
    dailyMinutes: number
    capsules: number
    lastSync: CapsuleSync | null

    /**
     * @param year
     * @param monthIndex - 0 for January
     * @param daysOff - the days of the month, from 1, with no planned time
     * @param dailyMinutes - the time planned on each remaining day
     * @param capsules - the capsules planned to be used this month
     * @param lastSync - what the site showed at the last capsule sync
     */
    constructor(year: number, monthIndex: number, daysOff: Set<number>, dailyMinutes: number, capsules: number, lastSync: CapsuleSync | null) {
        this.year = year
        this.monthIndex = monthIndex
        this.daysOff = daysOff
        this.dailyMinutes = dailyMinutes
        this.capsules = capsules
        this.lastSync = lastSync
    }

    /**
     * @returns the storage key of the plan of this month
     */
    static storageKey(year: number, monthIndex: number): string {
        return `${PLAN_STORAGE_KEY}-${year}-${String(monthIndex + 1).padStart(2, '0')}`
    }

    /**
     * Loads the saved plan of the month of attendance, or else a plan with its days that are not open workdays as days off.
     */
    static load(attendance: Attendance): MonthPlan {
        const { year, monthIndex } = attendance.calendar

        try {
            const savedPlan = localStorage.getItem(MonthPlan.storageKey(year, monthIndex))
            if (savedPlan !== null) {
                const { daysOff, dailyMinutes, capsules = 0, lastSync = null }: MonthPlanData = JSON.parse(savedPlan)
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

        const daysOff = new Set<number>()
        for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
            if (!attendance.isOpenWorkday(new Date(year, monthIndex, day))) {
                daysOff.add(day)
            }
        }

        return new MonthPlan(year, monthIndex, daysOff, WORKDAY_MINUTES, 0, null)
    }

    save(): void {
        const storedPlan: MonthPlanData = {
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
     * @param day - the day of the month, from 1
     */
    toggleDayOff(day: number): void {
        if (this.daysOff.has(day)) {
            this.daysOff.delete(day)
        } else {
            this.daysOff.add(day)
        }
    }

    /**
     * @returns the days after now that are not days off
     */
    countRemainingDays(now = new Date()): number {
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
     * @returns the minutes to have logged by today to reach the goal with the planned time
     */
    getExpectedMinutes(monthGoalMinutes: number): number {
        return this.getExpectedRange(monthGoalMinutes).end
    }

    isCurrentMonth(now = new Date()): boolean {
        return this.year === now.getFullYear() && this.monthIndex === now.getMonth()
    }

    /**
     * Reports whether time is planned on the day of now, in the month of the plan.
     */
    isPlannedDay(now = new Date()): boolean {
        return this.isCurrentMonth(now) && !this.daysOff.has(now.getDate())
    }

    /**
     * The capsules count only in the current month, as the available capsules are shared by every month.
     * @param monthGoalMinutes - the goal shown by the site
     * @param now
     * @returns the goal lowered by a workday for each planned capsule
     */
    getGoalMinutes(monthGoalMinutes: number, now = new Date()): number {
        if (!this.isCurrentMonth(now)) { return monthGoalMinutes }
        return monthGoalMinutes - this.capsules * WORKDAY_MINUTES
    }

    /**
     * Removes the capsules used since the last sync from the planned ones, and keeps at most availableCapsules.
     * A capsule counts as used when the available capsules and the goal of the month both went down.
     * @param availableCapsules
     * @param monthGoalMinutes - the goal shown by the site
     */
    syncCapsules(availableCapsules: number, monthGoalMinutes: number): void {
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
     * @param monthGoalMinutes - the goal shown by the site
     * @param now
     * @returns the minutes to have logged at the start and at the end of the day of now
     */
    getExpectedRange(monthGoalMinutes: number, now = new Date()): { start: number, end: number } {
        const end = this.getGoalMinutes(monthGoalMinutes, now) - this.countRemainingDays(now) * this.dailyMinutes
        const start = this.isPlannedDay(now) ? end - this.dailyMinutes : end
        return { start, end }
    }
}

class Page {
    /**
     * The texts shown in the page, in the language of the site.
     */
    labels: Labels
    /**
     * The month summary, where the gap is shown.
     */
    summaryElement: Element
    /**
     * The progress bar of the month, where the expected bar is shown.
     */
    progressTrackElement: Element

    constructor(labels: Labels) {
        this.labels = labels

        const summaryElement = document.querySelector(SELECTORS.summary)
        if (!summaryElement) {
            throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_SUMMARY_NOT_FOUND}`)
        }
        this.summaryElement = summaryElement

        const progressTrackElement = document.querySelector(SELECTORS.progressTrack)
        if (!progressTrackElement) {
            throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_PROGRESS_BAR_NOT_FOUND}`)
        }
        this.progressTrackElement = progressTrackElement
        this.progressTrackElement.classList.add("relative")
        this.progressTrackElement.querySelector("div")!.classList.add("relative", "z-[1]")
    }

    read(): PageTime {
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
     */
    update(plan: MonthPlan, time: PageTime): void {
        this.renderExpectedBar(plan, time)
        this.renderGap(plan, time)
    }

    static equal(a: PageTime, b: PageTime): boolean {
        return a.loggedMonthMinutes === b.loggedMonthMinutes
            && a.monthGoalMinutes === b.monthGoalMinutes
            && a.loggedTodayMinutes === b.loggedTodayMinutes
    }

    /**
     * Replaces the expected bar, shown only while the logged time is behind it.
     * Its width follows the goal shown by the site, as the progress bar of the site does.
     */
    renderExpectedBar(plan: MonthPlan, time: PageTime): void {
        const expectedMinutes = plan.getExpectedMinutes(time.monthGoalMinutes)
        let expectedProgressBarElement = this.progressTrackElement.querySelector<HTMLElement>(".improved-logbar-expected-bar")

        const loggedTotalMinutes = time.loggedMonthMinutes + time.loggedTodayMinutes
        if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes) || expectedMinutes <= loggedTotalMinutes) {
            expectedProgressBarElement?.remove()
            return
        }

        if (!expectedProgressBarElement) {
            expectedProgressBarElement = document.createElement("div")
            expectedProgressBarElement.classList.add("improved-logbar-expected-bar")
            expectedProgressBarElement.style.width = `0%`
            this.progressTrackElement.appendChild(expectedProgressBarElement)
        }

        let expectedProgressBarLabelElement = this.progressTrackElement.querySelector(".improved-logbar-expected-bar-label")
        if (!expectedProgressBarLabelElement) {
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
     */
    renderGap(plan: MonthPlan, time: PageTime): void {
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
     * @returns stops watching
     */
    watch(callback: (time: PageTime) => void | Promise<void>): () => void {
        let time = this.read()

        const stop = (error: unknown) => {
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
        observer.observe(document.querySelector(SELECTORS.main)!, { childList: true, subtree: true, characterData: true })
        return () => observer.disconnect()
    }
}

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
function renderError(error: unknown, labels: Labels): void {
    const summaryElement = document.querySelector(SELECTORS.summary)
    if (summaryElement) {
        summaryElement.querySelector(".improved-logbar-gap-container")?.remove()

        const errorElement = document.createElement("span")
        errorElement.className = "improved-logbar-gap-container"
        errorElement.title = error instanceof Error ? error.message : String(error)
        errorElement.textContent = labels.GAP_UNAVAILABLE
        summaryElement.prepend(errorElement)
    }
}

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
