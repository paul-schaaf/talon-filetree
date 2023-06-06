import { allHints } from "./allHints";
import { debounce } from "lodash";

export class HintManager {
    private hints: string[];
    private debouncedSort = debounce(this.sort, 100);

    constructor() {
        this.hints = [...allHints];
    }

    get() {
        return this.hints.pop();
    }

    restore(hint: string) {
        this.hints.push(hint);
        this.debouncedSort();
    }

    sort() {
        this.hints.sort((a, b) => b.length - a.length || b.localeCompare(a));
    }

    reset() {
        this.hints = [...allHints];
    }
}
