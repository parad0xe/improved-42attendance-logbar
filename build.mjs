import * as esbuild from "esbuild"

const watch = process.argv.includes("--watch")

const options = {
    entryPoints: ["src/main.js"],
    bundle: true,
    format: "iife",
    target: ["chrome111", "firefox128"],
    outfile: "dist/content.js",
    sourcemap: watch ? "inline" : false,
    logLevel: "info",
}

if (watch) {
    await (await esbuild.context(options)).watch()
} else {
    await esbuild.build(options)
}