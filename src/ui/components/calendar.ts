import { getLabels } from "../../labels"
import { getDaysInMonth } from "../../lib/time"
import type { DayMark } from "../../models/attendance"
import type { MonthPlan } from "../../models/month-plan"

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
