/**
 * Decodes the devalue format of SvelteKit: each value refers to the others by their index.
 */
export function decodeDevalue(values: unknown[]): any {
    const specials = new Map([[-1, undefined], [-3, NaN], [-4, Infinity], [-5, -Infinity], [-6, -0]])
    const decoded = new Map<number, any>()

    function read(index: number): any {
        if (index < 0) return specials.get(index)
        if (decoded.has(index)) return decoded.get(index)

        const value = values[index]
        if (value === null || typeof value !== "object") {
            decoded.set(index, value)
            return value
        }

        if (!Array.isArray(value)) {
            const object: Record<string, any> = {}
            decoded.set(index, object)
            for (const key in value) object[key] = read((value as Record<string, number>)[key])
            return object
        }

        if (typeof value[0] !== "string") {
            const array: any[] = []
            decoded.set(index, array)
            value.forEach((item, position) => { if (item !== -2) array[position] = read(item) })
            return array
        }

        const [type, ...fields] = value
        let result: any
        switch (type) {
            case "Date": result = new Date(fields[0]); break
            case "BigInt": result = BigInt(fields[0]); break
            case "RegExp": result = new RegExp(fields[0], fields[1]); break
            case "Set": result = new Set(); decoded.set(index, result); fields.forEach((item) => result.add(read(item))); return result
            case "Map": result = new Map(); decoded.set(index, result); for (let i = 0; i < fields.length; i += 2) result.set(read(fields[i]), read(fields[i + 1])); return result
            case "null": result = Object.create(null); decoded.set(index, result); for (let i = 0; i < fields.length; i += 2) result[fields[i]] = read(fields[i + 1]); return result
            default: result = read(fields[0])
        }
        decoded.set(index, result)
        return result
    }

    return read(0)
}
