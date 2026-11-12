/**
 * @param text - a duration such as "26:33"
 */
export function parseMinutes(text: string): number {
    let [hours, minutes] = text.split(":").map((x) => parseInt(x))
    return hours * 60 + minutes
}

/**
 * @returns the duration as HH:MM, with a minus sign when negative
 */
export function formatMinutes(minutes: number): string {
    const sign = minutes < 0 ? "-" : ""
    const absoluteMinutes = Math.abs(minutes)
    return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')}:${String(absoluteMinutes % 60).padStart(2, '0')}`
}

/**
 * @param year
 * @param monthIndex - 0 for January
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate()
}
