/**
 * Returns the minutes of a duration.
 * @param text - a duration such as "26:33"
 */
export function parseMinutes(text: string): number {
    let [hours, minutes] = text.split(":").map((x) => parseInt(x))
    return hours * 60 + minutes
}

/**
 * Formats `minutes` as HH:MM.
 * @param minutes - a duration in minutes
 */
export function formatMinutes(minutes: number): string {
    const sign = minutes < 0 ? "-" : ""
    const absoluteMinutes = Math.abs(minutes)
    return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')}:${String(absoluteMinutes % 60).padStart(2, '0')}`
}

/**
 * Returns the number of days in the month.
 * @param year - the year of the month
 * @param monthIndex - 0 for January
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate()
}
