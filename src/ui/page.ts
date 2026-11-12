import { SCRIPT_NAME } from "../constants"
import type { Labels } from "../labels"
import { formatMinutes, parseMinutes } from "../lib/time"
import type { MonthPlan } from "../models/month-plan"

const SELECTORS = {
    main: "[data-slot='sidebar-inset'] main",
    summary: "[data-slot='sidebar-inset'] main div:nth-of-type(2) div:nth-of-type(1)",
    progressTrack: "[data-slot='sidebar-inset'] main div:nth-of-type(2) div:nth-of-type(2) div:nth-of-type(2)",
    loggedMonth: "[data-slot='sidebar-inset'] main div:nth-of-type(2) > div div:nth-of-type(2) span:nth-of-type(1)",
    monthGoal: "[data-slot='sidebar-inset'] main div:nth-of-type(2) > div div:nth-of-type(2) span:nth-of-type(3)",
    timerParts: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div > span",
    loggedToday: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div > div div > span:nth-of-type(1)",
}

interface PageTime {
    loggedMonthMinutes: number
    monthGoalMinutes: number
    loggedTodayMinutes: number
}

/**
 * @returns the text of the element, and whether the element exists
 */
function readTimeText(selector: string): [string, boolean] {
    const element = document.querySelector(selector)
    if (!element) {
        return ["00:00", false]
    }
    return [element.textContent, true]
}

function isSameTime(a: PageTime, b: PageTime): boolean {
    return a.loggedMonthMinutes === b.loggedMonthMinutes
        && a.monthGoalMinutes === b.monthGoalMinutes
        && a.loggedTodayMinutes === b.loggedTodayMinutes
}

export class Page {
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
    }

    /**
     * Lets the progress bar of the site hold the expected bar, under the logged time.
     */
    mount(): void {
        this.progressTrackElement.classList.add("relative")
        this.progressTrackElement.querySelector("div")!.classList.add("relative", "z-[1]")
    }

    read(): PageTime {
        let [loggedMonthText, hasLoggedMonth] = readTimeText(SELECTORS.loggedMonth)
        if (!hasLoggedMonth) {
            throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_LOGGED_MONTH_NOT_FOUND}`)
        }

        let [monthGoalText, hasMonthGoal] = readTimeText(SELECTORS.monthGoal)
        if (!hasMonthGoal) {
            throw new Error(`${SCRIPT_NAME}: ${this.labels.ERROR_MONTH_GOAL_NOT_FOUND}`)
        }

        let isTimerStarted = document.querySelectorAll(SELECTORS.timerParts).length === 2
        let [loggedTodayText, hasLoggedToday] = isTimerStarted
            ? readTimeText(SELECTORS.loggedToday)
            : ["00:00", true]
        if (!hasLoggedToday) {
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
    render(plan: MonthPlan, time: PageTime): void {
        this.renderExpectedBar(plan, time)
        this.renderGap(plan, time)
    }

    /**
     * Replaces the expected bar, shown only while the logged time is behind it.
     * Its width follows the goal shown by the site, as the progress bar of the site does.
     */
    private renderExpectedBar(plan: MonthPlan, time: PageTime): void {
        const expectedMinutes = plan.getExpectedMinutes(time.monthGoalMinutes)
        let expectedBarElement = this.progressTrackElement.querySelector<HTMLElement>(".improved-logbar-expected-bar")

        const loggedTotalMinutes = time.loggedMonthMinutes + time.loggedTodayMinutes
        if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes) || expectedMinutes <= loggedTotalMinutes) {
            expectedBarElement?.remove()
            return
        }

        if (!expectedBarElement) {
            expectedBarElement = document.createElement("div")
            expectedBarElement.classList.add("improved-logbar-expected-bar")
            expectedBarElement.style.width = `0%`
            this.progressTrackElement.appendChild(expectedBarElement)
        }

        let expectedBarLabelElement = this.progressTrackElement.querySelector(".improved-logbar-expected-bar-label")
        if (!expectedBarLabelElement) {
            expectedBarLabelElement = document.createElement("span")
            expectedBarLabelElement.classList.add("improved-logbar-expected-bar-label")
            expectedBarElement.append(expectedBarLabelElement)
        }
        expectedBarLabelElement.textContent = `${formatMinutes(expectedMinutes)}`

        setTimeout(() => {
            expectedBarElement.style.width = `${expectedMinutes / time.monthGoalMinutes * 100}%`
        }, 30)
    }

    /**
     * Replaces the gap, shown only while the goal of the month is not reached.
     * Below the time expected at the start of today, the gap is the delay; below the time expected at the end of today, it is the time remaining today.
     */
    private renderGap(plan: MonthPlan, time: PageTime): void {
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

        const gapContainerElement = document.createElement("span")
        gapContainerElement.className = "improved-logbar-gap-container"
        this.summaryElement.prepend(gapContainerElement)

        const gapTimeElement = document.createElement("strong")
        gapTimeElement.classList.add(gapDirection.className)
        gapTimeElement.title = this.labels.EXPECTED(formatMinutes(expectedMinutes))
        gapTimeElement.textContent = gapDirection.label
        gapContainerElement.prepend(gapTimeElement)

        if (plan.dailyMinutes > 0 && gapDirection.formatDays) {
            const gapDaysElement = document.createElement("span")
            gapDaysElement.className = "improved-logbar-gap-days"
            gapDaysElement.classList.add(gapDirection.className)
            gapDaysElement.textContent = `(${gapDirection.formatDays(gapDays)})`
            gapContainerElement.append(gapDaysElement)
        }

        if (plan.isCurrentMonth() && plan.capsules > 0) {
            const gapCapsuleElement = document.createElement("span")
            gapCapsuleElement.className = "improved-logbar-gap-capsule"
            gapCapsuleElement.textContent = `(${this.labels.CAPSULES_LEFT(plan.capsules)})`
            gapContainerElement.append(gapCapsuleElement)
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
            Page.renderError(error, this.labels)
        }

        const observer = new MutationObserver(() => {
            try {
                const newTime = this.read()
                if (isSameTime(newTime, time)) { return }

                time = newTime
                Promise.resolve(callback(time)).catch(stop)
            } catch (error) {
                stop(error)
            }
        })
        observer.observe(document.querySelector(SELECTORS.main)!, { childList: true, subtree: true, characterData: true })
        return () => observer.disconnect()
    }

    /**
     * Replaces the gap with a notice of the error.
     * Static, as the error can come before any page is created, for example when the data of the month cannot be loaded.
     */
    static renderError(error: unknown, labels: Labels): void {
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
}
