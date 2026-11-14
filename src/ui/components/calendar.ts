import { getLabels } from "../../labels"
import { getDaysInMonth } from "../../lib/time"
import type { DayMark } from "../../models/attendance"
import type { MonthPlan } from "../../models/month-plan"

/** Shows the days of a plan, toggles its days off and dispatches `change`. */
class CalendarElement extends HTMLElement {
    plan: MonthPlan | null
    dayMarks: Map<number, DayMark>
    shadow: ShadowRoot
    /** The grid of the days, once the calendar is in the page. */
    gridElement: Element | null
    /** The legend of the day marks, once the calendar is in the page. */
    legendElement: Element | null

    constructor() {
        super();
        this.plan = null
        this.dayMarks = new Map()
        this.shadow = this.attachShadow({ mode: 'open' })
        this.gridElement = null
        this.legendElement = null
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback(): void {
        this.shadow.innerHTML = `
            <style>
                .grid {
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
                    border: 1px solid var(--improved-attendance-day-border);
                    border-radius: 4px;
                    text-align: center;
                    font-size: 0.75rem;
                    color: var(--sidebar-foreground);
                    cursor: pointer;
                    transition: background-color 150ms, border-color 150ms;
                }
                .calendar-day:not(.past):not(.day-off):hover {
                    background: var(--improved-attendance-day-hover);
                }
                .calendar-day.day-off {
                    background: var(--improved-attendance-day-off-background);
                    border-color: var(--improved-attendance-day-off-border);
                    color: var(--improved-attendance-day-off-text);
                    font-weight: 500;
                }
                .calendar-day.day-off:not(.past):hover {
                    border-color: var(--improved-attendance-day-off-text);
                }
                .calendar-day.past {
                    border-color: var(--improved-attendance-past-day-border);
                    color: var(--improved-attendance-past-day-text);
                    cursor: default;
                }
                .calendar-day.past.day-off {
                    background: var(--improved-attendance-past-day-off-background);
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
                .public-holiday::after, .legend-mark.public-holiday::before { background: var(--improved-attendance-public-holiday); }
                .closure::after, .legend-mark.closure::before { background: var(--improved-attendance-closure); }

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

            <div class="grid"></div>
            <div class="legend"></div>
        `
        this.gridElement = this.shadow.querySelector(".grid")
        this.legendElement = this.shadow.querySelector(".legend")
        this.draw()
    }

    /**
     * Renders the days of `plan` with their `dayMarks`.
     * @param plan - the plan of the month
     * @param dayMarks - the marks of the days of the month, by day from 1
     */
    render(plan: MonthPlan, dayMarks: Map<number, DayMark>): void {
        this.plan = plan
        this.dayMarks = dayMarks
        this.draw()
    }

    /** Draws the days of the plan and the legend of their marks. */
    private draw(): void {
        if (!this.plan || !this.gridElement || !this.legendElement) { return }

        this.gridElement.replaceChildren()

        for (const weekday of getLabels(this.lang).CALENDAR_WEEKDAYS) {
            const weekdayElement = document.createElement("div")
            weekdayElement.classList.add("calendar-weekday")
            weekdayElement.textContent = weekday
            this.gridElement.append(weekdayElement)
        }

        const firstWeekday = (new Date(this.plan.year, this.plan.monthIndex, 1).getDay() + 6) % 7
        for (let i = 0; i < firstWeekday; i++) {
            this.gridElement.append(document.createElement("div"))
        }

        for (let day = 1; day <= getDaysInMonth(this.plan.year, this.plan.monthIndex); day++) {
            this.gridElement.append(this.createDayElement(this.plan, day))
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
     * Returns the label of `mark` in the language of the calendar.
     * @param mark - a public holiday or a closure
     */
    private getMarkLabel(mark: DayMark): string {
        const labels = getLabels(this.lang)
        return mark === "public-holiday" ? labels.CALENDAR_PUBLIC_HOLIDAY : labels.CALENDAR_CLOSURE
    }

    /**
     * Creates the element of `day`, which toggles the day off when it is today or later.
     * @param plan - the plan of the month
     * @param day - the day of the month, from 1
     */
    private createDayElement(plan: MonthPlan, day: number): HTMLDivElement {
        const dayElement = document.createElement("div")
        dayElement.classList.add("calendar-day")
        dayElement.classList.toggle("day-off", plan.daysOff.has(day))
        dayElement.textContent = String(day)

        const mark = this.dayMarks.get(day)
        if (mark) {
            dayElement.classList.add(mark)
            dayElement.title = this.getMarkLabel(mark)
        }

        const isPast = new Date(plan.year, plan.monthIndex, day).getTime() < new Date().setHours(0, 0, 0, 0)
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
customElements.define('improved-attendance-calendar', CalendarElement)

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface HTMLElementTagNameMap {
        "improved-attendance-calendar": CalendarElement
    }
}
