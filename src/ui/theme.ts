const THEME_STORAGE_KEY = "improved-logbar-theme"

/**
 * @returns whether the dark theme was chosen, or else whether the system uses one
 */
export function isDarkThemeChosen(): boolean {
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

export function saveThemeChoice(isDark: boolean): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light")
    } catch {
        // Without storage, the choice lasts until the page is reloaded.
    }
}
