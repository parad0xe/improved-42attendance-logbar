import type { Labels } from "../labels"

const THEME_STORAGE_KEY = "improved-attendance-theme"

type Theme = "light" | "dark"

/** Returns the theme to apply. */
function loadTheme(): Theme {
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
        if (storedTheme !== null) {
            return storedTheme === "dark" ? "dark" : "light"
        }
    } catch {
        // The storage can be unavailable.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Saves the theme chosen.
 * @param theme - the theme to save
 */
function saveTheme(theme: Theme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
        // The storage can be unavailable.
    }
}

/** Renders the theme switch, and applies the chosen theme to the page. */
export class ThemeSwitch {
    rootElement: HTMLElement
    theme: Theme
    private switchElement: HTMLButtonElement

    /**
     * Creates the switch with the theme chosen.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.theme = loadTheme()

        this.rootElement = document.createElement("div")
        this.rootElement.className = "improved-attendance-settings-row"
        this.rootElement.textContent = labels.SETTINGS_THEME

        this.switchElement = document.createElement("button")
        this.switchElement.type = "button"
        this.switchElement.className = "improved-attendance-theme-switch"
        this.switchElement.title = labels.SETTINGS_THEME
        this.switchElement.setAttribute("aria-label", labels.SETTINGS_THEME)

        this.switchElement.addEventListener("click", () => {
            this.theme = this.theme === "dark" ? "light" : "dark"
            saveTheme(this.theme)
            this.render()
        })
        this.rootElement.append(this.switchElement)
    }

    /** Applies the chosen theme to the page, and keeps it applied. */
    mount(): void {
        this.render()
        new MutationObserver(() => this.render()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    }

    /** Renders the chosen theme on the page and on the switch. */
    private render(): void {
        const isDark = this.theme === "dark"
        if (document.documentElement.classList.contains("dark") !== isDark) {
            document.documentElement.classList.toggle("dark", isDark)
        }
        this.switchElement.textContent = isDark ? "☀" : "☾"
        this.switchElement.setAttribute("aria-pressed", String(isDark))
    }
}
